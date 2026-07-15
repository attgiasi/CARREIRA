import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CareerDatabase } from "../../database/db.js";
import { loadSettings } from "../../config/settings.js";
import { exportSettings, importSettings, SettingsExportScope } from "../../config/portableSettings.js";
import { hasGmailSecrets, refreshSecrets, secrets } from "../../config/secrets.js";
import { normalizeJob } from "../jobs/normalizer.js";
import { attachDuplicateMetadata, countDuplicateGroups } from "../jobs/duplicateDetector.js";
import { buildApplicationPacket } from "../applications/applicationBuilder.js";
import { enqueueApplication } from "../applications/approvalQueue.js";
import { CandidateProfile, decideAutomation, MemoryAnswer } from "../applications/autoApplyEngine.js";
import { AgentSettings } from "../../types.js";
import { buildSalaryAnalytics, parseBaseSalary, sourceDisplayName } from "./analytics.js";
import { getGmailConnectionStatus, gmailProtectedRetryAfter, gmailRetryAfterFromError, isGmailRateLimitError } from "../gmail/gmailClient.js";
import { ACTUAL_APPLICATION_SQL, getRecruiterPipelineMetrics, normalizeStoredRecruiterActions } from "../gmail/recruiterReplyReader.js";
import { syncCareerGmail } from "../gmail/careerGmailSync.js";
import {
  clearSessionCookie,
  createSession,
  currentUser,
  currentUserId,
  getAuthUser,
  hashPassword,
  normalizeEmail,
  publicUser,
  requireAuth,
  revokeCurrentSession,
  userCount,
  validatePassword,
  verifyPassword
} from "../auth/auth.js";

export const apiRouter = Router();
const execFileAsync = promisify(execFile);
const envPath = path.resolve(process.cwd(), ".env");
const allowedResumeExtensions = new Set([".pdf", ".doc", ".docx", ".txt", ".md"]);

function safeFileName(value: string): string {
  const parsed = path.parse(value);
  const extension = parsed.ext.toLowerCase();
  if (!allowedResumeExtensions.has(extension)) throw new Error("Envie currículo em PDF, DOC, DOCX, TXT ou MD.");
  const base = parsed.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "curriculo";
  return `${base}${extension}`;
}

function ensureUserResumeFolder(userId: number): string {
  const root = process.env.STORAGE_ROOT?.trim()
    ? path.resolve(process.env.STORAGE_ROOT, "resumes", "users")
    : path.resolve(process.cwd(), "resumes", "users");
  const folder = path.join(root, String(userId));
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

function vaultKey(): Buffer | null {
  let raw = secrets.accountVaultKey || process.env.ACCOUNT_VAULT_KEY || "";
  if (!raw && process.env.NODE_ENV !== "production") {
    raw = crypto.randomBytes(32).toString("base64url");
    writeEnvValues({ ACCOUNT_VAULT_KEY: raw });
    process.env.ACCOUNT_VAULT_KEY = raw;
    refreshSecrets();
  }
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest();
}

function encryptSecret(value: string): string {
  const key = vaultKey();
  if (!key) throw new Error("Configure ACCOUNT_VAULT_KEY no ambiente antes de salvar senhas de sites.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptSecret(value: string): string {
  const key = vaultKey();
  if (!key || !value.startsWith("v1:")) return "";
  const [, ivRaw, tagRaw, encryptedRaw] = value.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8");
}

function assignLegacyDataToUser(db: CareerDatabase, userId: number): void {
  for (const table of ["jobs", "informal_opportunities", "candidate_profiles", "applications", "answer_memory", "application_attempts"]) {
    db.run(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL OR user_id = 1`, [userId]);
  }
}

function activeGmailBackoff(db: CareerDatabase, userId: number): string {
  const latest = db.query<Record<string, unknown>>(
    "SELECT status, error_message, completed_at FROM gmail_sync_runs WHERE user_id = ? ORDER BY id DESC LIMIT 1",
    [userId]
  )[0];
  if (String(latest?.status ?? "") !== "erro") return "";
  const retryAfter = gmailProtectedRetryAfter(latest?.error_message ?? "", String(latest?.completed_at ?? ""));
  return Date.parse(retryAfter) > Date.now() ? retryAfter : "";
}

function loadUserSettings(db: CareerDatabase, userId: number): AgentSettings {
  const row = db.query<Record<string, unknown>>("SELECT settings_json FROM user_settings WHERE user_id = ? LIMIT 1", [userId])[0];
  if (row?.settings_json) return JSON.parse(String(row.settings_json)) as AgentSettings;
  const settings = loadSettings();
  db.run("INSERT OR REPLACE INTO user_settings (user_id, settings_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)", [userId, JSON.stringify(settings)]);
  return settings;
}

function saveUserSettings(db: CareerDatabase, userId: number, settings: AgentSettings): void {
  db.run(
    "INSERT OR REPLACE INTO user_settings (user_id, settings_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
    [userId, JSON.stringify(settings)]
  );
}

function readEnvMap(): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(envPath)) return map;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) map.set(match[1], match[2]);
  }
  return map;
}

function writeEnvValues(values: Record<string, string | undefined>): void {
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8").split(/\r?\n/) : [];
  const pending = new Map(Object.entries(values).filter(([, value]) => value !== undefined) as Array<[string, string]>);
  const used = new Set<string>();
  const next = existing
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const match = line.match(/^([A-Z0-9_]+)=/);
      if (!match || !pending.has(match[1])) return line;
      used.add(match[1]);
      return `${match[1]}=${pending.get(match[1]) ?? ""}`;
    });
  for (const [key, value] of pending.entries()) {
    if (!used.has(key)) next.push(`${key}=${value}`);
  }
  fs.writeFileSync(envPath, `${next.join("\n")}\n`, "utf8");
}

function parseHttpUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  const parsed = new URL(raw);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Use um link http ou https.");
  return parsed.toString();
}

function isGoogleSearchUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    return host.startsWith("google.") && (url.pathname.includes("/search") || url.searchParams.has("q") || url.searchParams.has("udm"));
  } catch {
    return false;
  }
}

function manualJobFromUrl(url: string, body: Record<string, unknown> = {}) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  return {
    externalId: `manual-${url}`,
    title: String(body.title ?? `Vaga real importada: ${host}`),
    company: String(body.company ?? host),
    location: String(body.location ?? "A confirmar"),
    source: String(body.source ?? "manual-real-job"),
    url,
    description: String(body.description ?? `Link oficial importado pelo painel para candidatura real: ${url}`),
    salary: String(body.salary ?? ""),
    raw: { url, importedAt: new Date().toISOString(), importedFrom: "dashboard", body }
  };
}

function envStatus() {
  const envMap = readEnvMap();
  return {
    envExists: fs.existsSync(envPath),
    openaiConfigured: Boolean(secrets.openaiApiKey),
    openaiModel: secrets.openaiModel,
    geminiConfigured: Boolean(secrets.geminiApiKey),
    geminiModel: secrets.geminiModel,
    googleSearchConfigured: Boolean(secrets.googleSearchApiKey && secrets.googleSearchEngineId),
    gmailConfigured: hasGmailSecrets(),
    accountVaultConfigured: Boolean(secrets.accountVaultKey || process.env.ACCOUNT_VAULT_KEY),
    databaseUrl: secrets.databaseUrl,
    port: String(secrets.dashboardPort),
    nodeEnv: process.env.NODE_ENV ?? "development",
    managedExternally: process.env.NODE_ENV === "production",
    envKeys: [...envMap.keys()].filter((key) => !key.includes("KEY") && !key.includes("TOKEN") && !key.includes("SECRET"))
  };
}

function boolNumber(value: unknown): number {
  return value ? 1 : 0;
}

function profileFromRow(row: Record<string, unknown>): CandidateProfile {
  return {
    id: Number(row.id),
    label: String(row.label ?? ""),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    linkedin: String(row.linkedin ?? ""),
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    country: String(row.country ?? ""),
    summary: String(row.summary ?? ""),
    resume_file: String(row.resume_file ?? "")
  };
}

function ensureDefaultCandidateProfile(db: CareerDatabase, userId: number): void {
  const count = db.query("SELECT COUNT(*) as total FROM candidate_profiles WHERE user_id = ?", [userId])[0]?.total ?? 0;
  if (Number(count) > 0) return;
  db.run(
    `INSERT INTO candidate_profiles (
      user_id, label, name, email, phone, linkedin, city, state, country, summary, resume_file, is_active, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      userId,
      "Perfil sem dados",
      "Novo perfil",
      "",
      "",
      "",
      "",
      "",
      "Brasil",
      "",
      "",
      JSON.stringify({ onboarding: true, needsResume: true })
    ]
  );
}

function getActiveCandidateProfile(db: CareerDatabase, userId: number): CandidateProfile {
  ensureDefaultCandidateProfile(db, userId);
  const row = db.query<Record<string, unknown>>("SELECT * FROM candidate_profiles WHERE user_id = ? AND is_active = 1 ORDER BY id LIMIT 1", [userId])[0]
    ?? db.query<Record<string, unknown>>("SELECT * FROM candidate_profiles WHERE user_id = ? ORDER BY id LIMIT 1", [userId])[0];
  return profileFromRow(row);
}

function applicationStatusForDecision(status: string): string {
  const labels: Record<string, string> = {
    precisa_informacao: "Aguardando resposta do usuário",
    precisa_canal: "Aguardando canal de candidatura",
    precisa_vaga_real: "Aguardando vaga real da fonte",
    linkedin_manual: "LinkedIn manual",
    linkedin_assistido: "Preenchimento do LinkedIn pronto",
    autofill_pronto: "Preenchimento automático pronto",
    auto_apply_pronto: "Candidatura automática pronta"
  };
  return labels[status] ?? status;
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
  "empregos-search",
  "solides-search",
  "abler-search",
  "pandape-search"
]);

function channelForApplication(row: Record<string, unknown>): { id: string; label: string; priority: "alta" | "media" | "baixa" } {
  const source = String(row.source ?? "");
  const url = String(row.url ?? "").toLowerCase();
  const text = [row.description, row.notes, row.application_status, source].join(" ").toLowerCase();
  if (url.startsWith("mailto:") || /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(text)) return { id: "email", label: "Enviar por e-mail", priority: "media" };
  if (url.includes("mail.google.com")) return { id: "email", label: "Abrir solicitação no Gmail", priority: "alta" };
  if (url.includes("wa.me") || url.includes("whatsapp") || text.includes("whatsapp")) return { id: "whatsapp", label: "Contato por WhatsApp", priority: "media" };
  if (url.startsWith("tel:") || text.includes("telefone") || text.includes("ligar")) return { id: "telefone", label: "Contato por telefone", priority: "media" };
  if (source.includes("linkedin") || url.includes("linkedin.com")) return { id: "manual", label: "Você faz no site", priority: "media" };
  if (!url || assistedSources.has(source)) return { id: "precisa_link", label: "Precisa link real", priority: "alta" };
  if (String(row.application_status ?? "") === "Aguardando resposta do usuário") return { id: "dados", label: "Faltam dados", priority: "alta" };
  return { id: "ia", label: "Candidatura por IA", priority: "alta" };
}

async function checkUrlAvailability(url: string): Promise<"aberta" | "fechada" | "indefinida"> {
  if (!url) return "indefinida";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    let response = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    }
    if ([404, 410].includes(response.status)) return "fechada";
    if (response.status >= 200 && response.status < 500) return "aberta";
    return "indefinida";
  } catch {
    return "indefinida";
  } finally {
    clearTimeout(timeout);
  }
}

