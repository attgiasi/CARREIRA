import { RawJob } from "../../types.js";

export function seedTargetCompanyOpportunities(): RawJob[] {
  return [
    {
      externalId: "target-curitiba-hospitalidade",
      title: "Prospecção ativa - hospitalidade premium em Curitiba",
      company: "Empresas-alvo de bares, hotéis e eventos",
      location: "Curitiba/PR",
      source: "companyHunter",
      url: "",
      description: "Oportunidade de abordagem ativa para bares, hotéis, restaurantes, casas de eventos e consultorias de operação.",
      raw: { proactive: true }
    }
  ];
}
