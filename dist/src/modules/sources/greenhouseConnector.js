import { audit } from "../../safety/auditLogger.js";
export async function fetchGreenhouseJobs() {
    audit("greenhouseConnector", "scan", "Nenhuma empresa Greenhouse configurada; pulando.");
    return [];
}
