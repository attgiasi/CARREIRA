import { audit } from "../../safety/auditLogger.js";
import { AgentSettings, RawJob } from "../../types.js";
import { googleSearchUrl, limitedSearchPairs } from "./searchQueryBuilder.js";

export type Board =
  | "sine"
  | "infojobs"
  | "jobs99"
  | "linkedinSearch"
  | "indeedSearch"
  | "vagasCom"
  | "cathoSearch"
  | "netvagas"
  | "bne"
  | "trabalhaBrasil"
  | "glassdoorSearch"
  | "empregosComBr";

const boardConfig: Record<Board, { label: string; source: string; domain: string; baseUrl: string }> = {
  sine: {
    label: "SINE / Emprega Curitiba",
    source: "sine",
    domain: "emprega.curitiba.pr.gov.br OR sine.com.br OR trabalhabrasil.com.br",
    baseUrl: "https://emprega.curitiba.pr.gov.br/"
  },
  infojobs: {
    label: "InfoJobs",
    source: "infojobs",
    domain: "infojobs.com.br",
    baseUrl: "https://www.infojobs.com.br/"
  },
  jobs99: {
    label: "99jobs",
    source: "jobs99",
    domain: "99jobs.com",
    baseUrl: "https://www.99jobs.com/"
  },
  linkedinSearch: {
    label: "LinkedIn Jobs",
    source: "linkedin-search",
    domain: "linkedin.com/jobs",
    baseUrl: "https://www.linkedin.com/jobs/"
  },
  indeedSearch: {
    label: "Indeed",
    source: "indeed-search",
    domain: "br.indeed.com",
    baseUrl: "https://br.indeed.com/"
  },
  vagasCom: {
    label: "Vagas.com",
    source: "vagascom-search",
    domain: "vagas.com.br",
    baseUrl: "https://www.vagas.com.br/"
  },
  cathoSearch: {
    label: "Catho",
    source: "catho-search",
    domain: "catho.com.br",
    baseUrl: "https://www.catho.com.br/"
  },
  netvagas: {
    label: "NetVagas",
    source: "netvagas-search",
    domain: "netvagas.com.br",
    baseUrl: "https://www.netvagas.com.br/"
  },
  bne: {
    label: "BNE",
    source: "bne-search",
    domain: "bne.com.br",
    baseUrl: "https://www.bne.com.br/"
  },
  trabalhaBrasil: {
    label: "Trabalha Brasil",
    source: "trabalhabrasil-search",
    domain: "trabalhabrasil.com.br",
    baseUrl: "https://www.trabalhabrasil.com.br/"
  },
  glassdoorSearch: {
    label: "Glassdoor",
    source: "glassdoor-search",
    domain: "glassdoor.com.br",
    baseUrl: "https://www.glassdoor.com.br/"
  },
  empregosComBr: {
    label: "Empregos.com.br",
    source: "empregos-search",
    domain: "empregos.com.br",
    baseUrl: "https://www.empregos.com.br/"
  }
};

function directBoardSearchUrl(board: Board, role: string, location: string, googleQuery: string): string {
  const keywords = encodeURIComponent(role);
  const place = encodeURIComponent(location);
  if (board === "linkedinSearch") return `https://www.linkedin.com/jobs/search/?keywords=${keywords}&location=${place}`;
  if (board === "indeedSearch") return `https://br.indeed.com/jobs?q=${keywords}&l=${place}`;
  if (board === "vagasCom") return `https://www.vagas.com.br/vagas-de-${keywords}?q=${keywords}`;
  if (board === "infojobs") return `https://www.infojobs.com.br/vagas.aspx?palabra=${keywords}&provincia=${place}`;
  return googleSearchUrl(googleQuery);
}

function siteQuery(domain: string): string {
  return domain
    .split(/\s+OR\s+/i)
    .map((part) => `site:${part.trim()}`)
    .join(" OR ");
}

export function fetchJobBoardSearches(settings: AgentSettings, board: Board): RawJob[] {
  const config = boardConfig[board];
  const pairs = limitedSearchPairs(settings, 18);
  const results = pairs.map(({ role, location }) => {
    const query = `(${siteQuery(config.domain)}) ${role} ${location} vaga emprego candidatar`;
    const url = directBoardSearchUrl(board, role, location, query);
    return {
      externalId: `${board}-${role}-${location}`,
      title: `${config.label}: ${role} em ${location}`,
      company: config.label,
      location,
      source: config.source,
      url,
      description: `Busca assistida em ${config.label} para ${role} em ${location}. Abra o link, escolha a vaga específica e importe o link real pelo painel para candidatar com precisão.`,
      raw: { role, location, board, directUrl: config.baseUrl, query, searchUrl: url }
    };
  });
  audit("jobBoardsConnector", "scan", `Buscas ${config.label} geradas: ${results.length}.`);
  return results;
}
