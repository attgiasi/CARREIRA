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
  const base = limitedSearchPairs(settings, 14).map(({ role, location }) => `"${role}" vaga emprego "${location}"`);
  return [
    ...base,
    `"SINE" vagas "${settings.profile.city}" "${settings.profile.state}"`,
    `"agência de emprego" vagas "${settings.profile.city}" "${settings.profile.state}"`,
    `"recrutamento e seleção" vagas "${settings.profile.city}" "${settings.profile.state}"`,
    `"bartender" "Curitiba" "vagas"`,
    `"atendimento" "Curitiba" "vagas"`
  ];
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
  return (data.items ?? []).map((item) => ({
    externalId: `google-${item.link ?? item.title ?? query}`,
    title: item.title ?? `Resultado Google: ${query}`,
    company: item.displayLink ?? "Resultado do Google",
    location: "Detectado no resultado",
    source: "google-search",
    url: item.link ?? googleSearchUrl(query),
    description: item.snippet ?? `Resultado encontrado para: ${query}`,
    raw: { query, item }
  }));
}

export async function fetchGoogleJobsSearch(settings: AgentSettings): Promise<RawJob[]> {
  const queries = buildQueries(settings);
  if (!hasGoogleSearchSecrets()) {
    audit("googleJobsSearchConnector", "scan", "Google Programmable Search não configurado; criando buscas assistidas.");
    return queries.map((query) => ({
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
    const batches = await Promise.all(queries.slice(0, 10).map(searchGoogle));
    const jobs = batches.flat();
    audit("googleJobsSearchConnector", "scan", `Resultados Google importados: ${jobs.length}.`);
    return jobs;
  } catch (error) {
    logError("googleJobsSearchConnector", error);
    return [];
  }
}
