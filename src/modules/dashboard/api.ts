import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { CareerDatabase } from "../../database/db.js";
import { loadSettings, saveSettings } from "../../config/settings.js";
import { normalizeJob } from "../jobs/normalizer.js";
import { buildApplicationPacket } from "../applications/applicationBuilder.js";
import { enqueueApplication } from "../applications/approvalQueue.js";

export const apiRouter = Router();

apiRouter.get("/summary", async (_req, res) => {
  const db = await CareerDatabase.open();
  const jobs = db.query("SELECT COUNT(*) as total FROM jobs")[0]?.total ?? 0;
  const gold = db.query("SELECT COUNT(*) as total FROM jobs WHERE status = 'Vaga Ouro' AND source NOT IN ('google-assisted-search', 'sine', 'infojobs', 'jobs99', 'rh-agencies-curitiba')")[0]?.total ?? 0;
  const applications = db.query("SELECT COUNT(*) as total FROM applications")[0]?.total ?? 0;
  const approved = db.query("SELECT COUNT(*) as total FROM applications WHERE approval_status = 'aprovado_pelo_usuario'")[0]?.total ?? 0;
  const sent = db.query("SELECT COUNT(*) as total FROM applications WHERE application_status = 'Candidatura enviada' OR sent_by_agent = 1")[0]?.total ?? 0;
  const waitingRealJob = db.query("SELECT COUNT(*) as total FROM applications WHERE application_status = 'Aguardando vaga real da fonte'")[0]?.total ?? 0;
  const ready = db.query("SELECT COUNT(*) as total FROM applications WHERE application_status = 'Pronta para envio assistido'")[0]?.total ?? 0;
  const informal = db.query("SELECT COUNT(*) as total FROM informal_opportunities")[0]?.total ?? 0;
  const bySource = db.query("SELECT source, COUNT(*) as total FROM jobs GROUP BY source ORDER BY total DESC LIMIT 8");
  const topJobs = db.query(`
    SELECT title, company, source, fit_score, risk_score, status
    FROM jobs
    WHERE source NOT IN ('google-assisted-search', 'sine', 'infojobs', 'jobs99', 'rh-agencies-curitiba')
    ORDER BY fit_score DESC, job_quality_score DESC, risk_score ASC
    LIMIT 5
  `);
  res.json({ jobs, gold, applications, approved, sent, waitingRealJob, ready, informal, bySource, topJobs });
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
    ORDER BY
      CASE WHEN j.source IN ('google-assisted-search', 'sine', 'infojobs', 'jobs99', 'rh-agencies-curitiba') THEN 1 ELSE 0 END ASC,
      j.fit_score DESC,
      j.job_quality_score DESC,
      j.risk_score ASC
    LIMIT 300
  `));
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
  }
  res.json({ ok: true, rejected: ids.length });
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
        "UPDATE applications SET application_status = ?, notes = COALESCE(notes, '') || ? WHERE id = ?",
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
        "UPDATE applications SET application_status = ?, notes = COALESCE(notes, '') || ? WHERE id = ?",
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
      "UPDATE applications SET application_status = ?, notes = COALESCE(notes, '') || ? WHERE id = ?",
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

apiRouter.get("/resumes", (_req, res) => {
  const folder = path.resolve(process.cwd(), "resumes");
  const files = fs.existsSync(folder)
    ? fs.readdirSync(folder).filter((file) => /\.(pdf|docx?|md)$/i.test(file))
    : [];
  res.json({ files });
});
