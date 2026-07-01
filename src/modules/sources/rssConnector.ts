import { RawJob } from "../../types.js";
import { audit } from "../../safety/auditLogger.js";

export async function fetchRssJobs(): Promise<RawJob[]> {
  audit("rssConnector", "scan", "RSS não configurado; pulando sem erro.");
  return [];
}
