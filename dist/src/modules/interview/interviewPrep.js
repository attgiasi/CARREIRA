import fs from "node:fs";
import path from "node:path";
import { companyBriefing } from "./companyBriefing.js";
import { likelyQuestions } from "./questionPrep.js";
export function createInterviewPrep(job, settings) {
    const content = `# Preparação de entrevista - ${job.title}

${companyBriefing(job)}

## Apresentação pessoal
Sou ${settings.profile.name}, com experiência consolidada em hospitalidade, eventos, atendimento ao cliente, gestão de bar, treinamento e padronização.

## Perguntas prováveis
${likelyQuestions().map((question) => `- ${question}`).join("\n")}

## Perguntas inteligentes para o recrutador
- Como é medida a qualidade do atendimento nesta função?
- Quais são os principais desafios dos primeiros 90 dias?
- Como funcionam escala, benefícios, metas e possibilidades de crescimento?
`;
    const file = path.resolve(process.cwd(), "generated/reports", `entrevista-${job.company}-${job.title}.md`.replace(/[^a-z0-9./\\-]+/gi, "-"));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf8");
    return file;
}