async function runAutomationForApplications(userId: number, ids: number[], mode: string, approveBeforeRun = false) {
  const db = await CareerDatabase.open();
  const settings = loadUserSettings(db, userId);
  const profile = getActiveCandidateProfile(db, userId);
  const memory = db.query<MemoryAnswer>(
    "SELECT question_key, answer_text FROM answer_memory WHERE user_id = ? AND user_profile_id = ?",
    [userId, profile.id]
  );
  const placeholders = ids.map(() => "?").join(",");

  if (approveBeforeRun) {
    db.run(
      `UPDATE applications
       SET approval_status = ?, application_status = ?, user_profile_id = COALESCE(user_profile_id, ?),
           updated_at = CURRENT_TIMESTAMP,
           notes = COALESCE(notes, '') || ?
       WHERE user_id = ? AND id IN (${placeholders})`,
      [
        "aprovado_pelo_usuario",
        "Aprovada para candidatura por IA",
        profile.id,
        `\nCandidatura por IA autorizada pelo usuário em ${new Date().toISOString()}.`,
        userId,
        ...ids
      ]
    );
  }

  const rows = db.query<Record<string, unknown>>(`
    SELECT
      a.*,
      j.title,
      j.company,
      j.source,
      j.url,
      j.salary,
      j.location,
      j.work_model,
      j.description,
      j.driver_license_required,
      j.own_vehicle_required
    FROM applications a
    LEFT JOIN jobs j ON j.id = a.job_id
    WHERE a.user_id = ? AND a.id IN (${placeholders})
  `, [userId, ...ids]);

  const actions: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const id = Number(row.id);
    if (String(row.approval_status ?? "") !== "aprovado_pelo_usuario") {
      actions.push({
        id,
        status: "bloqueada",
        message: "A candidatura precisa ser aprovada antes da IA preparar o envio.",
        nextStep: "Aprove a vaga e clique em Candidatar com IA novamente."
      });
      continue;
    }
    const decision = decideAutomation(row, profile, memory, settings);
    const applicationStatus = applicationStatusForDecision(decision.status);
    db.run(
      `UPDATE applications
       SET application_status = ?, automation_mode = ?, user_profile_id = ?, last_attempt_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP, notes = COALESCE(notes, '') || ?
       WHERE id = ? AND user_id = ?`,
      [
        applicationStatus,
        mode,
        profile.id,
        `\n${mode}: ${decision.status}. ${decision.message}`,
        id,
        userId
      ]
    );
    db.run(
      `INSERT INTO application_attempts (
        user_id, application_id, user_profile_id, mode, status, result_message, missing_questions_json, filled_fields_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        id,
        profile.id,
        mode,
        decision.status,
        decision.message,
        JSON.stringify(decision.questions),
        JSON.stringify(decision.filledFields)
      ]
    );
    for (const key of Object.keys(decision.filledFields)) {
      db.run(
        "UPDATE answer_memory SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND user_profile_id = ? AND question_key = ?",
        [userId, profile.id, key]
      );
    }
    actions.push({
      id,
      profileId: profile.id,
      profileName: profile.name,
      status: decision.status,
      message: decision.message,
      nextStep: decision.nextStep,
      questions: decision.questions,
      filledFields: decision.filledFields,
      canAutofill: decision.canAutofill,
      canSubmitAutomatically: decision.canSubmitAutomatically,
      url: row.url
    });
  }

  return { actions, profile };
}

apiRouter.get("/auth/me", async (req, res) => {
  const db = await CareerDatabase.open();
  const user = await getAuthUser(req);
  const users = Number(db.query("SELECT COUNT(*) as total FROM users")[0]?.total ?? 0);
  const publicRegistration = process.env.ALLOW_PUBLIC_REGISTRATION === "true";
  res.json({
    authenticated: Boolean(user),
    user,
    registrationOpen: users === 0 || publicRegistration,
    users
  });
});

apiRouter.post("/auth/register", async (req, res) => {
  const db = await CareerDatabase.open();
  const totalBefore = await userCount(db);
  if (totalBefore > 0 && process.env.ALLOW_PUBLIC_REGISTRATION !== "true") {
    res.status(403).json({ error: "Novos cadastros estão fechados. Solicite acesso ao administrador." });
    return;
  }
  const name = String(req.body?.name ?? "").trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? "");
  if (!name || !email) {
    res.status(400).json({ error: "Informe nome e e-mail." });
    return;
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    res.status(400).json({ error: passwordError });
    return;
  }
  const existing = db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email])[0];
  if (existing) {
    res.status(409).json({ error: "Já existe uma conta com este e-mail." });
    return;
  }
  const role = totalBefore === 0 ? "admin" : "user";
  db.run(
    "INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'active')",
    [name, email, hashPassword(password), role]
  );
  const user = db.query<Record<string, unknown>>("SELECT * FROM users WHERE email = ? LIMIT 1", [email])[0];
  const userId = Number(user.id);
  if (totalBefore === 0) assignLegacyDataToUser(db, userId);
  ensureDefaultCandidateProfile(db, userId);
  await createSession(db, userId, req, res);
  res.status(201).json({ ok: true, user: publicUser(user) });
});

apiRouter.post("/auth/login", async (req, res) => {
  const db = await CareerDatabase.open();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? "");
  const user = db.query<Record<string, unknown>>("SELECT * FROM users WHERE email = ? AND status = 'active' LIMIT 1", [email])[0];
  if (!user || !verifyPassword(password, String(user.password_hash ?? ""))) {
    res.status(401).json({ error: "E-mail ou senha inválidos." });
    return;
  }
  db.run("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [Number(user.id)]);
  await createSession(db, Number(user.id), req, res);
  res.json({ ok: true, user: publicUser(user) });
});

apiRouter.post("/auth/logout", async (req, res) => {
  await revokeCurrentSession(req);
  clearSessionCookie(res);
  res.json({ ok: true });
});

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true, status: "online", time: new Date().toISOString(), environment: envStatus() });
});

apiRouter.use(requireAuth);

apiRouter.get("/summary", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  normalizeStoredRecruiterActions(db, userId);
  ensureDefaultCandidateProfile(db, userId);
  const jobs = db.query("SELECT COUNT(*) as total FROM jobs WHERE user_id = ?", [userId])[0]?.total ?? 0;
  const availableJobs = db.query(`
    SELECT COUNT(*) as total
    FROM jobs j
    LEFT JOIN applications a ON a.job_id = j.id AND a.user_id = ?
    WHERE j.user_id = ? AND a.id IS NULL
  `, [userId, userId])[0]?.total ?? 0;
  const gold = db.query("SELECT COUNT(*) as total FROM jobs WHERE user_id = ? AND status = 'Vaga Ouro' AND source NOT IN ('google-assisted-search', 'sine', 'infojobs', 'jobs99', 'rh-agencies-curitiba', 'linkedin-search', 'indeed-search', 'vagascom-search', 'catho-search', 'netvagas-search', 'bne-search', 'trabalhabrasil-search', 'glassdoor-search', 'empregos-search', 'solides-search', 'abler-search', 'pandape-search')", [userId])[0]?.total ?? 0;
  const applications = db.query("SELECT COUNT(*) as total FROM applications WHERE user_id = ?", [userId])[0]?.total ?? 0;
  const awaitingApproval = db.query("SELECT COUNT(*) as total FROM applications WHERE user_id = ? AND approval_status = 'aguardando_aprovacao'", [userId])[0]?.total ?? 0;
  const approved = db.query(`
    SELECT COUNT(*) as total
    FROM applications
    WHERE user_id = ?
      AND approval_status = 'aprovado_pelo_usuario'
      AND sent_by_agent = 0
      AND COALESCE(application_status, '') <> 'Candidatura enviada'
  `, [userId])[0]?.total ?? 0;
  const rejected = db.query("SELECT COUNT(*) as total FROM applications WHERE user_id = ? AND approval_status = 'rejeitado_pelo_usuario'", [userId])[0]?.total ?? 0;
  const sent = db.query("SELECT COUNT(*) as total FROM applications WHERE user_id = ? AND (application_status = 'Candidatura enviada' OR sent_by_agent = 1)", [userId])[0]?.total ?? 0;
  const waitingRealJob = db.query("SELECT COUNT(*) as total FROM applications WHERE user_id = ? AND application_status = 'Aguardando vaga real da fonte'", [userId])[0]?.total ?? 0;
  const ready = db.query(`
    SELECT COUNT(*) as total
    FROM applications
    WHERE user_id = ? AND application_status IN ('Pronta para envio assistido', 'Preenchimento automático pronto', 'Candidatura automática pronta')
  `, [userId])[0]?.total ?? 0;
  const pendingInformation = db.query("SELECT COUNT(*) as total FROM applications WHERE user_id = ? AND application_status = 'Aguardando resposta do usuário'", [userId])[0]?.total ?? 0;
  const actionItems = db.query(`
    SELECT COUNT(*) as total
    FROM applications
    WHERE user_id = ?
      AND sent_by_agent = 0
      AND COALESCE(approval_status, '') = 'aprovado_pelo_usuario'
  `, [userId])[0]?.total ?? 0;
  const informal = db.query("SELECT COUNT(*) as total FROM informal_opportunities WHERE user_id = ?", [userId])[0]?.total ?? 0;
  const profiles = db.query("SELECT COUNT(*) as total FROM candidate_profiles WHERE user_id = ?", [userId])[0]?.total ?? 0;
  const memoryAnswers = db.query("SELECT COUNT(*) as total FROM answer_memory WHERE user_id = ?", [userId])[0]?.total ?? 0;
  const bySource = db.query("SELECT source, COUNT(*) as total FROM jobs WHERE user_id = ? GROUP BY source ORDER BY total DESC LIMIT 8", [userId]);
  const byWorkModel = db.query("SELECT COALESCE(work_model, 'A confirmar') as work_model, COUNT(*) as total FROM jobs WHERE user_id = ? GROUP BY work_model ORDER BY total DESC LIMIT 6", [userId]);
  const byApplicationStatus = db.query("SELECT COALESCE(application_status, 'Sem status') as status, COUNT(*) as total FROM applications WHERE user_id = ? GROUP BY application_status ORDER BY total DESC LIMIT 8", [userId]);
  const duplicateGroups = countDuplicateGroups(db.query("SELECT title, company, location, source, url FROM jobs WHERE user_id = ?", [userId]));
  const lastFoundAt = db.query("SELECT MAX(found_at) as value FROM jobs WHERE user_id = ?", [userId])[0]?.value ?? "";
  const lastAppliedAt = db.query("SELECT MAX(applied_at) as value FROM applications WHERE user_id = ? AND applied_at IS NOT NULL", [userId])[0]?.value ?? "";
  const topJobs = db.query(`
    SELECT title, company, source, fit_score, risk_score, status
    FROM jobs
    WHERE user_id = ?
      AND source NOT IN ('google-assisted-search', 'sine', 'infojobs', 'jobs99', 'rh-agencies-curitiba', 'linkedin-search', 'indeed-search', 'vagascom-search', 'catho-search', 'netvagas-search', 'bne-search', 'trabalhabrasil-search', 'glassdoor-search', 'empregos-search', 'solides-search', 'abler-search', 'pandape-search')
    ORDER BY fit_score DESC, job_quality_score DESC, risk_score ASC
    LIMIT 5
  `, [userId]);
  const newestJobs = db.query(`
    SELECT j.title, j.company, j.source, j.location, j.work_model, j.fit_score, j.risk_score, j.found_at
    FROM jobs j
    LEFT JOIN applications a ON a.job_id = j.id AND a.user_id = ?
    WHERE j.user_id = ? AND a.id IS NULL
    ORDER BY j.id DESC
    LIMIT 5
  `, [userId, userId]);
  const pipeline = getRecruiterPipelineMetrics(db, userId);
  const salaryRows = db.query<Record<string, unknown>>("SELECT salary FROM jobs WHERE user_id = ?", [userId]);
  const salary = buildSalaryAnalytics(salaryRows, 3000);
  const recentRecruiterEvents = db.query<Record<string, unknown>>(`
    SELECT e.*, j.title, j.company, j.source, j.url
    FROM recruiter_email_events e
    LEFT JOIN jobs j ON j.id = e.job_id
    WHERE e.user_id = ? AND e.event_type <> 'confirmation'
    ORDER BY datetime(e.received_at) DESC, e.id DESC
    LIMIT 8
  `, [userId]);
  const recruiterActions = db.query<Record<string, unknown>>(`
    WITH ranked_actions AS (
      SELECT e.*,
             ROW_NUMBER() OVER (
               PARTITION BY e.application_id
               ORDER BY datetime(e.received_at) DESC, e.id DESC
             ) as event_rank
      FROM recruiter_email_events e
      WHERE e.user_id = ?
    )
    SELECT a.id as application_id, latest.action_summary as next_action,
           latest.received_at as last_recruiter_email_at, a.pipeline_stage,
           j.id as job_id, j.title, j.company, j.source,
           COALESCE(NULLIF(latest.action_url, ''), j.url) as url
    FROM applications a
    LEFT JOIN jobs j ON j.id = a.job_id
    JOIN ranked_actions latest ON latest.application_id = a.id AND latest.event_rank = 1
    WHERE a.user_id = ?
      AND ${ACTUAL_APPLICATION_SQL}
      AND latest.requires_action = 1
      AND COALESCE(a.pipeline_outcome, '') <> 'negativa'
    ORDER BY datetime(latest.received_at) DESC
    LIMIT 8
  `, [userId, userId]);
  const lastGmailSync = db.query<Record<string, unknown>>(`
    SELECT started_at, completed_at, status, scanned_messages, matched_messages, inserted_events, error_message
    FROM gmail_sync_runs
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 1
  `, [userId])[0] ?? null;
  const activityTrend = db.query<Record<string, unknown>>(`
    WITH RECURSIVE days(day) AS (
      SELECT date('now', '-13 days')
      UNION ALL
      SELECT date(day, '+1 day') FROM days WHERE day < date('now')
    )
    SELECT
      day,
      (
        SELECT COUNT(*) FROM applications a
        WHERE a.user_id = ? AND ${ACTUAL_APPLICATION_SQL} AND date(a.applied_at) = days.day
      ) as applications,
      (
        SELECT COUNT(*) FROM recruiter_email_events e
        WHERE e.user_id = ? AND e.event_type <> 'confirmation' AND date(e.received_at) = days.day
      ) as replies
    FROM days
  `, [userId, userId]);
  const momentumCounts = db.query<Record<string, unknown>>(`
    SELECT
      SUM(CASE WHEN datetime(a.applied_at) >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as applications_7d,
      SUM(CASE WHEN datetime(a.applied_at) >= datetime('now', '-30 days') THEN 1 ELSE 0 END) as applications_30d
    FROM applications a
    WHERE a.user_id = ? AND ${ACTUAL_APPLICATION_SQL}
  `, [userId])[0] ?? {};
  const replyMomentum = db.query<Record<string, unknown>>(`
    SELECT
      SUM(CASE WHEN event_type <> 'confirmation' AND datetime(received_at) >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as replies_7d,
      SUM(CASE WHEN outcome = 'positiva' AND datetime(received_at) >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as positive_7d,
      SUM(CASE WHEN outcome = 'negativa' AND datetime(received_at) >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as negative_7d,
      COUNT(DISTINCT application_id) as linked_applications
    FROM recruiter_email_events
    WHERE user_id = ?
  `, [userId])[0] ?? {};
  const responseLag = Number(db.query<Record<string, unknown>>(`
    SELECT ROUND(AVG(julianday(first_reply.received_at) - julianday(a.applied_at)), 1) as value
    FROM applications a
    JOIN (
      SELECT application_id, MIN(received_at) as received_at
      FROM recruiter_email_events
      WHERE user_id = ? AND event_type <> 'confirmation'
      GROUP BY application_id
    ) first_reply ON first_reply.application_id = a.id
    WHERE a.user_id = ? AND a.applied_at IS NOT NULL
  `, [userId, userId])[0]?.value ?? 0);
  const actualApplications = Number(pipeline.actual ?? 0);
  const answeredApplications = Number(pipeline.selected ?? 0) + Number(pipeline.rejected ?? 0);
  const momentum = {
    applications7d: Number(momentumCounts.applications_7d ?? 0),
    applications30d: Number(momentumCounts.applications_30d ?? 0),
    replies7d: Number(replyMomentum.replies_7d ?? 0),
    positive7d: Number(replyMomentum.positive_7d ?? 0),
    negative7d: Number(replyMomentum.negative_7d ?? 0),
    positiveRate: answeredApplications ? Math.round((Number(pipeline.selected ?? 0) / answeredApplications) * 1000) / 10 : 0,
    emailCoverage: actualApplications ? Math.round((Number(replyMomentum.linked_applications ?? 0) / actualApplications) * 1000) / 10 : 0,
    averageFirstReplyDays: Math.max(0, responseLag)
  };
  res.json({
    jobs,
    availableJobs,
    gold,
    applications,
    awaitingApproval,
    approved,
    rejected,
    sent,
    waitingRealJob,
    ready,
    pendingInformation,
    actionItems,
    informal,
    profiles,
    memoryAnswers,
    duplicateGroups,
    bySource,
    byWorkModel,
    byApplicationStatus,
    topJobs,
    newestJobs,
    lastFoundAt,
    lastAppliedAt,
    pipeline,
    salary,
    recentRecruiterEvents,
    recruiterActions,
    lastGmailSync,
    activityTrend,
    momentum,
    environment: envStatus()
  });
});

apiRouter.get("/gmail/status", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  const lastSync = db.query<Record<string, unknown>>(`
    SELECT started_at, completed_at, status, scanned_messages, matched_messages, inserted_events, error_message
    FROM gmail_sync_runs WHERE user_id = ? ORDER BY id DESC LIMIT 1
  `, [userId])[0] ?? null;
  const retryAfter = activeGmailBackoff(db, userId);
  const connection = retryAfter && hasGmailSecrets()
    ? {
        connected: true,
        email: "",
        messagesTotal: 0,
        rateLimited: true,
        retryAfter,
        warning: "Conta autorizada. O Google aplicou uma pausa temporária por excesso de leituras; o Ápice tentará novamente automaticamente."
      }
    : await getGmailConnectionStatus();
  res.json({ ...connection, lastSync, automaticEveryMinutes: Number(process.env.GMAIL_SYNC_INTERVAL_MINUTES || 30) });
});

apiRouter.post("/gmail/sync", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  const activeRetryAfter = activeGmailBackoff(db, userId);
  if (activeRetryAfter) {
    res.status(429).json({
      ok: false,
      connected: true,
      rateLimited: true,
      retryAfter: activeRetryAfter,
      error: `Gmail conectado. Aguarde até ${activeRetryAfter}; o Ápice retomará automaticamente sem novo login.`
    });
    return;
  }
  try {
    const result = await syncCareerGmail(db, userId);
    res.json({ ok: true, ...result });
  } catch (error) {
    if (isGmailRateLimitError(error)) {
      const retryAfter = gmailRetryAfterFromError(error);
      res.status(429).json({
        ok: false,
        connected: true,
        rateLimited: true,
        retryAfter,
        error: `Gmail conectado, mas o Google aplicou uma pausa temporária${retryAfter ? ` até ${retryAfter}` : ""}. O Ápice tentará novamente automaticamente.`
      });
      return;
    }
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

apiRouter.get("/email-events", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  const events = db.query<Record<string, unknown>>(`
    SELECT e.*, j.title, j.company, j.source, j.url
    FROM recruiter_email_events e
    LEFT JOIN jobs j ON j.id = e.job_id
    WHERE e.user_id = ?
    ORDER BY datetime(e.received_at) DESC, e.id DESC
    LIMIT 100
  `, [userId]);
  res.json({ events });
});

apiRouter.get("/returns", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  const applications = db.query<Record<string, unknown>>(`
    WITH ranked_events AS (
      SELECT e.*,
             ROW_NUMBER() OVER (
               PARTITION BY e.application_id
               ORDER BY datetime(e.received_at) DESC, e.id DESC
             ) as event_rank,
             COUNT(*) OVER (PARTITION BY e.application_id) as event_count
      FROM recruiter_email_events e
      WHERE e.user_id = ?
    )
    SELECT
      a.id as application_id,
      a.job_id,
      a.application_status,
      a.applied_at,
      a.pipeline_stage,
      a.pipeline_outcome,
      a.recruiter_status,
      a.last_recruiter_email_at,
      a.next_action,
      COALESCE(a.source_platform, j.source) as source,
      j.title,
      j.company,
      j.url,
      j.salary,
      j.location,
      j.work_model,
      j.fit_score,
      j.hire_chance_score,
      latest.id as latest_event_id,
      latest.gmail_message_id,
      latest.received_at as latest_email_at,
      latest.sender_name as latest_sender_name,
      latest.sender_email as latest_sender_email,
      latest.subject as latest_subject,
      latest.event_type as latest_event_type,
      latest.outcome as latest_event_outcome,
      latest.requires_action as latest_requires_action,
      latest.action_summary as latest_action_summary,
      latest.action_url as latest_email_url,
      latest.excerpt as latest_excerpt,
      COALESCE(latest.event_count, 0) as email_count
    FROM applications a
    LEFT JOIN jobs j ON j.id = a.job_id
    LEFT JOIN ranked_events latest
      ON latest.application_id = a.id AND latest.event_rank = 1
    WHERE a.user_id = ? AND ${ACTUAL_APPLICATION_SQL}
    ORDER BY datetime(COALESCE(latest.received_at, a.applied_at, a.created_at)) DESC, a.id DESC
    LIMIT 500
  `, [userId, userId]);
  const events = db.query<Record<string, unknown>>(`
    SELECT e.*, j.title, j.company, j.source, j.url, a.applied_at
    FROM recruiter_email_events e
    LEFT JOIN jobs j ON j.id = e.job_id
    LEFT JOIN applications a ON a.id = e.application_id
    WHERE e.user_id = ?
    ORDER BY datetime(e.received_at) DESC, e.id DESC
    LIMIT 500
  `, [userId]);
  res.json({
    applications,
    events,
    pipeline: getRecruiterPipelineMetrics(db, userId)
  });
});

apiRouter.get("/sources", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  const jobsBySource = db.query<Record<string, unknown>>("SELECT id, source, salary, fit_score FROM jobs WHERE user_id = ?", [userId]);
  const applicationsBySource = db.query<Record<string, unknown>>(`
    SELECT a.id, a.pipeline_stage, a.pipeline_outcome,
           COALESCE((
             SELECT e.requires_action
             FROM recruiter_email_events e
             WHERE e.user_id = a.user_id AND e.application_id = a.id
             ORDER BY datetime(e.received_at) DESC, e.id DESC
             LIMIT 1
           ), 0) as latest_requires_action,
           COALESCE(a.source_platform, j.source) as source, j.salary
    FROM applications a
    LEFT JOIN jobs j ON j.id = a.job_id
    WHERE a.user_id = ? AND ${ACTUAL_APPLICATION_SQL}
  `, [userId]);
  const metrics = new Map<string, Record<string, number | string>>();
  const ensure = (source: unknown) => {
    const name = sourceDisplayName(source);
    if (!metrics.has(name)) metrics.set(name, {
      source: name,
      jobs: 0,
      applications: 0,
      selected: 0,
      rejected: 0,
      pending: 0,
      actions: 0,
      salaryInformed: 0,
      salaryAtOrAboveTarget: 0,
      fitTotal: 0
    });
    return metrics.get(name)!;
  };
  for (const row of jobsBySource) {
    const item = ensure(row.source);
    item.jobs = Number(item.jobs) + 1;
    item.fitTotal = Number(item.fitTotal) + Number(row.fit_score ?? 0);
    const salary = parseBaseSalary(row.salary);
    if (salary.informed && salary.monthly) item.salaryInformed = Number(item.salaryInformed) + 1;
    if (salary.informed && salary.monthly && salary.minimum >= 3000) item.salaryAtOrAboveTarget = Number(item.salaryAtOrAboveTarget) + 1;
  }
  for (const row of applicationsBySource) {
    const item = ensure(row.source);
    item.applications = Number(item.applications) + 1;
    const stage = Number(row.pipeline_stage ?? 1);
    const outcome = String(row.pipeline_outcome ?? "sem_retorno");
    if (stage >= 2 && outcome !== "negativa") item.selected = Number(item.selected) + 1;
    else if (outcome === "negativa") item.rejected = Number(item.rejected) + 1;
    else item.pending = Number(item.pending) + 1;
    if (Number(row.latest_requires_action ?? 0) === 1 && outcome !== "negativa") item.actions = Number(item.actions) + 1;
  }
  const sources = [...metrics.values()].map((item) => ({
    ...item,
    averageFit: Number(item.jobs) ? Math.round(Number(item.fitTotal) / Number(item.jobs)) : 0,
    responseRate: Number(item.applications)
      ? Math.round(((Number(item.selected) + Number(item.rejected)) / Number(item.applications)) * 1000) / 10
      : 0
  })) as Array<Record<string, number | string>>;
  sources.sort((left, right) => Number(right.applications) - Number(left.applications) || Number(right.jobs) - Number(left.jobs));
  const agencyFile = path.resolve(process.cwd(), "data/rh-agencies-curitiba.json");
  const agencies = fs.existsSync(agencyFile) ? JSON.parse(fs.readFileSync(agencyFile, "utf8")) : [];
  res.json({
    sources,
    agencies,
    focus: [
      "Bartender sênior, head bartender, chefe e supervisor de bar",
      "Atendimento e experiência do cliente em hospitalidade de alto padrão",
      "Gestão de A&B, treinamento e consultoria de bares e restaurantes"
    ],
    minimumBaseSalary: 3000
  });
});

apiRouter.get("/profiles", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  ensureDefaultCandidateProfile(db, userId);
  const profiles = db.query(`
    SELECT
      p.*,
      (SELECT COUNT(*) FROM answer_memory m WHERE m.user_profile_id = p.id) as memory_count,
      (SELECT COUNT(*) FROM applications a WHERE a.user_profile_id = p.id) as applications_count
    FROM candidate_profiles p
    WHERE p.user_id = ?
    ORDER BY p.is_active DESC, p.id ASC
  `, [userId]);
  res.json({ profiles, active: profiles.find((profile) => Number(profile.is_active) === 1) ?? profiles[0] });
});

apiRouter.post("/profiles", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "Informe o nome do perfil." });
    return;
  }
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  ensureDefaultCandidateProfile(db, userId);
  if (body.is_active) db.run("UPDATE candidate_profiles SET is_active = 0 WHERE user_id = ?", [userId]);
  db.run(
    `INSERT INTO candidate_profiles (
      user_id, label, name, email, phone, linkedin, city, state, country, summary, resume_file, is_active, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      String(body.label ?? name),
      name,
      String(body.email ?? ""),
      String(body.phone ?? ""),
      String(body.linkedin ?? ""),
      String(body.city ?? ""),
      String(body.state ?? ""),
      String(body.country ?? "Brasil"),
      String(body.summary ?? ""),
      String(body.resume_file ?? ""),
      boolNumber(body.is_active),
      JSON.stringify(body)
    ]
  );
  res.json({ ok: true, id: db.query("SELECT last_insert_rowid() as id")[0]?.id });
});

apiRouter.put("/profiles/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as Record<string, unknown>;
  if (!id) {
    res.status(400).json({ error: "Perfil inválido." });
    return;
  }
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  if (body.is_active) db.run("UPDATE candidate_profiles SET is_active = 0 WHERE user_id = ? AND id <> ?", [userId, id]);
  db.run(
    `UPDATE candidate_profiles
     SET label = ?, name = ?, email = ?, phone = ?, linkedin = ?, city = ?, state = ?, country = ?,
         summary = ?, resume_file = ?, is_active = ?, raw_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`,
    [
      String(body.label ?? ""),
      String(body.name ?? ""),
      String(body.email ?? ""),
      String(body.phone ?? ""),
      String(body.linkedin ?? ""),
      String(body.city ?? ""),
      String(body.state ?? ""),
      String(body.country ?? "Brasil"),
      String(body.summary ?? ""),
      String(body.resume_file ?? ""),
      boolNumber(body.is_active),
      JSON.stringify(body),
      id,
      userId
    ]
  );
  res.json({ ok: true });
});

apiRouter.post("/profiles/:id/activate", async (req, res) => {
  const id = Number(req.params.id);
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  db.run("UPDATE candidate_profiles SET is_active = 0 WHERE user_id = ?", [userId]);
  db.run("UPDATE candidate_profiles SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?", [id, userId]);
  res.json({ ok: true });
});

apiRouter.delete("/profiles/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Perfil inválido." });
    return;
  }
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  ensureDefaultCandidateProfile(db, userId);
  const count = Number(db.query("SELECT COUNT(*) as total FROM candidate_profiles WHERE user_id = ?", [userId])[0]?.total ?? 0);
  if (count <= 1) {
    res.status(400).json({ error: "Crie ou ative outro perfil antes de excluir o último perfil." });
    return;
  }
  const profile = db.query<Record<string, unknown>>("SELECT * FROM candidate_profiles WHERE id = ? AND user_id = ? LIMIT 1", [id, userId])[0];
  if (!profile) {
    res.status(404).json({ error: "Perfil não encontrado." });
    return;
  }
  db.run("UPDATE applications SET user_profile_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND user_profile_id = ?", [userId, id]);
  db.run("DELETE FROM answer_memory WHERE user_id = ? AND user_profile_id = ?", [userId, id]);
  db.run("DELETE FROM candidate_profiles WHERE id = ? AND user_id = ?", [id, userId]);
  if (Number(profile.is_active) === 1) {
    const next = db.query<Record<string, unknown>>("SELECT id FROM candidate_profiles WHERE user_id = ? ORDER BY id ASC LIMIT 1", [userId])[0];
    if (next) db.run("UPDATE candidate_profiles SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?", [Number(next.id), userId]);
  }
  res.json({ ok: true, deleted: id });
});

