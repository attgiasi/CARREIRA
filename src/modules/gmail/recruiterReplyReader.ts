import { CareerDatabase } from "../../database/db.js";
import { audit, logError } from "../../safety/auditLogger.js";
import { getGmailClient, GmailMessageData, GmailPayload } from "./gmailClient.js";

export const ACTUAL_APPLICATION_SQL = "(a.sent_by_agent = 1 OR a.applied_at IS NOT NULL)";

export interface RecruiterClassification {
  eventType: "rejection" | "advanced" | "interview" | "offer" | "action_required" | "reviewing" | "confirmation" | "other";
  outcome: "positiva" | "negativa" | "sem_retorno";
  stage: number;
  requiresAction: boolean;
  actionSummary: string;
  confidence: number;
}

interface ApplicationCandidate extends Record<string, unknown> {
  application_id: number;
  job_id: number;
  title: string;
  company: string;
  source: string;
  url: string;
  external_id: string;
  pipeline_stage: number;
  pipeline_outcome?: string;
  last_recruiter_email_at?: string;
}

interface ParsedMessage {
  id: string;
  threadId: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  receivedAt: string;
  snippet: string;
  bodyText: string;
  urls: string[];
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(normalize(phrase)));
}

export function classifyRecruiterMessage(subject: string, body: string, snippet = ""): RecruiterClassification {
  const text = normalize(`${subject}\n${snippet}\n${body}`);
  const rejected = includesAny(text, [
    "não foi possível seguir com sua candidatura",
    "nao foi possivel seguir com sua candidatura",
    "não foi selecionado",
    "nao foi selecionado",
    "não avançará no processo",
    "candidatura não avançou",
    "decidimos seguir com outro",
    "seguiremos com outros candidatos",
    "perfil não foi selecionado",
    "processo seletivo foi encerrado para você",
    "application was not selected",
    "unfortunately, we will not be moving forward"
  ]);
  if (rejected) {
    return {
      eventType: "rejection",
      outcome: "negativa",
      stage: 1,
      requiresAction: false,
      actionSummary: "Nenhuma ação obrigatória. A candidatura não avançou.",
      confidence: 0.99
    };
  }

  const hiredOrOffer = includesAny(text, [
    "carta proposta",
    "proposta de contratação",
    "proposta de trabalho",
    "você foi aprovado",
    "voce foi aprovado",
    "processo de admissão",
    "processo de admissao",
    "documentos para contratação",
    "documentos para contratacao",
    "job offer"
  ]);
  if (hiredOrOffer) {
    return {
      eventType: "offer",
      outcome: "positiva",
      stage: 3,
      requiresAction: true,
      actionSummary: "Revisar a proposta ou enviar os documentos solicitados.",
      confidence: 0.96
    };
  }

  const explicitThirdStage = includesAny(text, ["terceira fase", "terceira etapa", "3ª fase", "3ª etapa", "fase final", "etapa final"]);
  const advanced = includesAny(text, [
    "avançou para a próxima fase",
    "avancou para a proxima fase",
    "passou para a próxima etapa",
    "passou para a proxima etapa",
    "selecionado para a próxima etapa",
    "selecionado para a proxima etapa",
    "queremos seguir com seu perfil",
    "move forward with your application"
  ]);
  if (advanced || explicitThirdStage) {
    const explicitInstruction = includesAny(text, [
      "responda este e-mail",
      "responda este email",
      "responda até",
      "responda ate",
      "confirme sua participação",
      "confirme sua participacao",
      "confirme sua presença",
      "confirme sua presenca",
      "escolha um horário",
      "escolha um horario",
      "agende sua entrevista",
      "preencha o formulário",
      "preencha o formulario",
      "envie os documentos",
      "realize o teste"
    ]);
    return {
      eventType: "advanced",
      outcome: "positiva",
      stage: explicitThirdStage ? 3 : 2,
      requiresAction: explicitInstruction,
      actionSummary: explicitInstruction
        ? "Abrir o retorno e concluir a orientação solicitada pelo recrutador."
        : "Nenhuma ação solicitada; aguardar o contato da empresa.",
      confidence: 0.98
    };
  }

  const interview = includesAny(text, [
    "convite para entrevista",
    "entrevista agendada",
    "agendar entrevista",
    "entrevista com gestor",
    "entrevista online",
    "entrevista presencial",
    "assessment",
    "teste para a vaga"
  ]);
  if (interview) {
    return {
      eventType: "interview",
      outcome: "positiva",
      stage: 2,
      requiresAction: true,
      actionSummary: "Confirmar o convite, horário, local ou link da entrevista.",
      confidence: 0.92
    };
  }

  const needsAction = includesAny(text, [
    "complete seu cadastro",
    "complete a candidatura",
    "conclua sua candidatura",
    "concluir sua candidatura",
    "retorne e conclua sua candidatura",
    "rascunho de candidatura",
    "preencha o formulário",
    "preencha o formulario",
    "responda até",
    "confirme sua disponibilidade",
    "envie os documentos",
    "realize o teste"
  ]);
  if (needsAction) {
    return {
      eventType: "action_required",
      outcome: "sem_retorno",
      stage: 1,
      requiresAction: true,
      actionSummary: "Abrir o e-mail e concluir a ação solicitada pelo recrutador.",
      confidence: 0.84
    };
  }

  const reviewing = includesAny(text, [
    "visualizou seu currículo",
    "visualizou seu curriculo",
    "seu perfil está em análise",
    "seu perfil esta em analise",
    "empresa está analisando",
    "recruiter viewed your application"
  ]);
  if (reviewing) {
    return {
      eventType: "reviewing",
      outcome: "sem_retorno",
      stage: 1,
      requiresAction: false,
      actionSummary: "A empresa visualizou ou está analisando o perfil.",
      confidence: 0.82
    };
  }

  const confirmation = includesAny(text, [
    "como é o perfil dos inscritos para a vaga",
    "como e o perfil dos inscritos para a vaga",
    "recebemos sua candidatura",
    "candidatura recebida",
    "candidatura foi enviada",
    "você se candidatou à vaga",
    "voce se candidatou a vaga",
    "application received",
    "application submitted"
  ]);
  if (confirmation) {
    return {
      eventType: "confirmation",
      outcome: "sem_retorno",
      stage: 1,
      requiresAction: false,
      actionSummary: "Candidatura confirmada pela fonte; ainda sem decisão do recrutador.",
      confidence: 0.8
    };
  }

  return { eventType: "other", outcome: "sem_retorno", stage: 1, requiresAction: false, actionSummary: "", confidence: 0 };
}

