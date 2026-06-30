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
    "eventos",
    "gestão de bar",
    "treinamento",
    "padronização",
    "operação",
    "backoffice",
    "análise operacional"
  ];
}