apiRouter.post("/profiles/:id/resume", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  const id = Number(req.params.id);
  const profile = db.query<Record<string, unknown>>("SELECT * FROM candidate_profiles WHERE id = ? AND user_id = ? LIMIT 1", [id, userId])[0];
  if (!profile) {
    res.status(404).json({ error: "Perfil não encontrado." });
    return;
  }
  const fileName = safeFileName(String(req.body?.fileName ?? "curriculo.pdf"));
  const base64 = String(req.body?.base64 ?? "");
  const resumeText = String(req.body?.text ?? "").trim();
  if (!base64 && !resumeText) {
    res.status(400).json({ error: "Envie o arquivo do currículo ou cole o texto do currículo." });
    return;
  }
  const folder = ensureUserResumeFolder(userId);
  const filePath = path.join(folder, fileName);
  if (base64) {
    const clean = base64.includes(",") ? base64.split(",").pop() ?? "" : base64;
    fs.writeFileSync(filePath, Buffer.from(clean, "base64"));
  } else {
    fs.writeFileSync(filePath, resumeText, "utf8");
  }
  const raw = profile.raw_json ? JSON.parse(String(profile.raw_json)) as Record<string, unknown> : {};
  raw.resumeImportedAt = new Date().toISOString();
  raw.resumeTextPreview = resumeText ? resumeText.slice(0, 5000) : raw.resumeTextPreview;
  raw.needsResume = false;
  const resumeRef = `resumes/users/${userId}/${fileName}`;
  db.run(
    `UPDATE candidate_profiles
     SET resume_file = ?, raw_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`,
    [resumeRef, JSON.stringify(raw), id, userId]
  );
  res.json({ ok: true, file: fileName, resume_file: resumeRef });
});

