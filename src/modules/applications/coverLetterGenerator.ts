import fs from "node:fs";
import path from "node:path";
import { AgentSettings, NormalizedJob } from "../../types.js";

function pitchFor(job: NormalizedJob): string {
  const text = `${job.title} ${job.description} ${job.careerTrack}`.toLowerCase();
  if (/customer|success|cx|relacionamento|ouvidoria|atendimento|suporte|sac/.test(text)) {
    return "Minha experiência em atendimento, hospitalidade e operação me treinou para ouvir bem, entender contexto rapidamente, comunicar com clareza e transformar contato com cliente em experiência consistente.";
  }
  if (/backoffice|fraude|risco|opera[cç][aã]o|processo|erp|dados|controle/.test(text)) {
    return "Minha experiência inclui padronização de processos, melhoria contínua do atendimento, controle operacional e comunicação clara, sempre com foco na experiência do cliente.";
  }
  if (/gerente|gest[aã]o|supervisor|coordena|lideran[cç]a|comercial|farmer|consultor/.test(text)) {
    return "Minha trajetória reúne liderança operacional, treinamento, atendimento consultivo e visão prática de negócio. Sei conduzir rotina, apoiar pessoas, priorizar problemas e manter padrão de entrega.";
  }
  return "Minha trajetória em hospitalidade, coquetelaria, eventos e atendimento me deu repertório técnico, agilidade, postura profissional e leitura de cliente para atuar em ambientes de alta exigência.";
}

export function generateCoverLetter(job: NormalizedJob, settings: AgentSettings): string {
  return `Olá, tudo bem?

Me chamo ${settings.profile.name}. Tenho sólida experiência em atendimento, hospitalidade e operação, com atuação em experiência do cliente, desenvolvimento de equipes, treinamento e padronização de processos.

Tenho interesse na oportunidade de ${job.title} na ${job.company}, pois ela conversa diretamente com minha experiência prática em operação, atendimento, relacionamento e rotina de alta demanda.

${pitchFor(job)}

Posso contribuir com comunicação assertiva, escuta ativa, organização, resolução estratégica de demandas e foco em experiência do cliente. Tenho facilidade para aprender processos e atuar com consistência em contextos que exigem atenção e agilidade.

Fico à disposição para conversar e mostrar como minha vivência pode gerar valor para a equipe.

Atenciosamente,
${settings.profile.name}`;
}

export function saveCoverLetter(job: NormalizedJob, settings: AgentSettings): string {
  const safeName = `${job.company}-${job.title}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 90);
  const filePath = path.resolve(process.cwd(), "generated/cover-letters", `${safeName}.md`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, generateCoverLetter(job, settings), "utf8");
  return filePath;
}
