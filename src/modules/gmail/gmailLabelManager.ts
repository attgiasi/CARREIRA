import { audit } from "../../safety/auditLogger.js";

export async function ensureGmailLabels(): Promise<void> {
  audit("gmailLabelManager", "ensure_labels", "Etiquetas serão criadas quando Gmail estiver configurado.");
}