apiRouter.get("/connected-accounts", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  const accounts = db.query<Record<string, unknown>>(
    `SELECT id, platform, display_name, login_url, username, secret_label, status, notes, last_login_at, last_sync_at, created_at, updated_at,
            CASE WHEN encrypted_secret IS NOT NULL AND encrypted_secret <> '' THEN 1 ELSE 0 END as has_secret
     FROM connected_accounts
     WHERE user_id = ?
     ORDER BY platform ASC`,
    [userId]
  );
  res.json({ accounts, vaultReady: Boolean(vaultKey()) });
});

apiRouter.post("/connected-accounts", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  const platform = String(req.body?.platform ?? "").trim().toLowerCase();
  if (!platform) {
    res.status(400).json({ error: "Informe o site ou plataforma." });
    return;
  }
  const loginUrl = String(req.body?.login_url ?? "").trim();
  if (loginUrl) {
    try {
      parseHttpUrl(loginUrl);
    } catch {
      res.status(400).json({ error: "Informe uma URL de login começando com http:// ou https://." });
      return;
    }
  }
  const password = String(req.body?.password ?? "");
  const existing = db.query<Record<string, unknown>>(
    "SELECT encrypted_secret FROM connected_accounts WHERE user_id = ? AND platform = ? LIMIT 1",
    [userId, platform]
  )[0];
  let encryptedSecret = String(existing?.encrypted_secret ?? "");
  if (password) {
    try {
      encryptedSecret = encryptSecret(password);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Não foi possível salvar a senha no cofre." });
      return;
    }
  }
  const secretLabel = password ? "Senha salva no cofre" : encryptedSecret ? "Senha já salva" : "";
  db.run(
    `INSERT INTO connected_accounts (
      user_id, platform, display_name, login_url, username, encrypted_secret, secret_label, status, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, platform) DO UPDATE SET
      display_name = excluded.display_name,
      login_url = excluded.login_url,
      username = excluded.username,
      encrypted_secret = CASE WHEN excluded.encrypted_secret <> '' THEN excluded.encrypted_secret ELSE connected_accounts.encrypted_secret END,
      secret_label = excluded.secret_label,
      status = excluded.status,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP`,
    [
      userId,
      platform,
      String(req.body?.display_name ?? platform),
      loginUrl,
      String(req.body?.username ?? ""),
      encryptedSecret,
      secretLabel,
      String(req.body?.status ?? "conectada"),
      String(req.body?.notes ?? "")
    ]
  );
  res.json({ ok: true });
});

