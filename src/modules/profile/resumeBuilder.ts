import fs from "node:fs";
import path from "node:path";
import { NormalizedJob, AgentSettings } from "../../types.js";
import { chooseBaseCv } from "./cvManager.js";
import { realExperienceKeywords } from "./careerProfile.js";

function jobText(job: NormalizedJob): string {
  return `${job.title} ${job.company} ${job.description} ${job.careerTrack}`.toLowerCase();
}

function positioningFor(job: NormalizedJob): { headline: string; bullets: string[]; keywords: string[] } {
  const text = jobText(job);
  if (/customer|success|cx|experi[eê]ncia do cliente|relacionamento|ouvidoria|atendimento|suporte|sac/.test(text)) {
    return {
      headline: "Atendimento, relacionamento e experiência do cliente com repertório real de operação premium.",
      bullets: [
        "Atuação consistente em atendimento direto ao cliente, resolução de demandas, leitura de contexto e condução profissional de experiências de alta exigência.",
        "Vivência em ambientes de ritmo intenso, com necessidade de comunicação clara, priorização, controle emocional e atenção a detalhes.",
        "Capacidade de transformar atendimento em fidelização, combinando cordialidade, organização, escuta ativa e postura consultiva."
      ],
      keywords: ["atendimento ao cliente", "customer experience", "relacionamento", "suporte", "ouvidoria", "escuta ativa", "resolução de demandas", "qualidade no atendimento"]
    };
  }
  if (/backoffice|fraude|risco|opera[cç][aã]o|processo|erp|dados|relat[oó]rio|controle/.test(text)) {
    return {
      headline: "Operação, backoffice e análise com visão prática de processo, risco e experiência do cliente.",
      bullets: [
        "Perfil organizado, atento a padrões, documentos, regras operacionais e consistência de informações.",
        "Experiência prática em rotinas que exigem conferência, padronização, prevenção de falhas e comunicação entre operação e atendimento.",
        "Boa leitura de prioridade, impacto no cliente e melhoria de processo, com base em vivência real de operação e serviço."
      ],
      keywords: ["backoffice", "análise operacional", "controle de processos", "prevenção de falhas", "conferência", "rotina administrativa", "qualidade operacional", "relatórios"]
    };
  }
  if (/gerente|gest[aã]o|supervisor|coordena|lideran[cç]a|comercial|farmer|consultor/.test(text)) {
    return {
      headline: "Liderança operacional, atendimento consultivo e gestão de rotina com foco em resultado e padrão de serviço.",
      bullets: [
        "Experiência liderando rotinas de bar, hospitalidade e atendimento, com treinamento, organização de equipe e padronização de execução.",
        "Postura comercial e consultiva para entender necessidade do cliente, qualificar demanda e sustentar relacionamento.",
        "Capacidade de conduzir operação, priorizar problemas, manter padrão e apoiar pessoas em ambientes de alta pressão."
      ],
      keywords: ["liderança", "gestão operacional", "treinamento", "padronização", "comercial consultivo", "rotina de equipe", "indicadores", "relacionamento"]
    };
  }
  return {
    headline: "Hospitalidade premium, bar, eventos e atendimento de alta performance.",
    bullets: [
      "Mais de 12 anos em hospitalidade, coquetelaria, eventos e atendimento, com domínio de rotina de bar, experiência do cliente e padrão de serviço.",
      "Vivência em casas, restaurantes, hotéis e operações de alto fluxo, com foco em qualidade, agilidade, organização e relacionamento.",
      "Capacidade de unir execução técnica, atendimento elegante, treinamento, padronização e leitura comercial do serviço."
    ],
    keywords: ["hospitalidade", "bartender", "mixologia", "bar manager", "eventos", "treinamento", "padrão de serviço", "experiência do cliente"]
  };
}

function educationLines(settings: AgentSettings): string {
  return settings.profile.education.degrees.map((degree) => `- ${degree}`).join("\n");
}

export function buildResumeMarkdown(job: NormalizedJob, settings: AgentSettings): string {
  const cv = chooseBaseCv(job);
  const positioning = positioningFor(job);
  const matchedKeywords = realExperienceKeywords().filter((keyword) => `${job.title} ${job.description}`.toLowerCase().includes(keyword));
  const atsKeywords = [...new Set([...positioning.keywords, ...matchedKeywords])].slice(0, 18);
  return `# Currículo direcionado - ${settings.profile.name}

## Vaga alvo
- Cargo: ${job.title}
- Empresa: ${job.company}
- Local/modelo: ${job.location} | ${job.workModel}
- Currículo base recomendado: ${cv}

## Headline profissional
${positioning.headline}

## Resumo executivo
${settings.profile.summary}

Profissional com repertório prático para conectar operação, atendimento e experiência do cliente. Perfil confiável para ambientes de alta demanda, com capacidade de organizar rotina, manter padrão, comunicar com clareza, aprender sistemas/processos e representar a empresa com postura profissional.

## Proposta de valor para esta vaga
${positioning.bullets.map((item) => `- ${item}`).join("\n")}

## Destaques verdadeiros para esta vaga
${matchedKeywords.length ? matchedKeywords.map((keyword) => `- Experiência real relacionada a ${keyword}.`).join("\n") : "- Atendimento ao cliente, operação, eventos, padronização e rotina de hospitalidade."}

## Experiência consolidada
- Head Bartender, consultor e líder de operação de bar em hotéis, restaurantes, bares e eventos, com foco em atendimento, padrão de serviço, organização e performance da equipe.
- Atuação em ambientes premium e de alto fluxo, incluindo rotinas de abertura/fechamento, atendimento ao cliente, organização de praça, controle operacional e qualidade de entrega.
- Treinamento, orientação e padronização de equipe para elevar consistência, agilidade, cordialidade e experiência do cliente.
- Interface constante com clientes, fornecedores, equipes internas e liderança, sustentando comunicação clara e postura de solução.

## Competências-chave
- Atendimento consultivo, escuta ativa e relacionamento com cliente.
- Organização operacional, priorização e execução em ambiente de pressão.
- Padronização, treinamento, controle de qualidade e melhoria de rotina.
- Comunicação profissional, senso de dono, confiabilidade e apresentação pessoal.
- Facilidade para aprender sistemas, fluxos, políticas internas e indicadores.

## Formação
${educationLines(settings)}

## Palavras-chave ATS
${atsKeywords.map((keyword) => `- ${keyword}`).join("\n")}

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
