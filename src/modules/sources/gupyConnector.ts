import { RawJob } from "../../types.js";
import { audit } from "../../safety/auditLogger.js";

export async function fetchGupyJobs(): Promise<RawJob[]> {
  audit("gupyConnector", "scan", "Gupy precisa de token/endpoints configurados; pulando.");
  return [];
}
