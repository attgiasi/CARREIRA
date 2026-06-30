import { audit } from "../../safety/auditLogger.js";
import { getGmailClient } from "./gmailClient.js";
export async function createGmailDraft(to, subject, body) {
    const gmail = await getGmailClient();
    if (!gmail) {
        audit("draftManager", "create_draft", "Gmail não configurado; rascunho salvo apenas como arquivo local.", "baixo", { to, subject });
        return "";
    }
    const raw = Buffer.from(`To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`).toString("base64url");
    const draft = await gmail.users.drafts.create({ userId: "me", requestBody: { message: { raw } } });
    return draft.data.id ?? "";
}