apiRouter.post("/connected-accounts/:id/mark-login", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  const id = Number(req.params.id);
  db.run("UPDATE connected_accounts SET status = 'conectada', last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?", [id, userId]);
  res.json({ ok: true });
});

apiRouter.delete("/connected-accounts/:id", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  const id = Number(req.params.id);
  db.run("DELETE FROM connected_accounts WHERE id = ? AND user_id = ?", [id, userId]);
  res.json({ ok: true, deleted: id });
});

apiRouter.get("/answer-memory", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  const active = getActiveCandidateProfile(db, userId);
  const profileId = Number(req.query.profileId ?? active.id);
  const answers = db.query("SELECT * FROM answer_memory WHERE user_id = ? AND user_profile_id = ? ORDER BY category, question_key", [userId, profileId]);
  res.json({ profileId, answers });
});

apiRouter.post("/answer-memory/bulk", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  const active = getActiveCandidateProfile(db, userId);
  const profileId = Number(req.body?.profileId ?? active.id);
  const answers = Array.isArray(req.body?.answers) ? req.body.answers as Array<Record<string, unknown>> : [];
  if (!answers.length) {
    res.status(400).json({ error: "Nenhuma resposta recebida." });
    return;
  }
  for (const answer of answers) {
    const key = String(answer.key ?? answer.question_key ?? "").trim();
    const value = String(answer.answer ?? answer.answer_text ?? "").trim();
    if (!key || !value) continue;
    db.run(
      `INSERT INTO answer_memory (
        user_id, user_profile_id, question_key, question_text, answer_text, field_type, category, usage_count, approved_by_user, updated_at, last_used_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(user_profile_id, question_key) DO UPDATE SET
        question_text = excluded.question_text,
        answer_text = excluded.answer_text,
        field_type = excluded.field_type,
        category = excluded.category,
        approved_by_user = 1,
        updated_at = CURRENT_TIMESTAMP,
        last_used_at = CURRENT_TIMESTAMP`,
      [
        userId,
        profileId,
        key,
        String(answer.question ?? answer.question_text ?? key),
        value,
        String(answer.fieldType ?? answer.field_type ?? "text"),
        String(answer.category ?? "Geral")
      ]
    );
  }
  res.json({ ok: true, saved: answers.length, profileId });
});

