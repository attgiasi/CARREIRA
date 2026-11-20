import { AgentSettings, RawJob } from "../../types.js";
import { extractJobLinks, parseQuickinJobs, readJobPage, readPublicPage } from "./jobPageReader.js";
import { titleMatchesPreferences } from "../jobs/searchEligibility.js";
import { fetchSmartRecruitersBoard } from "./smartRecruitersConnector.js";

export interface SourceReport { source: string; status: "ok" | "partial" | "error" | "not_configured"; found: number; message: string }
export interface SearchBatch { jobs: RawJob[]; reports: SourceReport[] }

export async function collectSources(sources: Array<{name: string; run: () => Promise<RawJob[]>}>): Promise<SearchBatch> {
  const jobs: RawJob[] = [];
  const reports: SourceReport[] = [];
  // Bounded concurrency avoids exhausting portals or discarding other sources on failure.
  for (let offset = 0; offset < sources.length; offset += 3) {
    const batch = sources.slice(offset, offset + 3);
    const results = await Promise.allSettled(batch.map(source => source.run()));
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        jobs.push(...result.value);
        reports.push({source: batch[index].name, status:"ok", found:result.value.length, message:result.value.length ? "Anuncios individuais coletados." : "Nenhum anuncio legivel encontrado nesta consulta."});
      } else reports.push({source:batch[index].name, status:"error", found:0, message:result.reason instanceof Error ? result.reason.message : "Fonte indisponivel."});
    });
  }
  return {jobs, reports};
}

export async function fetchQuickinBoard(slug: string, settings?: AgentSettings): Promise<RawJob[]> {
  if (!/^[a-z0-9_-]{1,80}$/i.test(slug)) throw new Error("Identificador da pagina de carreiras invalido.");
  const jobs: RawJob[] = [];
  for (let page = 1; page <= 8; page += 1) {
    const response = await readPublicPage(`https://api.quickin.io/public/careersites/${slug}/jobs?limit=30&page=${page}`);
    const data = JSON.parse(response.html);
    if (!Array.isArray(data.docs)) throw new Error("Formato da fonte Quickin mudou.");
    jobs.push(...parseQuickinJobs(data.docs));
    if (page >= Number(data.pages || 1) || !data.docs.length) break;
  }
  if (!settings) return jobs;
  const relevant = jobs.filter(job => titleMatchesPreferences(job.title,settings)).slice(0,40);
  const details = await collectSources(relevant.map(job => ({name:job.url || slug,run:()=>readJobPage(job.url!)})));
  if (relevant.length && details.reports.every(r=>r.status === "error")) throw new Error("A fonte publicou vagas, mas bloqueou os detalhes. Abra a pagina oficial.");
  return details.jobs;
}

export async function searchCareerPages(settings: AgentSettings): Promise<SearchBatch> {
  const configured = settings.jobSearchPreferences.careerPageUrls;
  const urls = Array.isArray(configured) ? [...new Set(configured.map(String))].slice(0, 12) : [];
  if (!urls.length) return {jobs:[], reports:[{source:"Paginas de carreira", status:"not_configured", found:0, message:"Adicione paginas de carreira nas preferencias de busca."}]};
  return collectSources(urls.map(value => ({name:value, run:async () => {
    const url = new URL(value);
    if (url.hostname === "careers.smartrecruiters.com" && /^\/[^/]+\/?$/.test(url.pathname)) return fetchSmartRecruitersBoard(url.pathname.split("/")[1],settings);
    if (url.hostname === "jobs.quickin.io" && /^\/[^/]+\/jobs\/?$/.test(url.pathname)) return fetchQuickinBoard(url.pathname.split("/")[1],settings);
    const page = await readPublicPage(value);
    const links = extractJobLinks(page.html, page.url).slice(0, 18);
    const batch = await collectSources((links.length ? links : [value]).map(link => ({name:link, run:() => readJobPage(link)})));
    if (batch.reports.every(x => x.status === "error")) throw new Error("A fonte bloqueou a leitura dos anuncios. Use a pagina oficial.");
    return batch.jobs;
  }})));
}
