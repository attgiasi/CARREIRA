import { audit } from "../../safety/auditLogger.js";
export async function fetchRssJobs() {
    audit("rssConnector", "scan", "RSS não configurado; pulando sem erro.");
    return [];
}
