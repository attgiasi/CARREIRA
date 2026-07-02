import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { CareerDatabase } from "../../database/db.js";
import { loadSettings, saveSettings } from "../../config/settings.js";

export const apiRouter = Router();

apiRouter.get("/summary", async (_req, res) => {
  const db = await CareerDatabase.open();
  const jobs = db.query("SELECT COUNT(*) as total FROM jobs")[0]?.total ?? 0;
  const gold = db.query("SELECT COUNT(*) as total FROM jobs WHERE status = 'Vaga Ouro'")[0]?.total ?? 0;
  const applications = db.query("SELECT COUNT(*) as total FROM applications")[0]?.total ?? 0;
  const informal = db.query("SELECT COUNT(*) as total FROM informal_opportunities")[0]?.total ?? 0;
  res.json({ jobs, gold, applications, informal });
});

apiRouter.get("/jobs", async (_req, res) => {
  const db = await CareerDatabase.open();
  res.json(db.query("SELECT * FROM jobs ORDER BY fit_score DESC, risk_score ASC LIMIT 300"));
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
      j.fit_score,
      j.risk_score,
      j.status as job_status
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
  const actions: Array<{ id: number; status: string; message: string; url?: string }> = [];
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
    if (approval !== "aprovado_pelo_usuario") {
      actions.push({ id, status: "bloqueada", message: "A candidatura precisa ser aprovada antes." });
      continue;
    }
    if (["google-assisted-search", "sine", "infojobs", "jobs99", "rh-agencies-curitiba"].includes(source)) {
      db.run(
        "UPDATE applications SET application_status = ?, notes = COALESCE(notes, '') || ? WHERE id = ?",
        ["Aguardando vaga real da fonte", `\nFonte assistida: abrir o link, escolher vaga real e importar o link específico.`, id]
      );
      actions.push({ id, status: "assistida", message: "Abra a fonte, escolha a vaga real e importe o link específico antes do envio.", url });
      continue;
    }
    if (!url) {
      db.run(
        "UPDATE applications SET application_status = ?, notes = COALESCE(notes, '') || ? WHERE id = ?",
        ["Aguardando canal de candidatura", `\nSem URL/canal oficial para envio automático seguro.`, id]
      );
      actions.push({ id, status: "pendente", message: "Sem link ou e-mail oficial. Confirmar canal de candidatura." });
      continue;
    }
    db.run(
      "UPDATE applications SET application_status = ?, notes = COALESCE(notes, '') || ? WHERE id = ?",
      ["Pronta para envio assistido", `\nAprovada para candidatura assistida. Abrir fonte oficial: ${url}`, id]
    );
    actions.push({ id, status: "pronta", message: "Pronta para candidatura assistida na fonte oficial.", url });
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
