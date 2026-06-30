import { hasGmailSecrets, secrets } from "../../config/secrets.js";
import { audit, logError } from "../../safety/auditLogger.js";
import { getGmailClient } from "../gmail/gmailClient.js";
function extractLinks(text) {
    return [...text.matchAll(/https?:\/\/[^\s")<>]+/g)].map((match) => match[0]);
}
export async function readGmailJobAlerts() {
    if (!hasGmailSecrets()) {
        audit("gmailJobAlerts", "scan", "Gmail não configurado; pulando leitura de alertas.");
        return [];
    }
    try {
        void secrets;
        const gmail = await getGmailClient();
        if (!gmail)
            return [];
        const query = 'newer_than:30d (vaga OR oportunidade OR recrutador OR entrevista OR candidatura OR "job alert" OR "nova vaga")';
        const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults: 20 });
        const jobs = [];
        for (const item of list.data.messages ?? []) {
            const message = await gmail.users.messages.get({ userId: "me", id: item.id ?? "", format: "full" });
            const headers = message.data.payload?.headers ?? [];
            const subject = headers.find((header) => header.name?.toLowerCase() === "subject")?.value ?? "Alerta de vaga";
            const from = headers.find((header) => header.name?.toLowerCase() === "from")?.value ?? "Gmail";
            const snippet = message.data.snippet ?? "";
            jobs.push({
                externalId: item.id ?? subject,
                title: subject,
                company: from,
                location: "A confirmar",
                source: "gmail",
                url: extractLinks(snippet)[0] ?? "",
                description: snippet,
                raw: { id: item.id, subject, from }
            });
        }
        audit("gmailJobAlerts", "scan", `Alertas Gmail lidos: ${jobs.length}`);
        return jobs;
    }
    catch (error) {
        logError("gmailJobAlerts", error);
        return [];
    }
}
