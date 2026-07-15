import { NormalizedJob } from "../../types.js";
import fs from "node:fs";
import path from "node:path";

function existingResume(preferred: string, aliases: string[]): string {
  const folder = path.resolve(process.cwd(), "resumes");
  if (!fs.existsSync(folder)) return preferred;
  const files = fs.readdirSync(folder);
  const exact = files.find((file) => file.toLowerCase() === path.basename(preferred).toLowerCase());
  if (exact) return `resumes/${exact}`;
  const match = files.find((file) => aliases.some((alias) => file.toLowerCase().includes(alias)));
  if (match) return `resumes/${match}`;
  const original = files.find((file) => /(original|hospitalidade)/i.test(file) && /\.(pdf|docx?|md)$/i.test(file));
  if (original) return `resumes/${original}`;
  const anyResume = files.find((file) => /\.(pdf|docx?|md)$/i.test(file) && file.toLowerCase() !== "readme.md");
  return anyResume ? `resumes/${anyResume}` : preferred;
}

export function chooseBaseCv(job: Pick<NormalizedJob, "careerTrack" | "title" | "description">): string {
  const text = `${job.careerTrack} ${job.title} ${job.description}`.toLowerCase();
  if (/fraude|risco|backoffice|contestação|operacional/.test(text)) return existingResume("resumes/cv-prevencao.pdf", ["prevencao", "prevenção", "fraude", "backoffice"]);
  if (/supervis|coordena|gerente|gestão|liderança/.test(text)) return existingResume("resumes/cv-gestao.pdf", ["gestao", "gestão", "lideranca", "liderança"]);
  if (/sac|atendimento|customer|cliente|suporte|cx|cs/.test(text)) return existingResume("resumes/cv-atendimento.pdf", ["atendimento", "cliente", "customer"]);
  return existingResume("resumes/cv-hospitalidade.pdf", ["hospitalidade", "bar", "bartender"]);
}
