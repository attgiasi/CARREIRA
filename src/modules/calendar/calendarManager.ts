import { audit } from "../../safety/auditLogger.js";

export async function createCalendarEvent(title: string, when: string): Promise<void> {
  audit("calendarManager", "create_event", "Calendar opcional; evento não criado sem configuração.", "baixo", { title, when });
}
