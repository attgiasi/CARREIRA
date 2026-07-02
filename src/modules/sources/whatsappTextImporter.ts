import fs from "node:fs";
import path from "node:path";
import { RawJob } from "../../types.js";
import { audit } from "../../safety/auditLogger.js";

const jobTerms = /vaga|oportunidade|contrata|contratação|processo seletivo|currículo|curriculo/i;
const informalTerms = /freela|freelancer|bico|taxa|diária|diaria|evento|extra|bartender/i;

function titleFromMessage(message: string): string {
  const compact = message.replace(/\s+/g, " ").trim();
  const firstLine = compact.split(/[.!?]/)[0] ?? compact;
  return firstLine.slice(0, 90) || "Oportunidade via WhatsApp";
}

function linkFromMessage(message: string): string {
  return message.match(/https?:\/\/[^\s")<>]+/i)?.[0] ?? "";
}

export function importWhatsappMessages(): RawJob[] {
  const file = path.resolve(process.cwd(), "data/whatsapp-vagas.txt");
  if (!fs.existsSync(file)) {
    audit("whatsappTextImporter", "scan", "Arquivo data/whatsapp-vagas.txt não encontrado; pulando WhatsApp.");
    return [];
  }

  const chunks = fs.readFileSync(file, "utf8")
    .split(/\r?\n(?=\[?\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{1,2}:\d{2}|- )/g)
    .map((message) => message.trim())
    .filter((message) => message.length > 20 && (jobTerms.test(message) || informalTerms.test(message)));

  const jobs = chunks.map((message, index) => ({
    externalId: `whatsapp-${index}-${Buffer.from(message).toString("base64url").slice(0, 24)}`,
    title: titleFromMessage(message),
    company: "Informado no WhatsApp",
    location: /curitiba|pr|remoto|híbrido|hibrido/i.test(message) ? "Detectado no texto" : "A confirmar",
    source: informalTerms.test(message) ? "whatsapp-informal" : "whatsapp",
    url: linkFromMessage(message),
    description: message,
    raw: { origem: "data/whatsapp-vagas.txt", message }
  }));

  audit("whatsappTextImporter", "scan", `Mensagens de WhatsApp importadas: ${jobs.length}.`);
  return jobs;
}
