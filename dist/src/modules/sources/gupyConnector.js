import { audit } from "../../safety/auditLogger.js";
export async function fetchGupyJobs() {
    audit("gupyConnector", "scan", "Gupy precisa de token/endpoints configurados; pulando.");
    return [];
}
