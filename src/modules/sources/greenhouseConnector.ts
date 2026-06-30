import { RawJob } from "../../types.js";
import { audit } from "../../safety/auditLogger.js";

export async function fetchGreenhouseJobs(): Promise<RawJob[]> {
  audit("greenhouseConnector", "scan", "Nenhuma empresa Greenhouse configurada; pulando.");
  return [];
}
