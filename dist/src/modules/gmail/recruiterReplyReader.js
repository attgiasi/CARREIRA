import { audit } from "../../safety/auditLogger.js";
export async function readRecruiterReplies() {
    audit("recruiterReplyReader", "scan", "Leitura de respostas depende do Gmail configurado.");
    return 0;
}
