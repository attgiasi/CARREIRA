import { audit } from "../../safety/auditLogger.js";
export async function ensureGmailLabels() {
    audit("gmailLabelManager", "ensure_labels", "Etiquetas serão criadas quando Gmail estiver configurado.");
}
