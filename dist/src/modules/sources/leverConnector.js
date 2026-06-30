import { audit } from "../../safety/auditLogger.js";
export async function fetchLeverJobs() {
    audit("leverConnector", "scan", "Nenhuma empresa Lever configurada; pulando.");
    return [];
}
