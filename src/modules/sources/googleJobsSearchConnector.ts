import { hasGoogleSearchSecrets, secrets } from "../../config/secrets.js";
import { AgentSettings, RawJob } from "../../types.js";
import { limitedSearchPairs } from "./searchQueryBuilder.js";
import { isSearchPage, readJobPage } from "./jobPageReader.js";
import { collectSources, SearchBatch } from "./publicCareerSources.js";

const boardDomains: Record<string, string> = {
  infojobs:"infojobs.com.br", linkedinSearch:"linkedin.com/jobs/view", indeedSearch:"indeed.com/viewjob",
  jobs99:"99jobs.com", vagasCom:"vagas.com.br", cathoSearch:"catho.com.br", netvagas:"netvagas.com.br",
  bne:"bne.com.br", trabalhaBrasil:"trabalhabrasil.com.br", glassdoorSearch:"glassdoor.com.br",
  solidesJobs:"solides.jobs", ablerJobs:"abler.com.br", pandapeJobs:"pandape.infojobs.com.br"
};

export function googleQueries(settings: AgentSettings): string[] {
  const domains = Object.entries(boardDomains).filter(([key]) => settings.sources[key]).map(([,value]) => `site:${value}`);
  return limitedSearchPairs(settings, 12).map(({role,location}, index) => `${role} ${location.replace(/\s+e (?:regi[aã]o.*|Campinas)$/i, "")} vaga ${domains.length && index % 2 ? `(${domains.join(" OR ")})` : "candidatura"}`);
}

export async function searchGoogleJobs(settings: AgentSettings): Promise<SearchBatch> {
  if (!hasGoogleSearchSecrets()) return {jobs:[], reports:[{source:"Google",status:"not_configured",found:0,message:"Configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_ENGINE_ID. Nenhuma pesquisa sera salva como vaga."}]};
  const resultUrls = new Set<string>();
  const searchReports = await collectSources(googleQueries(settings).map(query => ({name:"Google",run:async () => {
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key",secrets.googleSearchApiKey);
    url.searchParams.set("cx",secrets.googleSearchEngineId);
    url.searchParams.set("q",query);
    url.searchParams.set("num","10");
    const response = await fetch(url,{signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error(`Google indisponivel (HTTP ${response.status}).`);
    const data = await response.json() as {items?: Array<{link?:string}>};
    for (const item of data.items || []) if (item.link && !isSearchPage(item.link)) resultUrls.add(item.link);
    return [];
  }})));
  const pages = await collectSources([...resultUrls].slice(0, 45).map(url => ({name:new URL(url).hostname, run:() => readJobPage(url)})));
  return {jobs:pages.jobs, reports:[{source:"Google", status:searchReports.reports.some(r => r.status === "error") ? "partial" : "ok", found:pages.jobs.length,
    message:`${resultUrls.size} links encontrados; ${pages.jobs.length} anuncios verificados. ${pages.reports.filter(r=>r.status === "error").length} paginas indisponiveis.`}]};
}

export async function fetchGoogleJobsSearch(settings: AgentSettings): Promise<RawJob[]> {
  return (await searchGoogleJobs(settings)).jobs;
}
