import fs from "node:fs";
import path from "node:path";
import { NormalizedJob, AgentSettings } from "../../types.js";
import { chooseBaseCv } from "./cvManager.js";
import { realExperienceKeywords } from "./careerProfile.js";

function educationLines(settings: AgentSettings): string {
  return settings.profile.education.degrees.map((degree) => `- ${degree}`).join("\n");
}

export function buildResumeMarkdown(job: NormalizedJob, settings: AgentSettings): string {
  const originalResume = chooseBaseCv(job);
  const vacancyText = `${job.title} ${job.description}`.toLowerCase();
  const matchedKeywords = realExperienceKeywords().filter((keyword) => vacancyText.includes(keyword));

  return `# Referência para candidatura - ${settings.profile.name}

## Vaga alvo
- Cargo: ${job.title}
- Empresa: ${job.company}
- Currículo original obrigatório: ${originalResume}

## Resumo do currículo original
${settings.profile.summary}

## Formação informada no currículo original
${educationLines(settings)}

## Correspondências literais com a vaga
${matchedKeywords.length ? matchedKeywords.map((keyword) => `- ${keyword}`).join("\n") : "- Nenhuma palavra-chave literal identificada; usar o PDF original sem acrescentar competências."}

## Regra de uso
Este arquivo é apenas uma referência de leitura. A candidatura deve anexar o PDF original do perfil e não pode ampliar tempo de experiência, cargos, responsabilidades, formação, idiomas ou competências.
`;
}

export function saveResumeMarkdown(job: NormalizedJob, settings: AgentSettings): string {
  const safeName = `${job.company}-${job.title}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 90);
  const filePath = path.resolve(process.cwd(), "generated/resumes", `${safeName}.md`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buildResumeMarkdown(job, settings), "utf8");
  return filePath;
}
