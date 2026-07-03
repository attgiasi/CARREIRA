import { AgentSettings } from "../../types.js";

export interface CandidateProfile {
  id: number;
  label?: string;
  name: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  city?: string;
  state?: string;
  country?: string;
  summary?: string;
  resume_file?: string;
}

export interface MemoryAnswer extends Record<string, unknown> {
  question_key: string;
  answer_text: string;
}

export interface ApplicationQuestion {
  key: string;
  question: string;
  category: string;
  fieldType: "text" | "textarea" | "select";
}

export interface AutomationDecision {
  status: string;
  message: string;
  nextStep: string;
  questions: ApplicationQuestion[];
  filledFields: Record<string, string>;
  canAutofill: boolean;
  canSubmitAutomatically: boolean;
}

const assistedSources = new Set([
  "google-assisted-search",
  "sine",
  "infojobs",
  "jobs99",
  "rh-agencies-curitiba",
  "linkedin-search",
  "indeed-search",
  "vagascom-search",
  "catho-search",
  "netvagas-search",
  "bne-search",
  "trabalhabrasil-search",
  "glassdoor-search",
  "empregos-search"
]);

function memoryValue(memory: MemoryAnswer[], key: string): string {
  return memory.find((item) => item.question_key === key)?.answer_text?.trim() ?? "";
}

function addIfMissing(questions: ApplicationQuestion[], value: string | undefined, question: ApplicationQuestion): void {
  if (!String(value ?? "").trim()) questions.push(question);
}

function sourceIsLinkedIn(source: string, url: string): boolean {
  return source === "linkedin-search" || /linkedin\.com\/jobs/i.test(url);
}

function submitIsAllowed(settings: AgentSettings): boolean {
  const applications = settings.applications as Record<string, unknown>;
  return Boolean(applications.autoApply && applications.allowQuickApplyAPIs);
}

export function decideAutomation(
  row: Record<string, unknown>,
  profile: CandidateProfile,
  memory: MemoryAnswer[],
  settings: AgentSettings
): AutomationDecision {
  const source = String(row.source ?? "");
  const url = String(row.url ?? "");
  const title = String(row.title ?? "vaga");
  const company = String(row.company ?? "empresa");
  const questions: ApplicationQuestion[] = [];

  addIfMissing(questions, profile.name, {
    key: "profile.name",
    question: "Qual nome completo devo usar nas candidaturas deste perfil?",
    category: "Identidade",
    fieldType: "text"
  });
  addIfMissing(questions, profile.email, {
    key: "profile.email",
    question: "Qual e-mail devo usar para este perfil de candidatura?",
    category: "Contato",
    fieldType: "text"
  });
  addIfMissing(questions, profile.phone, {
    key: "profile.phone",
    question: "Qual telefone com DDD devo preencher nas vagas?",
    category: "Contato",
    fieldType: "text"
  });
  addIfMissing(questions, memoryValue(memory, "availability.start"), {
    key: "availability.start",
    question: "Qual sua disponibilidade padrão para início?",
    category: "Disponibilidade",
    fieldType: "text"
  });
  addIfMissing(questions, memoryValue(memory, "salary.expectation.default"), {
    key: "salary.expectation.default",
    question: "Qual pretensão salarial padrão devo usar quando a vaga pedir?",
    category: "Salário",
    fieldType: "text"
  });
  addIfMissing(questions, memoryValue(memory, "work.authorization.br"), {
    key: "work.authorization.br",
    question: "Posso responder que você tem autorização para trabalhar no Brasil?",
    category: "Elegibilidade",
    fieldType: "select"
  });

  const filledFields: Record<string, string> = {
    "Nome completo": profile.name ?? "",
    "E-mail": profile.email ?? "",
    "Telefone": profile.phone ?? "",
    "LinkedIn": profile.linkedin ?? "",
    "Cidade": profile.city ?? "",
    "Estado": profile.state ?? "",
    "País": profile.country ?? "Brasil",
    "Resumo profissional": profile.summary ?? "",
    "Currículo base": profile.resume_file ?? String(row.generated_resume_path ?? ""),
    "Carta de apresentação": String(row.cover_letter_path ?? ""),
    "Disponibilidade": memoryValue(memory, "availability.start"),
    "Pretensão salarial": memoryValue(memory, "salary.expectation.default"),
    "Autorização para trabalhar": memoryValue(memory, "work.authorization.br")
  };

  if (questions.length) {
    return {
      status: "precisa_informacao",
      message: `Faltam ${questions.length} informação(ões) para preencher a candidatura de ${title}.`,
      nextStep: "Responda no painel. O agente salva na memória deste perfil e reaproveita nas próximas vagas.",
      questions,
      filledFields,
      canAutofill: false,
      canSubmitAutomatically: false
    };
  }

  if (!url) {
    return {
      status: "precisa_canal",
      message: `A vaga ${title} ainda não tem link ou e-mail oficial de candidatura.`,
      nextStep: "Confirme o canal oficial antes de enviar currículo ou dados pessoais.",
      questions: [],
      filledFields,
      canAutofill: false,
      canSubmitAutomatically: false
    };
  }

  if (sourceIsLinkedIn(source, url)) {
    return {
      status: "linkedin_manual",
      message: "LinkedIn será usado apenas para localizar a vaga.",
      nextStep: "Abra o LinkedIn manualmente, revise a vaga e aplique pela sua conta. O agente mantém currículo, carta e respostas prontos.",
      questions: [],
      filledFields,
      canAutofill: false,
      canSubmitAutomatically: false
    };
  }

  if (assistedSources.has(source)) {
    return {
      status: "precisa_vaga_real",
      message: "Esta entrada ainda é uma busca assistida, não o formulário real da vaga.",
      nextStep: "Abra a fonte, escolha a vaga específica e importe o link real para o agente preencher com precisão.",
      questions: [],
      filledFields,
      canAutofill: false,
      canSubmitAutomatically: false
    };
  }

  if (!submitIsAllowed(settings)) {
    return {
      status: "autofill_pronto",
      message: `Pacote de preenchimento pronto para ${title} na ${company}.`,
      nextStep: "Abra a fonte oficial. O agente já sabe quais dados preencher; o envio final continua dependendo de permissão da plataforma e confirmação.",
      questions: [],
      filledFields,
      canAutofill: true,
      canSubmitAutomatically: false
    };
  }

  return {
    status: "auto_apply_pronto",
    message: `Candidatura pronta para envio automático permitido em ${company}.`,
    nextStep: "Executar somente se a plataforma permitir API/quick apply, sem CAPTCHA e sem ação proibida.",
    questions: [],
    filledFields,
    canAutofill: true,
    canSubmitAutomatically: true
  };
}
