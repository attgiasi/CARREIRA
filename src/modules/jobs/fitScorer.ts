import { AgentSettings, NormalizedJob } from "../../types.js";
import { targetRoles } from "../profile/preferencesManager.js";
import { userMeetsEducation } from "../profile/educationProfile.js";
import { canMeetDriverRequirement } from "../profile/licenseProfile.js";
import { locationMatches } from "./locationMatcher.js";
import { salaryNumber } from "./salaryExtractor.js";

export function scoreFit(job: NormalizedJob, settings: AgentSettings): { score: number; reason: string } {
  let score = 45;
  const reasons: string[] = [];
  const text = `${job.title} ${job.description}`.toLowerCase();
  if (targetRoles(settings).some((role) => text.includes(role.toLowerCase()))) {
    score += 20;
    reasons.push("cargo/trilha aderente");
  }
  if (/bartender|barman|head bartender|bar manager|chefe de bar|supervisor de bar|mixolog|coquetel|alimentos e bebidas|\ba&b\b/.test(text)) {
    score += 20;
    reasons.push("aderência direta a bar e bebidas");
  } else if (/hospitalidade|guest experience|experiência do cliente|experiencia do cliente|restaurante|hotel|gastronomia|evento/.test(text)) {
    score += 12;
    reasons.push("experiência em hospitalidade aproveitável");
  }
  if (/alto padr[aã]o|luxo|premium|fine dining|hotel 5 estrelas|resort|cocktail bar/.test(text)) {
    score += 8;
    reasons.push("operação premium");
  }
  if (/telemarketing|call center|e-commerce|varejo|operador de caixa|auxiliar administrativo|backoffice|preven[cç][aã]o.*fraude|vendedor de loja/.test(text)) {
    score -= 25;
    reasons.push("fora do foco atual de hospitalidade premium");
  }
  if (locationMatches(`${job.location} ${job.workModel}`)) {
    score += 10;
    reasons.push("local/modelo compatível");
  }
  if (job.educationLevelDetected === "nao_informado" || userMeetsEducation(settings, job.educationLevelDetected)) {
    score += 5;
    reasons.push("escolaridade compatível ou não informada");
  }
  if (canMeetDriverRequirement(settings, job.driverLicenseRequired, job.driverLicenseCategories, job.ownVehicleRequired)) {
    score += 5;
    reasons.push("requisito de CNH/veículo não bloqueia");
  } else {
    score -= 25;
    reasons.push("CNH/veículo pode bloquear");
  }
  const salary = salaryNumber(job.salary);
  const salaryPreferences = settings.salaryPreferences as { salaryByContractType?: { clt?: { minimumMonthly?: number } }; rejectBelowMinimum?: boolean };
  const minimumSalary = Number(salaryPreferences.salaryByContractType?.clt?.minimumMonthly ?? 3000);
  if (salary >= minimumSalary) {
    score += 8;
    reasons.push(`salário-base de pelo menos R$ ${minimumSalary.toLocaleString("pt-BR")}`);
  } else if (salary > 0 && salaryPreferences.rejectBelowMinimum) {
    score -= 20;
    reasons.push(`salário-base abaixo de R$ ${minimumSalary.toLocaleString("pt-BR")}`);
  } else if (salary === 0) {
    score -= 4;
    reasons.push("salário-base não informado");
  }
  return { score: Math.max(0, Math.min(100, score)), reason: reasons.join("; ") };
}
