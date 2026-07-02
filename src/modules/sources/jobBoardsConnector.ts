import { audit } from "../../safety/auditLogger.js";
import { AgentSettings, RawJob } from "../../types.js";
import { googleSearchUrl, limitedSearchPairs } from "./searchQueryBuilder.js";

type Board = "sine" | "infojobs" | "jobs99";

const boardConfig: Record<Board, { label: string; domain: string; baseUrl: string }> = {
  sine: {
    label: "SINE / Emprega Curitiba",
    domain: "emprega.curitiba.pr.gov.br OR sine.com.br OR trabalhabrasil.com.br",
    baseUrl: "https://emprega.curitiba.pr.gov.br/"
  },
  infojobs: {
    label: "InfoJobs",
    domain: "infojobs.com.br",
    baseUrl: "https://www.infojobs.com.br/"
  },
  jobs99: {
    label: "99jobs",
    domain: "99jobs.com",
    baseUrl: "https://www.99jobs.com/"
  }
};

export function fetchJobBoardSearches(settings: AgentSettings, board: Board): RawJob[] {
  const config = boardConfig[board];
  const pairs = limitedSearchPairs(settings, 18);
  const results = pairs.map(({ role, location }) => {
    const query = `site:(${config.domain}) "${role}" "${location}" vaga emprego`;
    return {
      externalId: `${board}-${role}-${location}`,
      title: `${config.label}: ${role} em ${location}`,
      company: config.label,
      location,
      source: board,
      url: googleSearchUrl(query),
      description: `Busca assistida em ${config.label} para ${role} em ${location}. Abra o link para ver resultados atuais e depois importe vagas específicas pelo link manual.`,
      raw: { role, location, board, directUrl: config.baseUrl, query }
    };
  });
  audit("jobBoardsConnector", "scan", `Buscas ${config.label} geradas: ${results.length}.`);
  return results;
}
