import { RawJob } from "../../types.js";
import { audit } from "../../safety/auditLogger.js";

export async function fetchLeverJobs(): Promise<RawJob[]> {
  audit("leverConnector", "scan", "Nenhuma empresa Lever configurada; pulando.");
  return [];
}