apiRouter.get("/jobs", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  const rows = db.query<Record<string, unknown>>(`
    SELECT
      j.*,
      a.id as application_id,
      a.application_status,
      a.approval_status,
      a.sent_by_agent,
      a.applied_at,
      a.notes as application_notes
    FROM jobs j
    LEFT JOIN applications a ON a.job_id = j.id AND a.user_id = ?
    WHERE j.user_id = ?
      AND a.id IS NULL
      AND j.source <> 'google-assisted-search'
      AND lower(COALESCE(j.url, '')) NOT LIKE '%google.%/search%'
      AND lower(COALESCE(j.url, '')) NOT LIKE '%google.com/search%'
    ORDER BY
      CASE WHEN j.source IN ('google-assisted-search', 'sine', 'infojobs', 'jobs99', 'rh-agencies-curitiba', 'linkedin-search', 'indeed-search', 'vagascom-search', 'catho-search', 'netvagas-search', 'bne-search', 'trabalhabrasil-search', 'glassdoor-search', 'empregos-search', 'solides-search', 'abler-search', 'pandape-search') THEN 1 ELSE 0 END ASC,
      j.fit_score DESC,
      j.job_quality_score DESC,
      j.risk_score ASC
    LIMIT 300
  `, [userId, userId]);
  res.json(attachDuplicateMetadata(rows));
});

apiRouter.post("/scan", async (req, res) => {
  try {
    const userId = currentUserId(req);
    const entry = path.resolve(process.cwd(), "dist/src/index.js");
    const { stdout, stderr } = await execFileAsync(process.execPath, [entry, "scan"], {
      cwd: process.cwd(),
      env: { ...process.env, CAREER_HUNTER_USER_ID: String(userId) },
      timeout: 180000,
      maxBuffer: 1024 * 1024 * 4
    });
    res.json({ ok: true, stdout, stderr });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ ok: false, error: message });
  }
});

