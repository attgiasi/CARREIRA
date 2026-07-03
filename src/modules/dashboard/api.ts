import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CareerDatabase } from "../../database/db.js";
import { loadSettings, saveSettings } from "../../config/settings.js";
import { refreshSecrets, secrets } from "../../config/secrets.js";
import { normalizeJob } from "../jobs/normalizer.js";
import { buildApplicationPacket } from "../applications/applicationBuilder.js";
import { enqueueApplication } from "../applications/approvalQueue.js";
import { CandidateProfile, decideAutomation, MemoryAnswer } from "../applications/autoApplyEngine.js";

export const apiRouter = Router();
const execFileAsync = promisify(execFile);
const envPath = path.resolve(process.cwd(), ".env");

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

function manualJobFromUrl(url: string) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  return {
    externalId: `manual-${url}`,
    title: `Vaga real importada: ${host}`,
    company: "Empresa a confirmar",
    location: "A confirmar",
    source: "manual",
    url,
    description: `Link oficial importado pelo painel para candidatura real: ${url}`,
    raw: { url, importedAt: new Date().toISOString(), importedFrom: "dashboard" }
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
    gmailConfigured: Boolean(secrets.googleClientId && secrets.googleClientSecret && secrets.gmailRefreshToken),
    databaseUrl: secrets.databaseUrl,
    port: String(secrets.dashboardPort),
    nodeEnv: process.env.NODE_ENV ?? "development",
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

function ensureDefaultCandidateProfile(db: CareerDatabase): void {
  const count = db.query("SELECT COUNT(*) as total FROM candidate_profiles")[0]?.total ?? 0;
  if (Number(count) > 0) return;
  const settings = loadSettings();
  const resumeFolder = path.resolve(process.cwd(), "resumes");
  const resumeFile = fs.existsSync(resumeFolder)
    ? fs.readdirSync(resumeFolder).find((file) => /\.(pdf|docx?|md)$/i.test(file) && file.toLowerCase() !== "readme.md") ?? ""
    : "";
  db.run(
    `INSERT INTO candidate_profiles (
      label, name, email, phone, linkedin, city, state, country, summary, resume_file, is_active, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      "Perfil principal",
      settings.profile.name,
      settings.profile.email,
      settings.profile.phone,
      settings.profile.linkedin,
      settings.profile.city,
      settings.profile.state,
      settings.profile.country,
      settings.profile.summary,
      resumeFile,
      JSON.stringify(settings.profile)
    ]
  );
}

function getActiveCandidateProfile(db: CareerDatabase): CandidateProfile {
  ensureDefaultCandidateProfile(db);
  const row = db.query<Record<string, unknown>>("SELECT * FROM candidate_profiles WHERE is_active = 1 ORDER BY id LIMIT 1")[0]
    ?? db.query<Record<string, unknown>>("SELECT * FROM candidate_profiles ORDER BY id LIMIT 1")[0];
  return profileFromRow(row);
}

function applicationStatusForDecision(status: string): string {
  const labels: Record<string, string> = {
    precisa_informacao: "Aguardando resposta do usuário",
    precisa_canal: "Aguardando canal de candidatura",
    precisa_vaga_real: "Aguardando vaga real da fonte",
    linkedin_manual: "LinkedIn manual",
    autofill_pronto: "Preenchimento automático pronto",
    auto_apply_pronto: "Candidatura automática pronta"
  };
  return labels[status] ?? status;
}

async function runAutomationForApplications(ids: number[], mode: string, approveBeforeRun = false) {
  const db = await CareerDatabase.open();
  const settings = loadSettings();
  const profile = getActiveCandidateProfile(db);
  const memory = db.query<MemoryAnswer>(
    "SELECT question_key, answer_text FROM answer_memory WHERE user_profile_id = ?",
    [profile.id]
  );
  const placeholders = ids.map(() => "?").join(",");

  if (approveBeforeRun) {
    db.run(
      `UPDATE applications
       SET approval_status = ?, application_status = ?, user_profile_id = COALESCE(user_profile_id, ?),
           updated_at = CURRENT_TIMESTAMP,
           notes = COALESCE(notes, '') || ?
       WHERE id IN (${placeholders})`,
      [
        "aprovado_pelo_usuario",
        "Aprovada pelo Modo TUDO",
        profile.id,
        `\nModo TUDO autorizado pelo usuário em ${new Date().toISOString()}.`,
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
    WHERE a.id IN (${placeholders})
  `, ids);

  const actions: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const id = Number(row.id);
    if (String(row.approval_status ?? "") !== "aprovado_pelo_usuario") {
      actions.push({
        id,
        status: "bloqueada",
        message: "A candidatura precisa ser aprovada antes do modo cirúrgico.",
        nextStep: "Clique em Aprovar e rode o modo cirúrgico novamente."
      });
      continue;
    }
    const decision = decideAutomation(row, profile, memory, settings);
    const applicationStatus = applicationStatusForDecision(decision.status);
    db.run(
      `UPDATE applications
       SET application_status = ?, automation_mode = ?, user_profile_id = ?, last_attempt_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP, notes = COALESCE(notes, '') || ?
       WHERE id = ?`,
      [
        applicationStatus,
        mode,
        profile.id,
        `\n${mode}: ${decision.status}. ${decision.message}`,
        id
      ]
    );
    db.run(
      `INSERT INTO application_attempts (
        application_id, user_profile_id, mode, status, result_message, missing_questions_json, filled_fields_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
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
        "UPDATE answer_memory SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE user_profile_id = ? AND question_key = ?",
        [profile.id, key]
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

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true, status: "online", time: new Date().toISOString(), environment: envStatus() });
});

apiRouter.get("/summary", async (_req, res) => {
  const db = await CareerDatabase.open();
  ensureDefaultCandidateProfile(db);
  const jobs = db.query("SELECT COUNT(*) as total FROM jobs")[0]?.total ?? 0;
  const availableJobs = db.query(`
    SELECT COUNT(*) as total
    FROM jobs j
    LEFT JOIN applications a ON a.job_id = j.id
    WHERE a.id IS NULL
  `)[0]?.total ?? 0;
  const gold = db.query("SELECT COUNT(*) as total FROM jobs WHERE status = 'Vaga Ouro' AND source NOT IN ('google-assisted-search', 'sine', 'infojobs', 'jobs99', 'rh-agencies-curitiba', 'linkedin-search', 'indeed-search', 'vagascom-search', 'catho-search', 'netvagas-search', 'bne-search', 'trabalhabrasil-search', 'glassdoor-search', 'empregos-search')")[0]?.total ?? 0;
  const applications = db.query("SELECT COUNT(*) as total FROM applications")[0]?.total ?? 0;
  const awaitingApproval = db.query("SELECT COUNT(*) as total FROM applications WHERE approval_status = 'aguardando_aprovacao'")[0]?.total ?? 0;
  const approved = db.query("SELECT COUNT(*) as total FROM applications WHERE approval_status = 'aprovado_pelo_usuario'")[0]?.total ?? 0;
  const rejected = db.query("SELECT COUNT(*) as total FROM applications WHERE approval_status = 'rejeitado_pelo_usuario'")[0]?.total ?? 0;
  const sent = db.query("SELECT COUNT(*) as total FROM applications WHERE application_status = 'Candidatura enviada' OR sent_by_agent = 1")[0]?.total ?? 0;
  const waitingRealJob = db.query("SELECT COUNT(*) as total FROM applications WHERE application_status = 'Aguardando vaga real da fonte'")[0]?.total ?? 0;
  const ready = db.query("SELECT COUNT(*) as total FROM applications WHERE application_status = 'Pronta para envio assistido'")[0]?.total ?? 0;
  const pendingInformation = db.query("SELECT COUNT(*) as total FROM applications WHERE application_status = 'Aguardando resposta do usuário'")[0]?.total ?? 0;
  const informal = db.query("SELECT COUNT(*) as total FROM informal_opportunities")[0]?.total ?? 0;
  const profiles = db.query("SELECT COUNT(*) as total FROM candidate_profiles")[0]?.total ?? 0;
  const memoryAnswers = db.query("SELECT COUNT(*) as total FROM answer_memory")[0]?.total ?? 0;
  const bySource = db.query("SELECT source, COUNT(*) as total FROM jobs GROUP BY source ORDER BY total DESC LIMIT 8");
  const byWorkModel = db.query("SELECT COALESCE(work_model, 'A confirmar') as work_model, COUNT(*) as total FROM jobs GROUP BY work_model ORDER BY total DESC LIMIT 6");
  const byApplicationStatus = db.query("SELECT COALESCE(application_status, 'Sem status') as status, COUNT(*) as total FROM applications GROUP BY application_status ORDER BY total DESC LIMIT 8");
  const lastFoundAt = db.query("SELECT MAX(found_at) as value FROM jobs")[0]?.value ?? "";
  const lastAppliedAt = db.query("SELECT MAX(applied_at) as value FROM applications WHERE applied_at IS NOT NULL")[0]?.value ?? "";
  const topJobs = db.query(`
    SELECT title, company, source, fit_score, risk_score, status
    FROM jobs
    WHERE source NOT IN ('google-assisted-search', 'sine', 'infojobs', 'jobs99', 'rh-agencies-curitiba', 'linkedin-search', 'indeed-search', 'vagascom-search', 'catho-search', 'netvagas-search', 'bne-search', 'trabalhabrasil-search', 'glassdoor-search', 'empregos-search')
    ORDER BY fit_score DESC, job_quality_score DESC, risk_score ASC
    LIMIT 5
  `);
  const newestJobs = db.query(`
    SELECT j.title, j.company, j.source, j.location, j.work_model, j.fit_score, j.risk_score, j.found_at
    FROM jobs j
    LEFT JOIN applications a ON a.job_id = j.id
    WHERE a.id IS NULL
    ORDER BY j.id DESC
    LIMIT 5
  `);
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
    informal,
    profiles,
    memoryAnswers,
    bySource,
    byWorkModel,
    byApplicationStatus,
    topJobs,
    newestJobs,
    lastFoundAt,
    lastAppliedAt,
    environment: envStatus()
  });
});

apiRouter.get("/profiles", async (_req, res) => {
  const db = await CareerDatabase.open();
  ensureDefaultCandidateProfile(db);
  const profiles = db.query(`
    SELECT
      p.*,
      (SELECT COUNT(*) FROM answer_memory m WHERE m.user_profile_id = p.id) as memory_count,
      (SELECT COUNT(*) FROM applications a WHERE a.user_profile_id = p.id) as applications_count
    FROM candidate_profiles p
    ORDER BY p.is_active DESC, p.id ASC
  `);
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
  ensureDefaultCandidateProfile(db);
  if (body.is_active) db.run("UPDATE candidate_profiles SET is_active = 0");
  db.run(
    `INSERT INTO candidate_profiles (
      label, name, email, phone, linkedin, city, state, country, summary, resume_file, is_active, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
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
  if (body.is_active) db.run("UPDATE candidate_profiles SET is_active = 0 WHERE id <> ?", [id]);
  db.run(
    `UPDATE candidate_profiles
     SET label = ?, name = ?, email = ?, phone = ?, linkedin = ?, city = ?, state = ?, country = ?,
         summary = ?, resume_file = ?, is_active = ?, raw_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
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
      id
    ]
  );
  res.json({ ok: true });
});

apiRouter.post("/profiles/:id/activate", async (req, res) => {
  const id = Number(req.params.id);
  const db = await CareerDatabase.open();
  db.run("UPDATE candidate_profiles SET is_active = 0");
  db.run("UPDATE candidate_profiles SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
  res.json({ ok: true });
});

apiRouter.delete("/profiles/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Perfil inválido." });
    return;
  }
  const db = await CareerDatabase.open();
  ensureDefaultCandidateProfile(db);
  const count = Number(db.query("SELECT COUNT(*) as total FROM candidate_profiles")[0]?.total ?? 0);
  if (count <= 1) {
    res.status(400).json({ error: "Crie ou ative outro perfil antes de excluir o último perfil." });
    return;
  }
  const profile = db.query<Record<string, unknown>>("SELECT * FROM candidate_profiles WHERE id = ? LIMIT 1", [id])[0];
  if (!profile) {
    res.status(404).json({ error: "Perfil não encontrado." });
    return;
  }
  db.run("UPDATE applications SET user_profile_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_profile_id = ?", [id]);
  db.run("DELETE FROM answer_memory WHERE user_profile_id = ?", [id]);
  db.run("DELETE FROM candidate_profiles WHERE id = ?", [id]);
  if (Number(profile.is_active) === 1) {
    const next = db.query<Record<string, unknown>>("SELECT id FROM candidate_profiles ORDER BY id ASC LIMIT 1")[0];
    if (next) db.run("UPDATE candidate_profiles SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [Number(next.id)]);
  }
  res.json({ ok: true, deleted: id });
});

apiRouter.get("/answer-memory", async (req, res) => {
  const db = await CareerDatabase.open();
  const active = getActiveCandidateProfile(db);
  const profileId = Number(req.query.profileId ?? active.id);
  const answers = db.query("SELECT * FROM answer_memory WHERE user_profile_id = ? ORDER BY category, question_key", [profileId]);
  res.json({ profileId, answers });
});

apiRouter.post("/answer-memory/bulk", async (req, res) => {
  const db = await CareerDatabase.open();
  const active = getActiveCandidateProfile(db);
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
        user_profile_id, question_key, question_text, answer_text, field_type, category, usage_count, approved_by_user, updated_at, last_used_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(user_profile_id, question_key) DO UPDATE SET
        question_text = excluded.question_text,
        answer_text = excluded.answer_text,
        field_type = excluded.field_type,
        category = excluded.category,
        approved_by_user = 1,
        updated_at = CURRENT_TIMESTAMP,
        last_used_at = CURRENT_TIMESTAMP`,
      [
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

apiRouter.get("/jobs", async (_req, res) => {
  const db = await CareerDatabase.open();
  res.json(db.query(`
    SELECT
      j.*,
      a.id as application_id,
      a.application_status,
      a.approval_status,
      a.sent_by_agent,
      a.applied_at,
      a.notes as application_notes
    FROM jobs j
    LEFT JOIN applications a ON a.job_id = j.id
    WHERE a.id IS NULL
    ORDER BY
      CASE WHEN j.source IN ('google-assisted-search', 'sine', 'infojobs', 'jobs99', 'rh-agencies-curitiba', 'linkedin-search', 'indeed-search', 'vagascom-search', 'catho-search', 'netvagas-search', 'bne-search', 'trabalhabrasil-search', 'glassdoor-search', 'empregos-search') THEN 1 ELSE 0 END ASC,
      j.fit_score DESC,
      j.job_quality_score DESC,
      j.risk_score ASC
    LIMIT 300
  `));
});

apiRouter.post("/scan", async (_req, res) => {
  try {
    const entry = path.resolve(process.cwd(), "dist/src/index.js");
    const { stdout, stderr } = await execFileAsync(process.execPath, [entry, "scan"], {
      cwd: process.cwd(),
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
  let url = "";
  try {
    url = parseHttpUrl(req.body?.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Link inválido.";
    res.status(400).json({ error: `Link inválido. ${message}` });
    return;
  }

  const file = path.resolve(process.cwd(), "data/manual-urls.txt");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : [];
  const alreadyExists = existing.includes(url);
  if (!alreadyExists) fs.appendFileSync(file, `${url}\n`, "utf8");

  const settings = loadSettings();
  const db = await CareerDatabase.open();
  const job = normalizeJob(manualJobFromUrl(url), settings);
  db.insertJob(job);
  const saved = db.query<Record<string, unknown>>("SELECT id, title, source, url FROM jobs WHERE external_id = ? LIMIT 1", [job.externalId])[0];
  res.json({
    ok: true,
    url,
    duplicate: alreadyExists,
    job: saved,
    message: alreadyExists ? "Link já estava importado." : "Link real importado e colocado na fila de vagas."
  });
});

apiRouter.post("/jobs/prepare-selected", async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "Nenhuma vaga selecionada." });
    return;
  }
  const db = await CareerDatabase.open();
  const settings = loadSettings();
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM jobs WHERE id IN (${placeholders})`, ids);
  let prepared = 0;
  const skipped: Array<{ id: number; reason: string }> = [];

  for (const row of rows) {
    const jobId = Number(row.id);
    const exists = db.query("SELECT id FROM applications WHERE job_id = ? LIMIT 1", [jobId])[0];
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
    await enqueueApplication(buildApplicationPacket(jobId, job, settings));
    prepared += 1;
  }

  res.json({ ok: true, prepared, skipped });
});

apiRouter.get("/jobs/:id", async (req, res) => {
  const db = await CareerDatabase.open();
  const job = db.query("SELECT * FROM jobs WHERE id = ? LIMIT 1", [Number(req.params.id)])[0];
  if (!job) {
    res.status(404).json({ error: "Vaga não encontrada" });
    return;
  }
  res.json(job);
});

apiRouter.get("/informal", async (_req, res) => {
  const db = await CareerDatabase.open();
  res.json(db.query("SELECT * FROM informal_opportunities ORDER BY freela_score DESC, risk_score ASC LIMIT 300"));
});

apiRouter.get("/applications", async (_req, res) => {
  const db = await CareerDatabase.open();
  res.json(db.query(`
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
      j.hire_chance_reason
    FROM applications a
    LEFT JOIN jobs j ON j.id = a.job_id
    ORDER BY a.id DESC
    LIMIT 300
  `));
});

apiRouter.post("/applications/approve", async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "Nenhuma candidatura selecionada." });
    return;
  }
  const db = await CareerDatabase.open();
  for (const id of ids) {
    db.run(
      "UPDATE applications SET approval_status = ?, application_status = ?, notes = COALESCE(notes, '') || ? WHERE id = ?",
      ["aprovado_pelo_usuario", "Aprovada pelo usuário", `\nAprovada no painel em ${new Date().toISOString()}.`, id]
    );
    db.run("UPDATE applications SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
  }
  res.json({ ok: true, approved: ids.length });
});

apiRouter.post("/applications/reject", async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "Nenhuma candidatura selecionada." });
    return;
  }
  const db = await CareerDatabase.open();
  for (const id of ids) {
    db.run(
      "UPDATE applications SET approval_status = ?, application_status = ?, notes = COALESCE(notes, '') || ? WHERE id = ?",
      ["rejeitado_pelo_usuario", "Rejeitada", `\nRejeitada no painel em ${new Date().toISOString()}.`, id]
    );
    db.run("UPDATE applications SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
  }
  res.json({ ok: true, rejected: ids.length });
});

apiRouter.post("/applications/mark-sent", async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "Nenhuma candidatura selecionada." });
    return;
  }
  const db = await CareerDatabase.open();
  for (const id of ids) {
    db.run(
      "UPDATE applications SET approval_status = ?, application_status = ?, sent_by_agent = 1, applied_at = COALESCE(applied_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP, notes = COALESCE(notes, '') || ? WHERE id = ?",
      ["aprovado_pelo_usuario", "Candidatura enviada", `\nMarcada como enviada no painel em ${new Date().toISOString()}.`, id]
    );
  }
  res.json({ ok: true, sent: ids.length });
});

apiRouter.post("/applications/retry", async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "Nenhuma candidatura selecionada." });
    return;
  }
  const db = await CareerDatabase.open();
  const profile = getActiveCandidateProfile(db);
  for (const id of ids) {
    db.run(
      `UPDATE applications
       SET approval_status = ?, application_status = ?, sent_by_agent = 0,
           retry_count = COALESCE(retry_count, 0) + 1,
           last_attempt_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP,
           user_profile_id = COALESCE(user_profile_id, ?),
           notes = COALESCE(notes, '') || ?
       WHERE id = ?`,
      [
        "aprovado_pelo_usuario",
        "Reenvio solicitado",
        profile.id,
        `\nCandidatura colocada para tentar novamente em ${new Date().toISOString()}.`,
        id
      ]
    );
    db.run(
      "INSERT INTO application_attempts (application_id, user_profile_id, mode, status, result_message) VALUES (?, ?, ?, ?, ?)",
      [id, profile.id, "retry", "reenvio_solicitado", "Usuário solicitou candidatura novamente."]
    );
  }
  res.json({ ok: true, retried: ids.length });
});

apiRouter.post("/applications/auto-apply", async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "Nenhuma candidatura selecionada." });
    return;
  }
  const result = await runAutomationForApplications(ids, "cirurgico_alto_desempenho");
  res.json({ ok: true, modeLabel: "Modo cirúrgico executado", ...result });
});

apiRouter.post("/applications/everything-mode", async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "Nenhuma candidatura selecionada." });
    return;
  }
  const settings = loadSettings();
  if (!settings.applications.everythingMode) {
    res.status(400).json({ error: "Ative o Modo TUDO em Configurações > Segurança antes de usar este botão." });
    return;
  }
  const result = await runAutomationForApplications(ids, "modo_tudo_configurado", true);
  res.json({ ok: true, everythingMode: true, modeLabel: "Modo TUDO executado", ...result });
});

apiRouter.post("/applications/assisted-apply", async (req, res) => {
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
    WHERE a.id IN (${placeholders})
  `, ids);

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
    if (["google-assisted-search", "sine", "infojobs", "jobs99", "rh-agencies-curitiba", "linkedin-search", "indeed-search", "vagascom-search", "catho-search", "netvagas-search", "bne-search", "trabalhabrasil-search", "glassdoor-search", "empregos-search"].includes(source)) {
      db.run(
        "UPDATE applications SET application_status = ?, updated_at = CURRENT_TIMESTAMP, notes = COALESCE(notes, '') || ? WHERE id = ?",
        ["Aguardando vaga real da fonte", `\nFonte assistida: abrir o link, escolher vaga real e importar o link específico.`, id]
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
        "UPDATE applications SET application_status = ?, updated_at = CURRENT_TIMESTAMP, notes = COALESCE(notes, '') || ? WHERE id = ?",
        ["Aguardando canal de candidatura", `\nSem URL/canal oficial para envio automático seguro.`, id]
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
      "UPDATE applications SET application_status = ?, updated_at = CURRENT_TIMESTAMP, notes = COALESCE(notes, '') || ? WHERE id = ?",
      ["Pronta para envio assistido", `\nAprovada para candidatura assistida. Abrir fonte oficial: ${url}`, id]
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

apiRouter.get("/settings", (_req, res) => res.json(loadSettings()));
apiRouter.post("/settings", (req, res) => {
  saveSettings(req.body);
  res.json({ ok: true });
});

apiRouter.get("/environment", (_req, res) => {
  res.json(envStatus());
});

apiRouter.post("/environment", (req, res) => {
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

apiRouter.get("/resumes", (_req, res) => {
  const folder = path.resolve(process.cwd(), "resumes");
  const files = fs.existsSync(folder)
    ? fs.readdirSync(folder).filter((file) => /\.(pdf|docx?|md)$/i.test(file) && file.toLowerCase() !== "readme.md")
    : [];
  res.json({ files });
});

apiRouter.get("/career-profile", (_req, res) => {
  const settings = loadSettings();
  const folder = path.resolve(process.cwd(), "resumes");
  const resumes = fs.existsSync(folder)
    ? fs.readdirSync(folder).filter((file) => /\.(pdf|docx?|md)$/i.test(file) && file.toLowerCase() !== "readme.md")
    : [];
  const generatedResumeFolder = path.resolve(process.cwd(), "generated/resumes");
  const generatedCoverFolder = path.resolve(process.cwd(), "generated/cover-letters");
  const generatedResumes = fs.existsSync(generatedResumeFolder)
    ? fs.readdirSync(generatedResumeFolder).filter((file) => /\.(md|docx?|pdf)$/i.test(file)).slice(-12).reverse()
    : [];
  const generatedCoverLetters = fs.existsSync(generatedCoverFolder)
    ? fs.readdirSync(generatedCoverFolder).filter((file) => /\.(md|docx?|pdf)$/i.test(file)).slice(-12).reverse()
    : [];
  res.json({
    profile: settings.profile,
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
