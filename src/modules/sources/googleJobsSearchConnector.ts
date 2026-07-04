import { hasGoogleSearchSecrets, secrets } from "../../config/secrets.js";
import { audit, logError } from "../../safety/auditLogger.js";
import { AgentSettings, RawJob } from "../../types.js";
import { googleSearchUrl, limitedSearchPairs } from "./searchQueryBuilder.js";

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
    `"${role}" "${location}" "processo seletivo" vaga`
  ]);
  const platformFocused = pairs.slice(0, 10).flatMap(({ role, location }) => [
    `site:linkedin.com/jobs/view ${role} ${location}`,
    `site:gupy.io/jobs ${role} ${location}`,
    `site:solides.jobs/vaga ${role} ${location}`,
    `site:infojobs.com.br/vaga-de ${role} ${location}`,
    `site:99jobs.com/jobs ${role} ${location}`,
    `site:vagas.com.br/vagas ${role} ${location}`,
    `site:br.indeed.com/viewjob ${role} ${location}`,
    `site:netvagas.com.br/vaga ${role} ${location}`
  ]);
  return [
    ...base,
    ...platformFocused,
    `"SINE" vagas "${settings.profile.city}" "${settings.profile.state}"`,
    `"agência de emprego" vagas "${settings.profile.city}" "${settings.profile.state}"`,
    `"recrutamento e seleção" vagas "${settings.profile.city}" "${settings.profile.state}"`,
    `"bartender" "Curitiba" "vagas"`,
    `"atendimento" "Curitiba" "vagas"`
  ].slice(0, 90);
}

function isLikelyDirectJobUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
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
    if (host.includes("jobs.lever.co")) return true;
    if (host.includes("boards.greenhouse.io") && path.includes("/jobs/")) return true;
    if (host.includes("99jobs.com") && path.includes("/jobs/")) return true;
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
  url.searchParams.set("num", "5");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Search retornou ${response.status}`);
  const data = await response.json() as { items?: GoogleSearchItem[] };
  return (data.items ?? [])
    .filter((item) => isLikelyDirectJobUrl(item.link))
    .map((item) => ({
      externalId: `google-real-${item.link ?? item.title ?? query}`,
      title: item.title ?? `Vaga real via Google: ${query}`,
      company: item.displayLink ?? "Resultado do Google",
      location: "Detectado no resultado",
      source: "google-real-job",
      url: item.link ?? "",
      description: item.snippet ?? `Vaga real encontrada no Google para: ${query}`,
      raw: { query, item, directJobResult: true }
    }));
}

export async function fetchGoogleJobsSearch(settings: AgentSettings): Promise<RawJob[]> {
  const queries = buildQueries(settings);
  if (!hasGoogleSearchSecrets()) {
    audit("googleJobsSearchConnector", "scan", "Google Programmable Search não configurado; criando buscas assistidas.");
    return queries.slice(0, 45).map((query) => ({
      externalId: `google-assisted-${query}`,
      title: `Busca Google: ${query}`,
      company: "Google",
      location: "Conforme busca configurada",
      source: "google-assisted-search",
      url: googleSearchUrl(query),
      description: `Busca pronta no Google para encontrar vagas: ${query}. Configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_ENGINE_ID para importar resultados automaticamente.`,
      raw: { query, requiresApiKey: true }
    }));
  }

  try {
    const batches = await Promise.all(queries.slice(0, 20).map(searchGoogle));
    const jobs = batches.flat();
    audit("googleJobsSearchConnector", "scan", `Resultados Google importados: ${jobs.length}.`);
    return jobs;
  } catch (error) {
    logError("googleJobsSearchConnector", error);
    return [];
  }
}
