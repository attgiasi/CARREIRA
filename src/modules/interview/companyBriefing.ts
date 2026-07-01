import { NormalizedJob } from "../../types.js";

export function companyBriefing(job: NormalizedJob): string {
  return `Empresa: ${job.company}\nFonte: ${job.source}\nPontos a validar: reputação, modelo de contratação, equipe, escala, remuneração e próximos passos.`;
}
