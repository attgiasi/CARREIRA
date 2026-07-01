import { AgentSettings, NormalizedJob } from "../../types.js";

export function suggestedAnswers(job: NormalizedJob, settings: AgentSettings): Record<string, string> {
  return {
    fale_sobre_voce: `Sou ${settings.profile.name}, profissional com mais de 12 anos em hospitalidade, coquetelaria, eventos, atendimento ao cliente e operação de bar.`,
    por_que_vaga: `A vaga de ${job.title} combina com minha experiência em atendimento, operação, padronização e trabalho em ambientes de alta demanda.`,
    pretensao_salarial: "Resposta sensível: usar apenas após aprovação do usuário, conforme agent-settings.json.",
    disponibilidade: "Disponibilidade a confirmar conforme escala, local, modelo de trabalho e pacote da oportunidade."
  };
}
