import fs from "node:fs";
import path from "node:path";
export function generateCoverLetter(job, settings) {
    return `Olá, tudo bem?

Me chamo ${settings.profile.name}. Tenho mais de 12 anos de experiência em hospitalidade, coquetelaria, atendimento ao cliente, eventos, gestão de operação de bar, treinamento e padronização.

Tenho interesse na oportunidade de ${job.title} na ${job.company}, pois ela conversa com minha experiência prática em operação, atendimento e rotina de alta demanda. Fico à disposição para conversar e entender melhor os próximos passos.

Atenciosamente,
${settings.profile.name}`;
}
export function saveCoverLetter(job, settings) {
    const safeName = `${job.company}-${job.title}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 90);
    const filePath = path.resolve(process.cwd(), "generated/cover-letters", `${safeName}.md`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, generateCoverLetter(job, settings), "utf8");
    return filePath;
}
