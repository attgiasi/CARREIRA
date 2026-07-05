import { hasGoogleSearchSecrets, secrets } from "../../config/secrets.js";
import { audit, logError } from "../../safety/auditLogger.js";
import { AgentSettings, RawJob } from "../../types.js";
import { limitedSearchPairs } from "./searchQueryBuilder.js";

interface GoogleSearchItem {
  title?: string;
  link?: string;
  snippet?: string;
  displayLink?: string;
}

function buildQueries(settings: AgentSettings): string[] {
  const pairs = limitedSearchPairs(settings, 24);
  const base = pairs.flatMap(({ role, location }) => [
    `"${role}" vaga emprego "${location}" candidatar`,
    `"${role}" "${location}" "trabalhe conosco" vaga`,
    `"${role}" "${location}" "processo seletivo" vaga`,
    `"${role}" "${location}" "candidate-se"`,
    `"${role}" "${location}" "apply" "vaga"`
  ]);
  const platformFocused = pairs.slice(0, 14).flatMap(({ role, location }) => [
    `site:linkedin.com/jobs/view ${role} ${location}`,
    `site:gupy.io/jobs ${role} ${location}`,
    `site:solides.jobs/vaga ${role} ${location}`,
    `site:infojobs.com.br/vaga-de ${role} ${location}`,
    `site:99jobs.com/jobs ${role} ${location}`,
    `site:vagas.com.br/vagas ${role} ${location}`,
    `site:br.indeed.com/viewjob ${role} ${location}`,
    `site:netvagas.com.br/vaga ${role} ${location}`,
    `site:solides.jobs/vaga ${role} ${location}`,
    `site:ats.abler.com.br/jobs ${role} ${location}`,
    `site:pandape.infojobs.com.br ${role} ${location}`,
    `site:jobs.quickin.io ${role} ${location}`,
    `site:jobbol.com.br/vagas ${role} ${location}`,
    `site:catho.com.br/vagas ${role} ${location}`,
    `site:empregos.com.br/vagas ${role} ${location}`,
    `site:trabalhabrasil.com.br/vagas ${role} ${location}`,
    `site:bne.com.br/vagas-de-emprego ${role} ${location}`,
    `site:glassdoor.com.br/Vaga ${role} ${location}`,
    `site:jobs.lever.co ${role} ${location}`,
    `site:boards.greenhouse.io ${role} ${location}`
  ]);
  return [
    ...platformFocused,
    ...base,
    `"SINE" vagas "${settings.profile.city}" "${settings.profile.state}"`,
    `"agência de emprego" vagas "${settings.profile.city}" "${settings.profile.state}"`,
    `"recrutamento e seleção" vagas "${settings.profile.city}" "${settings.profile.state}"`,
    `"bartender" "Curitiba" "vagas"`,
    `"atendimento" "Curitiba" "vagas"`
  ].slice(0, 140);
}

function extractFinalResultUrl(value: string | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (host.startsWith("google.") && url.pathname.includes("/url") && url.searchParams.has("q")) {
      return url.searchParams.get("q") ?? "";
    }
    return value;
  } catch {
    return "";
  }
}

function isLikelyDirectJobUrl(value: string | undefined): boolean {
  const finalUrl = extractFinalResultUrl(value);
  if (!finalUrl) return false;
  try {
    const url = new URL(finalUrl);
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname.toLowerCase();
    if (host.includes("google.") || path.includes("/search")) return false;
    if (host.includes("linkedin.com") && path.includes("/jobs/view")) return true;
    if (host.includes("infojobs.com.br") && path.includes("/vaga-de-")) return true;
    if (host.includes("gupy.io") && /\/jobs?\//.test(path)) return true;
    if (host.includes("solides.jobs") && path.includes("/vaga")) return true;
    if (host.includes("vagas.com.br") && path.includes("/vagas/")) return true;
    if (host.includes("indeed.com") && (path.includes("/viewjob") || url.searchParams.has("jk"))) return true;
    if (host.includes("netvagas.com.br") && path.includes("/vaga")) return true;
    if (host.includes("solides.jobs") && path.includes("/vaga")) return true;
    if (host.includes("ats.abler.com.br") && path.includes("/jobs")) return true;
    if (host.includes("pandape.infojobs.com.br")) return true;
    if (host.includes("jobs.lever.co")) return true;
    if (host.includes("boards.greenhouse.io") && path.includes("/jobs/")) return true;
    if (host.includes("99jobs.com") && path.includes("/jobs/")) return true;
    if (host.includes("jobs.quickin.io")) return true;
    if (host.includes("jobbol.com.br") && path.includes("/vagas")) return true;
    if (host.includes("catho.com.br") && path.includes("/vagas")) return true;
    if (host.includes("empregos.com.br") && path.includes("/vagas")) return true;
    if (host.includes("trabalhabrasil.com.br") && path.includes("/vagas")) return true;
    if (host.includes("bne.com.br") && path.includes("/vagas-de-emprego")) return true;
    if (host.includes("glassdoor.com.br") && path.toLowerCase().includes("/vaga")) return true;
    if (/\/(vaga|vagas|jobs?|careers?|opportunit)/i.test(path) && !path.endsWith("/vagas") && !path.endsWith("/jobs")) return true;
    return false;
  } catch {
    return false;
  }
}

async function searchGoogle(query: string): Promise<RawJob[]> {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", secrets.googleSearchApiKey);
  url.searchParams.set("cx", secrets.googleSearchEngineId);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "10");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Search retornou ${response.status}`);
  const data = await response.json() as { items?: GoogleSearchItem[] };
  return (data.items ?? [])
    .map((item) => ({ item, finalUrl: extractFinalResultUrl(item.link) }))
    .filter(({ finalUrl }) => isLikelyDirectJobUrl(finalUrl))
    .map(({ item, finalUrl }) => ({
      externalId: `google-real-${finalUrl || item.title || query}`,
      title: item.title ?? `Vaga real via Google: ${query}`,
      company: item.displayLink ?? "Resultado do Google",
      location: "Detectado no resultado",
      source: "google-real-job",
      url: finalUrl,
      description: item.snippet ?? `Vaga real encontrada no Google para: ${query}`,
      raw: { query, item, directJobResult: true }
    }));
}

export async function fetchGoogleJobsSearch(settings: AgentSettings): Promise<RawJob[]> {
  const queries = buildQueries(settings);
  if (!hasGoogleSearchSecrets()) {
    audit("googleJobsSearchConnector", "scan", "Google Programmable Search não configurado; nenhum link do Google será salvo como vaga.");
    return [];
  }

  try {
    const batches = await Promise.all(queries.slice(0, 35).map(searchGoogle));
    const jobs = batches.flat();
    audit("googleJobsSearchConnector", "scan", `Resultados Google importados: ${jobs.length}.`);
    return jobs;
  } catch (error) {
    logError("googleJobsSearchConnector", error);
    return [];
  }
}
