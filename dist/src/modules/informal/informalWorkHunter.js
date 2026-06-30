import { audit } from "../../safety/auditLogger.js";
export async function findInformalWork() {
    audit("informalWorkHunter", "scan", "Fontes informais externas não configuradas; usando apenas e-mails/links manuais.");
    return [];
}
