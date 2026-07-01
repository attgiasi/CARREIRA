import fs from "node:fs";
import path from "node:path";
import { NormalizedJob, AgentSettings } from "../../types.js";
import { chooseBaseCv } from "./cvManager.js";
import { realExperienceKeywords } from "./careerProfile.js";

export function buildResumeMarkdown(job: NormalizedJob, settings: AgentSettings): string {
  const cv = chooseBaseCv(job);
  const keywords = realExperienceKeywords().filter((keyword) => `${job.title} ${job.description}`.toLowerCase().includes(keyword));
  return `# Currículo direcionado - ${settings.profile.name}

Vaga: ${job.title} - ${job.company}
Currículo base recomendado: ${cv}

## Resumo profissional
${settings.profile.summary}

## Destaques verdadeiros para esta vaga
${keywords.length ? keywords.map((keyword) => `- ${keyword}`).join("\n") : "- Atendimento ao cliente, operação, eventos, padronização e rotina de hospitalidade."}

## Observação de segurança
Este arquivo reorganiza informações reais. Não inventa formação, idiomas, certificações, cargos ou empresas.
`;
}

export function saveResumeMarkdown(job: NormalizedJob, settings: AgentSettings): string {
  const safeName = `${job.company}-${job.title}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 90);
  const filePath = path.resolve(process.cwd(), "generated/resumes", `${safeName}.md`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buildResumeMarkdown(job, settings), "utf8");
  return filePath;
}
