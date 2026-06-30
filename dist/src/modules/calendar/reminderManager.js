import { audit } from "../../safety/auditLogger.js";
export async function createFollowUpReminder(applicationId, afterDays) {
    audit("reminderManager", "follow_up", "Lembrete registrado para configuração futura.", "baixo", { applicationId, afterDays });
}
