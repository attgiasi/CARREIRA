import { RawJob } from "../../types.js";
import { audit } from "../../safety/auditLogger.js";

export async function fetchCompanyCareerPages(): Promise<RawJob[]> {
  audit("companyCareerPageConnector", "scan", "Páginas de carreira ainda não configuradas; pulando.");
  return [];
}
