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
    "eventos",
    "gestão de bar",
    "liderança operacional",
    "treinamento",
    "padronização",
    "operação",
    "rotina de alta demanda",
    "controle de qualidade",
    "relacionamento com cliente",
    "organização de processos",
    "comunicação assertiva",
    "escuta ativa",
    "controle de estoque",
    "cmv",
    "fornecedores",
    "compras"
  ];
}
