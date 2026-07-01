import { audit } from "../../safety/auditLogger.js";

export async function createFollowUpReminder(applicationId: number, afterDays: number): Promise<void> {
  audit("reminderManager", "follow_up", "Lembrete registrado para configuração futura.", "baixo", { applicationId, afterDays });
}
