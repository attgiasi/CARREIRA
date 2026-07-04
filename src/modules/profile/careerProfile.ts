import { AgentSettings } from "../../types.js";

export function careerProfileSummary(settings: AgentSettings): string {
  return `${settings.profile.name} | ${settings.profile.city}/${settings.profile.state} | ${settings.profile.summary}`;
}

export function realExperienceKeywords(): string[] {
  return [
    "hospitalidade",
    "coquetelaria",
    "bartender",
    "mixologia",
    "atendimento ao cliente",
    "experiência do cliente",
    "customer experience",
    "customer success",
    "sucesso do cliente",
    "eventos",
    "gestão de bar",
    "liderança operacional",
    "treinamento",
    "padronização",
    "operação",
    "backoffice",
    "análise operacional",
    "rotina de alta demanda",
    "controle de qualidade",
    "relacionamento com cliente",
    "prevenção de falhas",
    "organização de processos",
    "comunicação consultiva"
  ];
}
