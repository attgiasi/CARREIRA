import fs from "node:fs";
import path from "node:path";
import { audit } from "../../safety/auditLogger.js";
import { AgentSettings, RawJob } from "../../types.js";
import { configuredRoles } from "./searchQueryBuilder.js";

interface Agency {
  name: string;
  website: string;
  sector: string;
  city: string;
  state: string;
  targetCategory: string;
  notes: string;
}

export function fetchRhAgencySearches(settings: AgentSettings): RawJob[] {
  const file = path.resolve(process.cwd(), "data/rh-agencies-curitiba.json");
  if (!fs.existsSync(file)) return [];
  const agencies = JSON.parse(fs.readFileSync(file, "utf8")) as Agency[];
  const roles = configuredRoles(settings).slice(0, 6);
  const jobs = agencies.flatMap((agency) => roles.map((role) => {
    const query = `site:${new URL(agency.website).hostname} "${role}" vaga`;
    return {
      externalId: `rh-agency-${agency.name}-${role}`,
      title: `${agency.name}: procurar ${role}`,
      company: agency.name,
      location: `${agency.city}/${agency.state}`,
      source: "rh-agencies-curitiba",
      url: agency.website,
      description: `${agency.notes} Fonte direta para encontrar oportunidades de ${role}. Abra o site, escolha a vaga específica e importe o link real quando existir formulário ou página individual.`,
      raw: { agency, role, directUrl: agency.website, query }
    };
  }));
  audit("rhAgenciesConnector", "scan", `Buscas em agências de RH geradas: ${jobs.length}.`);
  return jobs;
}
