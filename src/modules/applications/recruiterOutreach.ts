import { AgentSettings } from "../../types.js";

export function recruiterOutreach(track: string, settings: AgentSettings): string {
  return `Olá, tudo bem? Me chamo ${settings.profile.name}. Tenho sólida experiência em atendimento, hospitalidade e operação, com atuação em experiência do cliente, desenvolvimento de equipes, treinamento e padronização de processos. Gostaria de me colocar à disposição para oportunidades compatíveis com ${track}. Segue meu currículo original para avaliação.`;
}