export function normalizeStoredRecruiterActions(db: CareerDatabase, userId: number): number {
  const genericInfoJobsWhere = `
    user_id = ?
    AND event_type = 'advanced'
    AND (
      LOWER(COALESCE(sender_email, '')) LIKE '%infojobs%'
      OR LOWER(COALESCE(source_platform, '')) LIKE '%infojobs%'
    )
    AND LOWER(COALESCE(subject, '')) LIKE '%avançou para a próxima fase%'
    AND LOWER(COALESCE(action_summary, '')) LIKE 'abrir o retorno e confirmar%'
  `;
  const total = Number(db.query<Record<string, unknown>>(
    `SELECT COUNT(*) AS total FROM recruiter_email_events WHERE ${genericInfoJobsWhere}`,
    [userId]
  )[0]?.total ?? 0);
  if (!total) return 0;

  db.run(
    `UPDATE recruiter_email_events
     SET requires_action = 0,
         action_summary = 'Nenhuma ação solicitada; aguardar o contato da empresa.',
         updated_at = CURRENT_TIMESTAMP
     WHERE ${genericInfoJobsWhere}`,
    [userId]
  );
  db.run(
    `UPDATE applications AS a
     SET next_action = '', updated_at = CURRENT_TIMESTAMP
     WHERE a.user_id = ?
       AND EXISTS (
         SELECT 1
         FROM recruiter_email_events e
         WHERE e.application_id = a.id
           AND e.user_id = a.user_id
           AND e.event_type = 'advanced'
           AND e.requires_action = 0
           AND LOWER(COALESCE(e.action_summary, '')) LIKE 'nenhuma ação solicitada%'
           AND e.id = (
             SELECT latest.id
             FROM recruiter_email_events latest
             WHERE latest.application_id = a.id AND latest.user_id = a.user_id
             ORDER BY datetime(latest.received_at) DESC, latest.id DESC
             LIMIT 1
           )
       )`,
    [userId]
  );
  return total;
}

