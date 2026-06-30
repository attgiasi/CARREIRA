import { audit } from "../../safety/auditLogger.js";
export async function fetchCompanyCareerPages() {
    audit("companyCareerPageConnector", "scan", "Páginas de carreira ainda não configuradas; pulando.");
    return [];
}
