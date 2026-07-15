import { AgentSettings, NormalizedJob } from "../../types.js";

export function suggestedAnswers(job: NormalizedJob, settings: AgentSettings): Record<string, string> {
  return {
    fale_sobre_voce: `Sou ${settings.profile.name}, profissional com sólida experiência em atendimento, hospitalidade e operação, com foco em experiência do cliente, desenvolvimento de equipes e excelência operacional.`,
    por_que_vaga: `A vaga de ${job.title} combina com minha experiência em atendimento, operação, padronização e trabalho em ambientes de alta demanda.`,
    pretensao_salarial: "Resposta sensível: usar apenas após aprovação do usuário, conforme agent-settings.json.",
    disponibilidade: "Disponibilidade a confirmar conforme escala, local, modelo de trabalho e pacote da oportunidade."
  };
}