apiRouter.post("/manual-urls", async (req, res) => {
  const userId = currentUserId(req);
  let url = "";
  try {
    url = parseHttpUrl(req.body?.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Link inválido.";
    res.status(400).json({ error: `Link inválido. ${message}` });
    return;
  }
  if (isGoogleSearchUrl(url)) {
    res.status(400).json({ error: "Cole o link final da vaga, não a página de pesquisa do Google." });
    return;
  }

  const file = path.resolve(process.cwd(), "data/manual-urls.txt");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : [];
  const alreadyExists = existing.includes(url);
  if (!alreadyExists) fs.appendFileSync(file, `${url}\n`, "utf8");

  const db = await CareerDatabase.open();
  const settings = loadUserSettings(db, userId);
  const job = normalizeJob(manualJobFromUrl(url, req.body as Record<string, unknown>), settings);
  db.insertJob(job, userId);
  const saved = db.query<Record<string, unknown>>("SELECT id, title, source, url FROM jobs WHERE user_id = ? AND external_id = ? LIMIT 1", [userId, job.externalId])[0];
  res.json({
    ok: true,
    url,
    duplicate: alreadyExists,
    job: saved,
    message: alreadyExists ? "Link já estava importado." : "Link real importado e colocado na fila de vagas."
  });
});

apiRouter.post("/jobs/prepare-selected", async (req, res) => {
  const userId = currentUserId(req);
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "Nenhuma vaga selecionada." });
    return;
  }
  const db = await CareerDatabase.open();
  const settings = loadUserSettings(db, userId);
  const profile = getActiveCandidateProfile(db, userId);
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM jobs WHERE user_id = ? AND id IN (${placeholders})`, [userId, ...ids]);
  let prepared = 0;
  const skipped: Array<{ id: number; reason: string }> = [];

  for (const row of rows) {
    const jobId = Number(row.id);
    const exists = db.query("SELECT id FROM applications WHERE user_id = ? AND job_id = ? LIMIT 1", [userId, jobId])[0];
    if (exists) {
      skipped.push({ id: jobId, reason: "Já existe candidatura preparada para esta vaga." });
      continue;
    }
    const job = normalizeJob({
      externalId: String(row.external_id ?? ""),
      title: String(row.title ?? ""),
      company: String(row.company ?? ""),
      location: String(row.location ?? ""),
      source: String(row.source ?? ""),
      url: String(row.url ?? ""),
      description: String(row.description ?? ""),
      salary: String(row.salary ?? "")
    }, settings);
    await enqueueApplication(buildApplicationPacket(jobId, job, settings, profile.resume_file), userId);
    prepared += 1;
  }

  res.json({ ok: true, prepared, skipped });
});

apiRouter.post("/jobs/approve-selected", async (req, res) => {
  const userId = currentUserId(req);
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "Nenhuma vaga selecionada." });
    return;
  }
  const db = await CareerDatabase.open();
  const settings = loadUserSettings(db, userId);
  const profile = getActiveCandidateProfile(db, userId);
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM jobs WHERE user_id = ? AND id IN (${placeholders})`, [userId, ...ids]);
  let approved = 0;
  const applicationIds: number[] = [];
  const skipped: Array<{ id: number; reason: string }> = [];

  for (const row of rows) {
    const jobId = Number(row.id);
    const exists = db.query<Record<string, unknown>>("SELECT id FROM applications WHERE user_id = ? AND job_id = ? LIMIT 1", [userId, jobId])[0];
    if (exists) {
      const applicationId = Number(exists.id);
      db.run(
        `UPDATE applications
         SET approval_status = ?, application_status = ?, user_profile_id = COALESCE(user_profile_id, ?),
             updated_at = CURRENT_TIMESTAMP, notes = COALESCE(notes, '') || ?
         WHERE id = ? AND user_id = ?`,
        [
          "aprovado_pelo_usuario",
          "Aprovada pelo usuário",
          profile.id,
          `\nAprovada diretamente da aba Vagas em ${new Date().toISOString()}.`,
          applicationId,
          userId
        ]
      );
      applicationIds.push(applicationId);
      approved += 1;
      continue;
    }

    const job = normalizeJob({
      externalId: String(row.external_id ?? ""),
      title: String(row.title ?? ""),
      company: String(row.company ?? ""),
      location: String(row.location ?? ""),
      source: String(row.source ?? ""),
      url: String(row.url ?? ""),
      description: String(row.description ?? ""),
      salary: String(row.salary ?? "")
    }, settings);
    const packet = buildApplicationPacket(jobId, job, settings, profile.resume_file);
    db.run(
      `INSERT INTO applications (
        user_id, job_id, user_profile_id, application_status, cv_version, generated_resume_path,
        cover_letter_path, approval_status, sent_by_agent, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        userId,
        jobId,
        profile.id,
        "Aprovada pelo usuário",
        packet.cvVersion,
        packet.generatedResumePath,
        packet.coverLetterPath,
        "aprovado_pelo_usuario",
        `${packet.notes}\nAprovada diretamente da aba Vagas em ${new Date().toISOString()}.`
      ]
    );
    const saved = db.query<Record<string, unknown>>("SELECT id FROM applications WHERE user_id = ? AND job_id = ? ORDER BY id DESC LIMIT 1", [userId, jobId])[0];
    if (saved) applicationIds.push(Number(saved.id));
    approved += 1;
  }

  if (!rows.length) {
    skipped.push(...ids.map((id: number) => ({ id, reason: "Vaga não encontrada." })));
  }

  res.json({ ok: true, approved, applicationIds, skipped });
});

apiRouter.get("/jobs/:id", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  const job = db.query("SELECT * FROM jobs WHERE id = ? AND user_id = ? LIMIT 1", [Number(req.params.id), userId])[0];
  if (!job) {
    res.status(404).json({ error: "Vaga não encontrada" });
    return;
  }
  res.json(job);
});

apiRouter.get("/informal", async (req, res) => {
  const db = await CareerDatabase.open();
  res.json(db.query("SELECT * FROM informal_opportunities WHERE user_id = ? ORDER BY freela_score DESC, risk_score ASC LIMIT 300", [currentUserId(req)]));
});

apiRouter.get("/applications", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  const rows = db.query<Record<string, unknown>>(`
    SELECT
      a.*,
      j.title,
      j.company,
      j.source,
      j.url,
      j.salary,
      j.location,
      j.work_model,
      j.description,
      j.fit_score,
      j.hire_chance_score,
      j.job_quality_score,
      j.risk_score,
      j.status as job_status,
      j.risk_flags,
      j.fit_reason,
      j.hire_chance_reason,
      (SELECT e.action_url FROM recruiter_email_events e WHERE e.application_id = a.id ORDER BY datetime(e.received_at) DESC, e.id DESC LIMIT 1) as latest_email_url
    FROM applications a
    LEFT JOIN jobs j ON j.id = a.job_id
    WHERE a.user_id = ?
    ORDER BY a.id DESC
    LIMIT 300
  `, [userId]);
  res.json(attachDuplicateMetadata(rows));
});

apiRouter.post("/applications/approve", async (req, res) => {
  const userId = currentUserId(req);
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "Nenhuma candidatura selecionada." });
    return;
  }
  const db = await CareerDatabase.open();
  for (const id of ids) {
    db.run(
      "UPDATE applications SET approval_status = ?, application_status = ?, notes = COALESCE(notes, '') || ? WHERE id = ? AND user_id = ?",
      ["aprovado_pelo_usuario", "Aprovada pelo usuário", `\nAprovada no painel em ${new Date().toISOString()}.`, id, userId]
    );
    db.run("UPDATE applications SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?", [id, userId]);
  }
  res.json({ ok: true, approved: ids.length });
});

apiRouter.post("/applications/reject", async (req, res) => {
  const userId = currentUserId(req);
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "Nenhuma candidatura selecionada." });
    return;
  }
  const db = await CareerDatabase.open();
  for (const id of ids) {
    db.run(
      "UPDATE applications SET approval_status = ?, application_status = ?, notes = COALESCE(notes, '') || ? WHERE id = ? AND user_id = ?",
      ["rejeitado_pelo_usuario", "Rejeitada", `\nRejeitada no painel em ${new Date().toISOString()}.`, id, userId]
    );
    db.run("UPDATE applications SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?", [id, userId]);
  }
  res.json({ ok: true, rejected: ids.length });
});

apiRouter.post("/applications/mark-sent", async (req, res) => {
  const userId = currentUserId(req);
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "Nenhuma candidatura selecionada." });
    return;
  }
  const db = await CareerDatabase.open();
  for (const id of ids) {
    db.run(
      "UPDATE applications SET approval_status = ?, application_status = ?, sent_by_agent = 1, applied_at = COALESCE(applied_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP, notes = COALESCE(notes, '') || ? WHERE id = ? AND user_id = ?",
      ["aprovado_pelo_usuario", "Candidatura enviada", `\nMarcada como enviada no painel em ${new Date().toISOString()}.`, id, userId]
    );
  }
  res.json({ ok: true, sent: ids.length });
});

apiRouter.post("/applications/retry", async (req, res) => {
  const userId = currentUserId(req);
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "Nenhuma candidatura selecionada." });
    return;
  }
  const db = await CareerDatabase.open();
  const profile = getActiveCandidateProfile(db, userId);
  for (const id of ids) {
    db.run(
      `UPDATE applications
       SET approval_status = ?, application_status = ?, sent_by_agent = 0,
           retry_count = COALESCE(retry_count, 0) + 1,
           last_attempt_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP,
           user_profile_id = COALESCE(user_profile_id, ?),
           notes = COALESCE(notes, '') || ?
       WHERE id = ? AND user_id = ?`,
      [
        "aprovado_pelo_usuario",
        "Reenvio solicitado",
        profile.id,
        `\nCandidatura colocada para tentar novamente em ${new Date().toISOString()}.`,
        id,
        userId
      ]
    );
    db.run(
      "INSERT INTO application_attempts (user_id, application_id, user_profile_id, mode, status, result_message) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, id, profile.id, "retry", "reenvio_solicitado", "Usuário solicitou candidatura novamente."]
    );
  }
  res.json({ ok: true, retried: ids.length });
});

apiRouter.post("/applications/auto-apply", async (req, res) => {
  const userId = currentUserId(req);
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "Nenhuma candidatura selecionada." });
    return;
  }
  const result = await runAutomationForApplications(userId, ids, "candidatura_por_ia");
  res.json({ ok: true, modeLabel: "Candidatura por IA preparada", ...result });
});

apiRouter.post("/applications/ai-apply", async (req, res) => {
  const userId = currentUserId(req);
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "Nenhuma candidatura selecionada." });
    return;
  }
  const result = await runAutomationForApplications(userId, ids, "candidatura_por_ia");
  res.json({ ok: true, modeLabel: "Candidatura por IA preparada", ...result });
});

apiRouter.post("/applications/everything-mode", async (req, res) => {
  const userId = currentUserId(req);
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "Nenhuma candidatura selecionada." });
    return;
  }
  const db = await CareerDatabase.open();
  const settings = loadUserSettings(db, userId);
  if (!settings.applications.autoApply) {
    res.status(400).json({ error: "Ative candidatura automática permitida nas Configurações antes de usar esta automação." });
    return;
  }
  const result = await runAutomationForApplications(userId, ids, "candidatura_por_ia_autorizada", true);
  res.json({ ok: true, modeLabel: "Candidatura por IA preparada", ...result });
});

apiRouter.post("/applications/assisted-apply", async (req, res) => {
  const userId = currentUserId(req);
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "Nenhuma candidatura selecionada." });
    return;
  }
  const db = await CareerDatabase.open();
  const actions: Array<{ id: number; status: string; message: string; nextStep: string; url?: string }> = [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.query<Record<string, unknown>>(`
    SELECT a.*, j.title, j.company, j.source, j.url
    FROM applications a
    LEFT JOIN jobs j ON j.id = a.job_id
    WHERE a.user_id = ? AND a.id IN (${placeholders})
  `, [userId, ...ids]);

  for (const row of rows) {
    const id = Number(row.id);
    const approval = String(row.approval_status ?? "");
    const source = String(row.source ?? "");
    const url = String(row.url ?? "");
    if (String(row.application_status ?? "") === "Candidatura enviada" || Number(row.sent_by_agent ?? 0) === 1) {
      actions.push({
        id,
        status: "ja_candidatado",
        message: "Esta candidatura já está marcada como enviada.",
        nextStep: "Acompanhe retorno do recrutador e follow-up no painel."
      });
      continue;
    }
    if (approval !== "aprovado_pelo_usuario") {
      actions.push({
        id,
        status: "bloqueada",
        message: "A candidatura precisa ser aprovada antes.",
        nextStep: "Selecione a candidatura, clique em Aprovar selecionadas e depois em Candidatar-se com IA."
      });
      continue;
    }
    if (["google-assisted-search", "sine", "infojobs", "jobs99", "rh-agencies-curitiba", "linkedin-search", "indeed-search", "vagascom-search", "catho-search", "netvagas-search", "bne-search", "trabalhabrasil-search", "glassdoor-search", "empregos-search", "solides-search", "abler-search", "pandape-search"].includes(source)) {
      db.run(
        "UPDATE applications SET application_status = ?, updated_at = CURRENT_TIMESTAMP, notes = COALESCE(notes, '') || ? WHERE id = ? AND user_id = ?",
        ["Aguardando vaga real da fonte", `\nFonte assistida: abrir o link, escolher vaga real e importar o link específico.`, id, userId]
      );
      actions.push({
        id,
        status: "precisa_vaga_real",
        message: "Esta entrada ainda é uma busca/fonte assistida, não um formulário real de candidatura.",
        nextStep: "Abra a fonte, escolha uma vaga real, copie o link específico e cole no campo Importar link real do painel.",
        url
      });
      continue;
    }
    if (!url) {
      db.run(
        "UPDATE applications SET application_status = ?, updated_at = CURRENT_TIMESTAMP, notes = COALESCE(notes, '') || ? WHERE id = ? AND user_id = ?",
        ["Aguardando canal de candidatura", `\nSem URL/canal oficial para envio automático seguro.`, id, userId]
      );
      actions.push({
        id,
        status: "precisa_canal",
        message: "Ainda não existe link ou e-mail oficial para envio seguro.",
        nextStep: "Confirme o canal oficial da vaga antes de enviar currículo ou dados pessoais."
      });
      continue;
    }
    db.run(
      "UPDATE applications SET application_status = ?, updated_at = CURRENT_TIMESTAMP, notes = COALESCE(notes, '') || ? WHERE id = ? AND user_id = ?",
      ["Pronta para envio assistido", `\nAprovada para candidatura assistida. Abrir fonte oficial: ${url}`, id, userId]
    );
    actions.push({
      id,
      status: "pronta_para_formulario",
      message: "Pronta para candidatura assistida na fonte oficial.",
      nextStep: "Abra a fonte oficial. A IA pode ajudar a preencher respostas e usar currículo/carta, mas o envio final depende da sua confirmação.",
      url
    });
  }
  res.json({ ok: true, actions });
});

apiRouter.post("/applications/check-availability", async (req, res) => {
  const userId = currentUserId(req);
  const requestedIds = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  const db = await CareerDatabase.open();
  const rows = requestedIds.length
    ? db.query<Record<string, unknown>>(
      `SELECT a.id, j.url FROM applications a LEFT JOIN jobs j ON j.id = a.job_id WHERE a.user_id = ? AND a.id IN (${requestedIds.map(() => "?").join(",")})`,
      [userId, ...requestedIds]
    )
    : db.query<Record<string, unknown>>(
      `SELECT a.id, j.url
       FROM applications a
       LEFT JOIN jobs j ON j.id = a.job_id
       WHERE a.user_id = ? AND ${ACTUAL_APPLICATION_SQL}
       ORDER BY COALESCE(a.availability_checked_at, '') ASC
       LIMIT 30`,
      [userId]
    );
  let open = 0;
  let closed = 0;
  let unknown = 0;

  for (const row of rows) {
    const id = Number(row.id);
    const status = await checkUrlAvailability(String(row.url ?? ""));
    if (status === "aberta") open += 1;
    if (status === "fechada") closed += 1;
    if (status === "indefinida") unknown += 1;
    db.run(
      `UPDATE applications
       SET availability_status = ?,
           availability_checked_at = CURRENT_TIMESTAMP,
           availability_last_ok_at = CASE WHEN ? = 'aberta' THEN CURRENT_TIMESTAMP ELSE availability_last_ok_at END,
           availability_closed_at = CASE WHEN ? = 'fechada' THEN COALESCE(availability_closed_at, CURRENT_TIMESTAMP) ELSE availability_closed_at END,
           notes = COALESCE(notes, '') || ?
       WHERE id = ? AND user_id = ?`,
      [
        status,
        status,
        status,
        `\nDisponibilidade verificada: ${status} em ${new Date().toISOString()}.`,
        id,
        userId
      ]
    );
  }

  res.json({ ok: true, checked: rows.length, open, closed, unknown });
});

apiRouter.get("/actions", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  const applications = db.query<Record<string, unknown>>(`
    SELECT
      a.*,
      j.title,
      j.company,
      j.source,
      j.url,
      j.description,
      j.location,
      j.work_model,
      j.fit_score
    FROM applications a
    LEFT JOIN jobs j ON j.id = a.job_id
    WHERE a.user_id = ?
    ORDER BY a.updated_at DESC, a.id DESC
    LIMIT 300
  `, [userId]);
  const actions = applications.flatMap((row) => {
    const id = Number(row.id);
    const sent = Number(row.sent_by_agent ?? 0) === 1 || String(row.application_status ?? "") === "Candidatura enviada";
    const approved = String(row.approval_status ?? "") === "aprovado_pelo_usuario";
    const title = `${String(row.title ?? "Vaga")} · ${String(row.company ?? "Empresa")}`;
    if (sent) {
      if (String(row.availability_status ?? "") === "fechada") {
        return [{
            type: "candidatada",
            label: "Vaga fechada",
            priority: "media",
            applicationId: id,
            jobId: Number(row.job_id || 0),
            title,
            message: "Você já se candidatou, mas a vaga parece fechada ou indisponível.",
            nextStep: "O aviso fica visível por cerca de 15 dias. Acompanhe retorno ou arquive mentalmente como encerrada.",
            url: row.url
        }];
      }
      return [];
    }
    if (!approved) return [];
    const channel = channelForApplication(row);
    return [{
        type: channel.id === "ia" ? "ia" : channel.id === "manual" ? "manual" : channel.id,
        label: channel.label,
        priority: channel.priority,
        applicationId: id,
        jobId: Number(row.job_id || 0),
        title,
        message: String(row.application_status ?? "Aprovada para candidatura."),
        nextStep: channel.id === "ia"
          ? "Clique em Candidatar com IA na aba Candidaturas para preparar campos, currículo e respostas."
          : channel.id === "precisa_link"
            ? "Abra a fonte, encontre a vaga individual e importe o link real."
            : "Abra o canal indicado, revise dados e registre quando enviar.",
        url: row.url
    }];
  });

  res.json({ ok: true, actions });
});

apiRouter.get("/settings", async (req, res) => {
  const db = await CareerDatabase.open();
  res.json(loadUserSettings(db, currentUserId(req)));
});
apiRouter.post("/settings", async (req, res) => {
  const db = await CareerDatabase.open();
  saveUserSettings(db, currentUserId(req), req.body as AgentSettings);
  res.json({ ok: true });
});

apiRouter.get("/settings/export", async (req, res) => {
  const db = await CareerDatabase.open();
  const scope: SettingsExportScope = req.query.scope === "private" ? "private" : "github";
  res.json(exportSettings(loadUserSettings(db, currentUserId(req)), scope));
});

apiRouter.post("/settings/import", async (req, res) => {
  try {
    const db = await CareerDatabase.open();
    const userId = currentUserId(req);
    const settings = importSettings(req.body, loadUserSettings(db, userId));
    saveUserSettings(db, userId, settings);
    res.json({ ok: true, settings });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Não foi possível importar a configuração." });
  }
});

apiRouter.get("/environment", (_req, res) => {
  res.json(envStatus());
});

apiRouter.post("/environment", (req, res) => {
  if (currentUser(req).role !== "admin") {
    res.status(403).json({ error: "Somente a conta administradora pode alterar o ambiente global." });
    return;
  }
  if (process.env.NODE_ENV === "production") {
    res.status(409).json({ error: "No ambiente online, configure chaves e banco nas Environment Variables do Render. O sistema não grava segredos no disco do servidor." });
    return;
  }
  const body = req.body as Record<string, string | undefined>;
  const updates: Record<string, string | undefined> = {
    OPENAI_MODEL: body.openaiModel?.trim() || "gpt-4o-mini",
    GEMINI_MODEL: body.geminiModel?.trim() || "gemini-1.5-flash",
    GOOGLE_SEARCH_ENGINE_ID: body.googleSearchEngineId?.trim() || undefined,
    DATABASE_URL: body.databaseUrl?.trim() || "file:./data/jobs.sqlite",
    PORT: body.port?.trim() || undefined,
    DASHBOARD_PORT: body.port?.trim() || "8788"
  };
  if (body.openaiApiKey?.trim()) updates.OPENAI_API_KEY = body.openaiApiKey.trim();
  if (body.geminiApiKey?.trim()) updates.GEMINI_API_KEY = body.geminiApiKey.trim();
  if (body.googleSearchApiKey?.trim()) updates.GOOGLE_SEARCH_API_KEY = body.googleSearchApiKey.trim();
  writeEnvValues(updates);
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) process.env[key] = value;
  });
  refreshSecrets();
  res.json({ ok: true, environment: envStatus() });
});

apiRouter.get("/resumes", (req, res) => {
  const userId = currentUserId(req);
  const folder = path.resolve(process.cwd(), "resumes");
  const sharedFiles = fs.existsSync(folder)
    ? fs.readdirSync(folder).filter((file) => /\.(pdf|docx?|md)$/i.test(file) && file.toLowerCase() !== "readme.md")
    : [];
  const userFolder = process.env.STORAGE_ROOT?.trim()
    ? path.resolve(process.env.STORAGE_ROOT, "resumes", "users", String(userId))
    : path.resolve(folder, "users", String(userId));
  const userFiles = fs.existsSync(userFolder)
    ? fs.readdirSync(userFolder).filter((file) => /\.(pdf|docx?|txt|md)$/i.test(file)).map((file) => `users/${userId}/${file}`)
    : [];
  const files = [...sharedFiles, ...userFiles];
  res.json({ files });
});

apiRouter.get("/career-profile", async (req, res) => {
  const db = await CareerDatabase.open();
  const userId = currentUserId(req);
  const settings = loadUserSettings(db, userId);
  const activeProfile = getActiveCandidateProfile(db, userId);
  const folder = path.resolve(process.cwd(), "resumes");
  const sharedResumes = fs.existsSync(folder)
    ? fs.readdirSync(folder).filter((file) => /\.(pdf|docx?|md)$/i.test(file) && file.toLowerCase() !== "readme.md")
    : [];
  const userFolder = process.env.STORAGE_ROOT?.trim()
    ? path.resolve(process.env.STORAGE_ROOT, "resumes", "users", String(userId))
    : path.resolve(folder, "users", String(userId));
  const userResumes = fs.existsSync(userFolder)
    ? fs.readdirSync(userFolder).filter((file) => /\.(pdf|docx?|txt|md)$/i.test(file)).map((file) => `users/${userId}/${file}`)
    : [];
  const resumes = [...sharedResumes, ...userResumes];
  const generatedResumeFolder = path.resolve(process.cwd(), "generated/resumes");
  const generatedCoverFolder = path.resolve(process.cwd(), "generated/cover-letters");
  const generatedResumes = fs.existsSync(generatedResumeFolder)
    ? fs.readdirSync(generatedResumeFolder).filter((file) => /\.(md|docx?|pdf)$/i.test(file)).slice(-12).reverse()
    : [];
  const generatedCoverLetters = fs.existsSync(generatedCoverFolder)
    ? fs.readdirSync(generatedCoverFolder).filter((file) => /\.(md|docx?|pdf)$/i.test(file)).slice(-12).reverse()
    : [];
  res.json({
    profile: activeProfile,
    careerTracks: settings.careerTracks,
    targetRoles: (settings.jobSearchPreferences as { targetRoles?: string[] }).targetRoles ?? [],
    resumes,
    generatedResumes,
    generatedCoverLetters,
    strengths: [
      "Mais de 12 anos em hospitalidade, bares, eventos e atendimento ao cliente.",
      "Gestão de operação, padronização, treinamento e rotina de serviço.",
      "Boa aderência para atendimento, backoffice, experiência do cliente e análise operacional.",
      "Comunicação com cliente, organização de eventos e leitura de risco operacional."
    ],
    applicationPositioning: {
      headline: "Hospitalidade premium, operação e experiência do cliente com visão prática de negócio.",
      safeClaims: [
        "Não inventar experiência, CNH, idioma ou certificação.",
        "Adaptar currículo e carta ao cargo, fonte, salário, local e modelo de trabalho.",
        "Destacar resultados, atendimento, treinamento, organização e confiabilidade operacional."
      ]
    },
    ai: {
      provider: settings.ai.provider,
      openaiConfigured: Boolean(secrets.openaiApiKey),
      model: secrets.openaiModel || settings.ai.openai?.model || "gpt-4o-mini"
    }
  });
});
