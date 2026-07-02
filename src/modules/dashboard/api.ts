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

function envStatus() {
  const envMap = readEnvMap();
  return {
    envExists: fs.existsSync(envPath),
    openaiConfigured: Boolean(secrets.openaiApiKey),
    openaiModel: secrets.openaiModel,
    googleSearchConfigured: Boolean(secrets.googleSearchApiKey && secrets.googleSearchEngineId),
    gmailConfigured: Boolean(secrets.googleClientId && secrets.googleClientSecret && secrets.gmailRefreshToken),
    databaseUrl: secrets.databaseUrl,
    port: String(secrets.dashboardPort),
    nodeEnv: process.env.NODE_ENV ?? "development",
    envKeys: [...envMap.keys()].filter((key) => !key.includes("KEY") && !key.includes("TOKEN") && !key.includes("SECRET"))
  };
}

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true, status: "online", time: new Date().toISOString(), environment: envStatus() });
});

apiRouter.get("/summary", async (_req, res) => {
  const db = await CareerDatabase.open();
  const jobs = db.query("SELECT COUNT(*) as total FROM jobs")[0]?.total ?? 0;
  const availableJobs = db.query(`
    SELECT COUNT(*) as total
    FROM jobs j
    LEFT JOIN applications a ON a.job_id = j.id
    WHERE a.id IS NULL
  `)[0]?.total ?? 0;
  const gold = db.query("SELECT COUNT(*) as total FROM jobs WHERE status = 'Vaga Ouro' AND source NOT IN ('google-assisted-search', 'sine', 'infojobs', 'jobs99', 'rh-agencies-curitiba')")[0]?.total ?? 0;
  const applications = db.query("SELECT COUNT(*) as total FROM applications")[0]?.total ?? 0;
  const awaitingApproval = db.query("SELECT COUNT(*) as total FROM applications WHERE approval_status = 'aguardando_aprovacao'")[0]?.total ?? 0;
  const approved = db.query("SELECT COUNT(*) as total FROM applications WHERE approval_status = 'aprovado_pelo_usuario'")[0]?.total ?? 0;
  const rejected = db.query("SELECT COUNT(*) as total FROM applications WHERE approval_status = 'rejeitado_pelo_usuario'")[0]?.total ?? 0;
  const sent = db.query("SELECT COUNT(*) as total FROM applications WHERE application_status = 'Candidatura enviada' OR sent_by_agent = 1")[0]?.total ?? 0;
  const waitingRealJob = db.query("SELECT COUNT(*) as total FROM applications WHERE application_status = 'Aguardando vaga real da fonte'")[0]?.total ?? 0;
  const ready = db.query("SELECT COUNT(*) as total FROM applications WHERE application_status = 'Pronta para envio assistido'")[0]?.total ?? 0;
  const informal = db.query("SELECT COUNT(*) as total FROM informal_opportunities")[0]?.total ?? 0;
  const bySource = db.query("SELECT source, COUNT(*) as total FROM jobs GROUP BY source ORDER BY total DESC LIMIT 8");
  const byWorkModel = db.query("SELECT COALESCE(work_model, 'A confirmar') as work_model, COUNT(*) as total FROM jobs GROUP BY work_model ORDER BY total DESC LIMIT 6");
  const byApplicationStatus = db.query("SELECT COALESCE(application_status, 'Sem status') as status, COUNT(*) as total FROM applications GROUP BY application_status ORDER BY total DESC LIMIT 8");
  const lastFoundAt = db.query("SELECT MAX(found_at) as value FROM jobs")[0]?.value ?? "";
  const lastAppliedAt = db.query("SELECT MAX(applied_at) as value FROM applications WHERE applied_at IS NOT NULL")[0]?.value ?? "";
  const topJobs = db.query(`
    SELECT title, company, source, fit_score, risk_score, status
    FROM jobs
    WHERE source NOT IN ('google-assisted-search', 'sine', 'infojobs', 'jobs99', 'rh-agencies-curitiba')
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
    informal,
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
      CASE WHEN j.source IN ('google-assisted-search', 'sine', 'infojobs', 'jobs99', 'rh-agencies-curitiba') THEN 1 ELSE 0 END ASC,
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
    if (["google-assisted-search", "sine", "infojobs", "jobs99", "rh-agencies-curitiba"].includes(source)) {
      db.run(
        "UPDATE applications SET application_status = ?, updated_at = CURRENT_TIMESTAMP, notes = COALESCE(notes, '') || ? WHERE id = ?",
        ["Aguardando vaga real da fonte", `\nFonte assistida: abrir o link, escolher vaga real e importar o link específico.`, id]
      );
      actions.push({
        id,
        status: "precisa_vaga_real",
        message: "Esta entrada ainda é uma busca/fonte assistida, não um formulário real de candidatura.",
        nextStep: "Abra a fonte, escolha uma vaga real, copie o link específico e cole em data/manual-urls.txt para o agente preparar a candidatura real.",
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
    GOOGLE_SEARCH_ENGINE_ID: body.googleSearchEngineId?.trim() || undefined,
    DATABASE_URL: body.databaseUrl?.trim() || "file:./data/jobs.sqlite",
    PORT: body.port?.trim() || undefined,
    DASHBOARD_PORT: body.port?.trim() || "8788"
  };
  if (body.openaiApiKey?.trim()) updates.OPENAI_API_KEY = body.openaiApiKey.trim();
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
