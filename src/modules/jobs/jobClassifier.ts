import { NormalizedJob } from "../../types.js";

export function classifyJob(job: NormalizedJob): string {
  if (job.riskScore >= 80) return "Golpe provável";
  if (job.riskScore >= 60) return "Suspeita";
  if (job.fitScore >= 85 && job.riskScore <= 30) return "Vaga Ouro";
  if (job.fitScore >= 70) return "Vaga Boa";
  if (job.fitScore >= 50) return "Vaga Média";
  return "Vaga Ruim";
}
