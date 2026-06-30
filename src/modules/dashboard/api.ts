import { Router } from "express";
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

apiRouter.get("/informal", async (_req, res) => {
  const db = await CareerDatabase.open();
  res.json(db.query("SELECT * FROM informal_opportunities ORDER BY freela_score DESC, risk_score ASC LIMIT 300"));
});

apiRouter.get("/applications", async (_req, res) => {
  const db = await CareerDatabase.open();
  res.json(db.query("SELECT * FROM applications ORDER BY id DESC LIMIT 300"));
});

apiRouter.get("/settings", (_req, res) => res.json(loadSettings()));
apiRouter.post("/settings", (req, res) => {
  saveSettings(req.body);
  res.json({ ok: true });
});
