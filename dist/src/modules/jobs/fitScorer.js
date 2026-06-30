import { targetRoles } from "../profile/preferencesManager.js";
import { userMeetsEducation } from "../profile/educationProfile.js";
import { canMeetDriverRequirement } from "../profile/licenseProfile.js";
import { locationMatches } from "./locationMatcher.js";
export function scoreFit(job, settings) {
    let score = 45;
    const reasons = [];
    const text = `${job.title} ${job.description}`.toLowerCase();
    if (targetRoles(settings).some((role) => text.includes(role.toLowerCase()))) {
        score += 20;
        reasons.push("cargo/trilha aderente");
    }
    if (/bartender|bar|mixolog|hospitalidade|evento|atendimento|customer|backoffice|fraude|operações|operacoes/.test(text)) {
        score += 15;
        reasons.push("experiência real aproveitável");
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
    }
    else {
        score -= 25;
        reasons.push("CNH/veículo pode bloquear");
    }
    return { score: Math.max(0, Math.min(100, score)), reason: reasons.join("; ") };
}
