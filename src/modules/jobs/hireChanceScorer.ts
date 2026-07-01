import { AgentSettings, NormalizedJob } from "../../types.js";
import { userMeetsEducation } from "../profile/educationProfile.js";

export function scoreHireChance(job: NormalizedJob, settings: AgentSettings): { score: number; reason: string } {
  let score = 55;
  const reasons: string[] = [];
  const text = `${job.title} ${job.description}`.toLowerCase();
  if (/12 anos|experiência|experiencia|atendimento|eventos|gestão|gestao|operação|operacao/.test(text)) {
    score += 15;
    reasons.push("histórico profissional conversa com os requisitos");
  }
  if (/inglês fluente|power bi avançado|cnh obrigatória|veículo próprio/.test(text)) {
    score -= 18;
    reasons.push("possível lacuna forte");
  }
  if (job.educationLevelDetected !== "nao_informado" && !userMeetsEducation(settings, job.educationLevelDetected)) {
    score -= 25;
    reasons.push("escolaridade acima do perfil configurado");
  }
  if (job.seniorityLevel === "gerencia" || job.seniorityLevel === "coordenacao") {
    score += 5;
    reasons.push("experiência com rotina e gestão ajuda em liderança");
  }
  return { score: Math.max(0, Math.min(100, score)), reason: reasons.join("; ") || "chance moderada; revisar detalhes da vaga" };
}