function decodeBase64Url(value: string): string {
  try {
    return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function collectPayload(payload: GmailPayload | undefined, output: { plain: string[]; html: string[]; urls: Set<string> }): void {
  if (!payload) return;
  const encoded = payload.body?.data;
  if (encoded) {
    const decoded = decodeBase64Url(encoded);
    for (const match of decoded.matchAll(/https?:\/\/[^\s"'<>]+/g)) output.urls.add(match[0].replace(/&amp;/g, "&"));
    if ((payload.mimeType ?? "").includes("text/html")) output.html.push(decodeHtml(decoded));
    if ((payload.mimeType ?? "").includes("text/plain")) output.plain.push(decoded);
  }
  for (const part of payload.parts ?? []) collectPayload(part, output);
}

function header(message: GmailMessageData, name: string): string {
  return message.payload?.headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseSender(value: string): { name: string; email: string } {
  const email = value.match(/<([^>]+)>/)?.[1] ?? value.match(/[\w.+-]+@[\w.-]+/)?.[0] ?? "";
  const name = value.replace(/<[^>]+>/g, "").replace(email, "").replace(/["']/g, "").trim();
  return { name, email };
}

function parseMessage(message: GmailMessageData): ParsedMessage {
  const content = { plain: [] as string[], html: [] as string[], urls: new Set<string>() };
  collectPayload(message.payload, content);
  const sender = parseSender(header(message, "From"));
  return {
    id: String(message.id ?? ""),
    threadId: String(message.threadId ?? ""),
    subject: header(message, "Subject") || "(sem assunto)",
    senderName: sender.name,
    senderEmail: sender.email,
    receivedAt: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : new Date().toISOString(),
    snippet: String(message.snippet ?? ""),
    bodyText: [...content.plain, ...content.html].join("\n").replace(/\s+/g, " ").trim().slice(0, 35_000),
    urls: [...content.urls]
  };
}

function vacancyIds(message: ParsedMessage): string[] {
  const values = [...message.urls, message.bodyText, message.snippet];
  const ids = new Set<string>();
  for (const value of values) {
    for (const match of value.matchAll(/__(\d{6,})(?:\.|\/|\?|$)/g)) ids.add(match[1]);
    for (const match of value.matchAll(/[?&](?:iv|jobId|job_id)=(\d{5,})/gi)) ids.add(match[1]);
  }
  return [...ids];
}

const stopWords = new Set(["para", "vaga", "de", "da", "do", "das", "dos", "em", "uma", "um", "empresa", "processo", "seletivo", "retorno", "voce", "giasi"]);

function tokens(value: string): Set<string> {
  return new Set(normalize(value).split(/[^a-z0-9]+/).filter((item) => item.length >= 3 && !stopWords.has(item)));
}

function overlap(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  const common = [...left].filter((item) => right.has(item)).length;
  return common / Math.max(left.size, right.size);
}

export function recruiterApplicationMatchScore(
  messageTitle: string,
  messageCompany: string,
  applicationTitle: string,
  applicationCompany: string
): number {
  const titleScore = overlap(tokens(messageTitle), tokens(applicationTitle));
  const companyTokens = tokens(messageCompany);
  const companyScore = overlap(companyTokens, tokens(applicationCompany));
  if (companyTokens.size > 0 && companyScore < 0.25) return 0;
  return titleScore * 0.7 + companyScore * 0.3;
}

function messageSignals(message: ParsedMessage): { title: string; company: string } {
  const subjectTitle = message.subject.match(/vaga de\s+(.+?)(?:\.|$)/i)?.[1]?.trim() ?? "";
  const subjectCompany = message.subject.match(/empresa\s+(.+?)(?:\.|$)/i)?.[1]?.trim() ?? "";
  const bodyMatch = message.bodyText.match(/candidat(?:ou|ou-se).*?vaga de\s+(.+?)\s+da empresa\s+(.+?)(?:\.| e viemos|, e viemos)/i);
  const savedDraftMatch = message.bodyText.match(/(?:vaga|cargo)\s+(?:de\s+)?(.+?)\s+na\s+(?:equipe|empresa)\s+(.+?)(?:\.|!|$)/i);
  return {
    title: bodyMatch?.[1]?.trim() || savedDraftMatch?.[1]?.trim() || subjectTitle,
    company: bodyMatch?.[2]?.trim() || savedDraftMatch?.[2]?.trim() || subjectCompany
  };
}

function matchApplication(message: ParsedMessage, applications: ApplicationCandidate[]): { application: ApplicationCandidate | null; confidence: number } {
  const ids = vacancyIds(message);
  for (const id of ids) {
    const exact = applications.find((item) => String(item.url ?? "").includes(id) || String(item.external_id ?? "").includes(id));
    if (exact) return { application: exact, confidence: 1 };
  }
  const signals = messageSignals(message);
  const titleTokens = tokens(signals.title || message.subject);
  const companyTokens = tokens(signals.company);
  let best: ApplicationCandidate | null = null;
  let bestScore = 0;
  for (const item of applications) {
    const score = recruiterApplicationMatchScore(
      [...titleTokens].join(" "),
      [...companyTokens].join(" "),
      String(item.title ?? ""),
      String(item.company ?? "")
    );
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return bestScore >= 0.62 ? { application: best, confidence: bestScore } : { application: null, confidence: bestScore };
}

function sourceFromMessage(message: ParsedMessage): string {
  const text = `${message.senderEmail} ${message.urls.join(" ")}`.toLowerCase();
  if (text.includes("infojobs")) return "InfoJobs";
  if (text.includes("linkedin")) return "LinkedIn";
  if (text.includes("indeed")) return "Indeed";
  if (text.includes("gupy")) return "Gupy";
  if (text.includes("vagas.com")) return "Vagas.com";
  if (text.includes("hilton")) return "Hilton";
  if (text.includes("marriott")) return "Marriott";
  if (text.includes("smartrecruiters")) return "SmartRecruiters";
  if (text.includes("pandape")) return "Pandapé";
  return message.senderName || message.senderEmail || "Gmail";
}

function directVacancyUrl(message: ParsedMessage, id: string): string {
  const candidate = message.urls.find((value) => value.includes(id) && /vaga-de|\/jobs?\//i.test(value));
  if (!candidate) return "";
  try {
    const url = new URL(candidate.replace(/&amp;/g, "&"));
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return candidate;
  }
}

function createApplicationFromRecruiterMessage(
  db: CareerDatabase,
  userId: number,
  message: ParsedMessage,
  classification: RecruiterClassification
): ApplicationCandidate | null {
  const pendingAction = classification.eventType === "action_required";
  if (!pendingAction && !["rejection", "advanced", "interview", "offer"].includes(classification.eventType)) return null;
  const vacancyId = vacancyIds(message)[0] ?? "";
  const signals = messageSignals(message);
  const directUrl = vacancyId ? directVacancyUrl(message, vacancyId) : "";
  const url = directUrl || (pendingAction ? `https://mail.google.com/mail/u/0/#all/${message.id}` : "");
  if (!url || !signals.title) return null;
  const source = sourceFromMessage(message);
  const sourceId = source.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const externalId = `gmail-${pendingAction ? "action" : "confirmed"}-${sourceId}-${vacancyId || message.id}`;
  const company = signals.company || source || "Empresa identificada pelo Gmail";
  const jobStatus = pendingAction ? "Ação necessária" : "Candidatada";
  const description = pendingAction
    ? "Candidatura iniciada no site da empresa, mas ainda não enviada. O Gmail solicitou a conclusão do cadastro."
    : "Candidatura confirmada por retorno do recrutador no Gmail.";
  db.run(
    `INSERT OR IGNORE INTO jobs (
      user_id, external_id, title, company, location, source, url, description, salary,
      work_model, fit_score, hire_chance_score, job_quality_score, risk_score, status, raw_json
    ) VALUES (?, ?, ?, ?, 'A confirmar', ?, ?, ?, 'Não informado', 'A confirmar', 70, 50, 65, 10, ?, ?)`,
    [
      userId,
      externalId,
      signals.title,
      company,
      source,
      url,
      description,
      jobStatus,
      JSON.stringify({
        importedFrom: pendingAction ? "gmail_action_required" : "gmail_recruiter_decision",
        gmailMessageId: message.id,
        vacancyId
      })
    ]
  );
  const job = db.query<Record<string, unknown>>("SELECT id FROM jobs WHERE user_id = ? AND external_id = ? LIMIT 1", [userId, externalId])[0];
  if (!job) return null;
  const jobId = Number(job.id);
  let application = db.query<Record<string, unknown>>("SELECT id FROM applications WHERE user_id = ? AND job_id = ? LIMIT 1", [userId, jobId])[0];
  if (!application) {
    if (pendingAction) {
      db.run(
        `INSERT INTO applications (
          user_id, job_id, created_at, updated_at, application_status, approval_status,
          sent_by_agent, source_platform, pipeline_stage, pipeline_outcome, recruiter_status, next_action
        ) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Candidatura incompleta', 'aprovado_pelo_usuario',
          0, ?, 1, 'sem_retorno', 'Ação encontrada no Gmail', ?)`,
        [userId, jobId, source, classification.actionSummary]
      );
    } else {
      db.run(
        `INSERT INTO applications (
          user_id, job_id, created_at, updated_at, applied_at, application_status,
          approval_status, sent_by_agent, source_platform, pipeline_stage, pipeline_outcome, recruiter_status
        ) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, 'Candidatura confirmada pelo Gmail',
          'confirmada_por_email', 0, ?, 1, 'sem_retorno', 'Retorno encontrado no Gmail')`,
        [userId, jobId, message.receivedAt, source]
      );
    }
    application = db.query<Record<string, unknown>>("SELECT id FROM applications WHERE user_id = ? AND job_id = ? LIMIT 1", [userId, jobId])[0];
  }
  if (!application) return null;
  return {
    application_id: Number(application.id),
    job_id: jobId,
    title: signals.title,
    company,
    source,
    url,
    external_id: externalId,
    pipeline_stage: 1
  };
}

function timestamp(value: string): number {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(" ", "T")}Z` : value;
  return Date.parse(normalized);
}

export function incrementalGmailStartDate(applicationDates: string[], previousCompletedAt = "", lookbackDays = 2): string {
  const timestamps = applicationDates.map(timestamp).filter(Number.isFinite);
  const earliestApplication = timestamps.length ? Math.min(...timestamps) - 86_400_000 : Date.now() - 365 * 86_400_000;
  const previousSync = timestamp(previousCompletedAt);
  const incrementalStart = Number.isFinite(previousSync) ? previousSync - Math.max(1, lookbackDays) * 86_400_000 : earliestApplication;
  const start = Math.max(earliestApplication, incrementalStart);
  return new Date(start).toISOString().slice(0, 10).replace(/-/g, "/");
}

function searchStartDate(applications: ApplicationCandidate[], previousCompletedAt = ""): string {
  return incrementalGmailStartDate(
    applications.map((item) => String(item.applied_at ?? "")).filter(Boolean),
    previousCompletedAt
  );
}

async function listMessageIds(query: string): Promise<{ client: NonNullable<Awaited<ReturnType<typeof getGmailClient>>>; ids: string[] } | null> {
  const client = await getGmailClient();
  if (!client) return null;
  const ids: string[] = [];
  let pageToken = "";
  do {
    const response = await client.users.messages.list({ userId: "me", q: query, maxResults: 500, pageToken: pageToken || undefined });
    ids.push(...(response.data.messages ?? []).map((item) => String(item.id ?? "")).filter(Boolean));
    pageToken = response.data.nextPageToken ?? "";
  } while (pageToken && ids.length < 500);
  return { client, ids: ids.slice(0, 500) };
}

function unseenMessageIds(db: CareerDatabase, userId: number, ids: string[]): string[] {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  const eventIds = db.query<Record<string, unknown>>(
    `SELECT gmail_message_id FROM recruiter_email_events WHERE user_id = ? AND gmail_message_id IN (${placeholders})`,
    [userId, ...ids]
  );
  const cachedIds = db.query<Record<string, unknown>>(
    `SELECT gmail_message_id FROM gmail_message_scan_cache WHERE user_id = ? AND gmail_message_id IN (${placeholders})`,
    [userId, ...ids]
  );
  const seen = new Set([...eventIds, ...cachedIds].map((row) => String(row.gmail_message_id ?? "")).filter(Boolean));
  return ids.filter((id) => !seen.has(id));
}

function rememberScannedMessage(
  db: CareerDatabase,
  userId: number,
  messageId: string,
  eventType: RecruiterClassification["eventType"],
  applicationId?: number
): void {
  db.run(
    `INSERT INTO gmail_message_scan_cache (user_id, gmail_message_id, event_type, matched_application_id, scanned_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, gmail_message_id) DO UPDATE SET
       event_type = excluded.event_type,
       matched_application_id = excluded.matched_application_id,
       scanned_at = CURRENT_TIMESTAMP`,
    [userId, messageId, eventType, applicationId ?? null]
  );
}

function updateApplicationFromEvent(db: CareerDatabase, application: ApplicationCandidate, classification: RecruiterClassification, receivedAt: string): void {
  const previousStage = Number(application.pipeline_stage ?? 1);
  const resolvedStage = classification.eventType === "rejection" ? previousStage : Math.max(previousStage, classification.stage);
  if (classification.eventType === "confirmation") {
    db.run(
      "UPDATE applications SET recruiter_status = COALESCE(recruiter_status, ?), last_recruiter_email_at = COALESCE(last_recruiter_email_at, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ["Candidatura confirmada pela fonte", receivedAt, Number(application.application_id)]
    );
    if (!application.last_recruiter_email_at) application.last_recruiter_email_at = receivedAt;
    return;
  }
  const status = classification.eventType === "rejection"
    ? "Não selecionado"
    : classification.eventType === "offer"
      ? "Selecionado / proposta recebida"
      : resolvedStage >= 3
        ? "Avançou para a 3ª fase"
        : resolvedStage >= 2
          ? "Avançou para a 2ª fase"
          : classification.requiresAction
            ? "Ação solicitada pelo recrutador"
            : "Em análise pelo recrutador";
  db.run(
    `UPDATE applications
     SET pipeline_stage = ?, pipeline_outcome = ?, recruiter_status = ?, application_status = ?,
         last_recruiter_email_at = ?, next_action = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      resolvedStage,
      classification.outcome,
      status,
      status,
      receivedAt,
      classification.requiresAction ? classification.actionSummary : "",
      Number(application.application_id)
    ]
  );
  application.pipeline_stage = resolvedStage;
  application.pipeline_outcome = classification.outcome;
  application.last_recruiter_email_at = receivedAt;
}

export async function syncRecruiterReplies(db: CareerDatabase, userId: number): Promise<{ scanned: number; matched: number; inserted: number; connected: boolean }> {
  const applications = db.query<ApplicationCandidate>(`
    SELECT a.id as application_id, a.job_id, a.applied_at, a.pipeline_stage, a.pipeline_outcome, a.last_recruiter_email_at,
           j.title, j.company, j.source, j.url, j.external_id
    FROM applications a
    LEFT JOIN jobs j ON j.id = a.job_id
    WHERE a.user_id = ? AND ${ACTUAL_APPLICATION_SQL}
  `, [userId]);
  if (!applications.length) return { scanned: 0, matched: 0, inserted: 0, connected: true };

  const previousCompletedAt = String(db.query<Record<string, unknown>>(
    "SELECT completed_at FROM gmail_sync_runs WHERE user_id = ? AND status = 'concluido' ORDER BY id DESC LIMIT 1",
    [userId]
  )[0]?.completed_at ?? "");
  db.run("INSERT INTO gmail_sync_runs (user_id, status) VALUES (?, 'executando')", [userId]);
  const syncId = Number(db.query<Record<string, unknown>>("SELECT MAX(id) as id FROM gmail_sync_runs WHERE user_id = ?", [userId])[0]?.id ?? 0);
  try {
    const start = searchStartDate(applications, previousCompletedAt);
    const query = `after:${start} -in:sent -in:drafts -in:spam -in:trash {candidatura \"processo seletivo\" entrevista \"próxima fase\" \"próxima etapa\" selecionado recrutamento}`;
    const listed = await listMessageIds(query);
    if (!listed) throw new Error("Gmail não conectado. Renove a autorização do agente de e-mail.");
    const messageIds = unseenMessageIds(db, userId, listed.ids);
    const parsed: ParsedMessage[] = [];
    for (let index = 0; index < messageIds.length; index += 8) {
      const batch = messageIds.slice(index, index + 8);
      const messages = await Promise.all(batch.map(async (id) => (await listed.client.users.messages.get({ userId: "me", id, format: "full" })).data));
      parsed.push(...messages.map(parseMessage));
    }
    parsed.sort((left, right) => Date.parse(left.receivedAt) - Date.parse(right.receivedAt));

    let matched = 0;
    let inserted = 0;
    for (const message of parsed) {
      const classification = classifyRecruiterMessage(message.subject, message.bodyText, message.snippet);
      if (classification.eventType === "other") {
        rememberScannedMessage(db, userId, message.id, classification.eventType);
        continue;
      }
      let match = matchApplication(message, applications);
      if (!match.application) {
        const created = createApplicationFromRecruiterMessage(db, userId, message, classification);
        if (created) {
          applications.push(created);
          match = { application: created, confidence: 1 };
        }
      }
      if (!match.application) {
        rememberScannedMessage(db, userId, message.id, classification.eventType);
        continue;
      }
      matched += 1;
      const existing = db.query<Record<string, unknown>>(
        "SELECT id FROM recruiter_email_events WHERE user_id = ? AND gmail_message_id = ? LIMIT 1",
        [userId, message.id]
      )[0];
      const resolvedStage = classification.eventType === "rejection"
        ? Number(match.application.pipeline_stage ?? 1)
        : Math.max(Number(match.application.pipeline_stage ?? 1), classification.stage);
      const signals = messageSignals(message);
      db.run(
        `INSERT INTO recruiter_email_events (
          user_id, application_id, job_id, gmail_message_id, gmail_thread_id, received_at,
          sender_name, sender_email, subject, event_type, pipeline_stage, outcome,
          requires_action, action_summary, action_url, job_title, company, source_platform,
          confidence, excerpt, raw_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, gmail_message_id) DO UPDATE SET
          application_id = excluded.application_id,
          job_id = excluded.job_id,
          event_type = excluded.event_type,
          pipeline_stage = excluded.pipeline_stage,
          outcome = excluded.outcome,
          requires_action = excluded.requires_action,
          action_summary = excluded.action_summary,
          action_url = excluded.action_url,
          confidence = excluded.confidence,
          updated_at = CURRENT_TIMESTAMP`,
        [
          userId,
          Number(match.application.application_id),
          Number(match.application.job_id),
          message.id,
          message.threadId,
          message.receivedAt,
          message.senderName,
          message.senderEmail,
          message.subject,
          classification.eventType,
          resolvedStage,
          classification.outcome,
          Number(classification.requiresAction),
          classification.actionSummary,
          `https://mail.google.com/mail/u/0/#all/${message.id}`,
          signals.title || String(match.application.title ?? ""),
          signals.company || String(match.application.company ?? ""),
          String(match.application.source ?? ""),
          Math.min(1, Math.max(classification.confidence, match.confidence)),
          `${message.subject} — ${message.snippet}`.slice(0, 600),
          JSON.stringify({ vacancyIds: vacancyIds(message), matchedBy: match.confidence === 1 ? "vacancy_id" : "title_company" })
        ]
      );
      if (!existing) inserted += 1;
      updateApplicationFromEvent(db, match.application, { ...classification, stage: resolvedStage }, message.receivedAt);
      rememberScannedMessage(db, userId, message.id, classification.eventType, Number(match.application.application_id));
    }
    db.run(`
      UPDATE applications
      SET last_recruiter_email_at = (
        SELECT MAX(e.received_at)
        FROM recruiter_email_events e
        WHERE e.application_id = applications.id AND e.event_type <> 'confirmation'
      )
      WHERE user_id = ? AND EXISTS (
        SELECT 1 FROM recruiter_email_events e
        WHERE e.application_id = applications.id AND e.event_type <> 'confirmation'
      )
    `, [userId]);
    db.run(
      "UPDATE gmail_sync_runs SET completed_at = CURRENT_TIMESTAMP, status = 'concluido', scanned_messages = ?, matched_messages = ?, inserted_events = ? WHERE id = ?",
      [parsed.length, matched, inserted, syncId]
    );
    audit("recruiterReplyReader", "sync", `Gmail sincronizado: ${parsed.length} mensagens, ${matched} retornos vinculados, ${inserted} novos eventos.`);
    return { scanned: parsed.length, matched, inserted, connected: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    db.run("UPDATE gmail_sync_runs SET completed_at = CURRENT_TIMESTAMP, status = 'erro', error_message = ? WHERE id = ?", [message, syncId]);
    logError("recruiterReplyReader", error, { userId });
    throw error;
  }
}

export function getRecruiterPipelineMetrics(db: CareerDatabase, userId: number): Record<string, unknown> {
  const actual = Number(db.query<Record<string, unknown>>(`SELECT COUNT(*) as total FROM applications a WHERE a.user_id = ? AND ${ACTUAL_APPLICATION_SQL}`, [userId])[0]?.total ?? 0);
  const selected = Number(db.query<Record<string, unknown>>(`SELECT COUNT(*) as total FROM applications a WHERE a.user_id = ? AND ${ACTUAL_APPLICATION_SQL} AND COALESCE(a.pipeline_stage, 1) >= 2 AND COALESCE(a.pipeline_outcome, '') <> 'negativa'`, [userId])[0]?.total ?? 0);
  const rejected = Number(db.query<Record<string, unknown>>(`SELECT COUNT(*) as total FROM applications a WHERE a.user_id = ? AND ${ACTUAL_APPLICATION_SQL} AND a.pipeline_outcome = 'negativa'`, [userId])[0]?.total ?? 0);
  const stage3 = Number(db.query<Record<string, unknown>>(`SELECT COUNT(*) as total FROM applications a WHERE a.user_id = ? AND ${ACTUAL_APPLICATION_SQL} AND COALESCE(a.pipeline_stage, 1) >= 3 AND COALESCE(a.pipeline_outcome, '') <> 'negativa'`, [userId])[0]?.total ?? 0);
  const actions = Number(db.query<Record<string, unknown>>(`
    SELECT COUNT(*) as total
    FROM recruiter_email_events e
    JOIN applications a ON a.id = e.application_id
    WHERE e.user_id = ?
      AND a.user_id = ?
      AND ${ACTUAL_APPLICATION_SQL}
      AND e.requires_action = 1
      AND COALESCE(a.pipeline_outcome, '') <> 'negativa'
      AND e.id = (
        SELECT latest.id
        FROM recruiter_email_events latest
        WHERE latest.user_id = e.user_id AND latest.application_id = e.application_id
        ORDER BY datetime(latest.received_at) DESC, latest.id DESC
        LIMIT 1
      )
  `, [userId, userId])[0]?.total ?? 0);
  const pending = Math.max(0, actual - selected - rejected);
  const stage2Negative = Number(db.query<Record<string, unknown>>(`SELECT COUNT(*) as total FROM applications a WHERE a.user_id = ? AND ${ACTUAL_APPLICATION_SQL} AND COALESCE(a.pipeline_stage, 1) = 2 AND a.pipeline_outcome = 'negativa'`, [userId])[0]?.total ?? 0);
  const stage3Negative = Number(db.query<Record<string, unknown>>(`SELECT COUNT(*) as total FROM applications a WHERE a.user_id = ? AND ${ACTUAL_APPLICATION_SQL} AND COALESCE(a.pipeline_stage, 1) >= 3 AND a.pipeline_outcome = 'negativa'`, [userId])[0]?.total ?? 0);
  return {
    actual,
    selected,
    rejected,
    pending,
    stage2: selected,
    stage3,
    actions,
    responseRate: actual ? Math.round(((selected + rejected) / actual) * 1000) / 10 : 0,
    phase1: { total: actual, positive: selected, negative: rejected, waiting: pending },
    phase2: { total: selected, positive: stage3, negative: stage2Negative, waiting: Math.max(0, selected - stage3 - stage2Negative) },
    phase3: { total: stage3, positive: 0, negative: stage3Negative, waiting: Math.max(0, stage3 - stage3Negative) }
  };
}
