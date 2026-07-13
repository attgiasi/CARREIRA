import express from "express";
import path from "node:path";
import { ensureRuntimeFolders, loadSettings } from "./config/settings.js";
import { secrets } from "./config/secrets.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { apiRouter } from "./modules/dashboard/api.js";
import { audit } from "./safety/auditLogger.js";
import { CareerDatabase } from "./database/db.js";
import { hasGmailSecrets } from "./config/secrets.js";
import { syncCareerGmail } from "./modules/gmail/careerGmailSync.js";

ensureRuntimeFolders();

const settings = loadSettings();
const app = express();
const port = Number(secrets.dashboardPort || settings.agent.dashboardPort || 8788);

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.resolve(process.cwd(), "public")));
app.use("/", dashboardRouter);
app.use("/api", apiRouter);

app.listen(port, () => {
  audit("server", "listen", `Painel iniciado em http://localhost:${port}`);
  console.log(`Painel iniciado em http://localhost:${port}`);
});

const gmailIntervalMinutes = Number(process.env.GMAIL_SYNC_INTERVAL_MINUTES || 30);
let gmailSyncRunning = false;

async function runScheduledGmailSync(): Promise<void> {
  if (gmailSyncRunning || !hasGmailSecrets()) return;
  gmailSyncRunning = true;
  try {
    const db = await CareerDatabase.open();
    const ownerUserId = Number(process.env.CAREER_HUNTER_USER_ID || 1);
    const result = await syncCareerGmail(db, ownerUserId);
    audit("server", "gmail-auto-sync", `Gmail atualizado automaticamente para o usuário ${ownerUserId}: ${String(result.jobsImported ?? 0)} vaga(s) nova(s).`);
  } catch (error) {
    audit("server", "gmail-auto-sync-error", error instanceof Error ? error.message : String(error));
  } finally {
    gmailSyncRunning = false;
  }
}

if (process.env.NODE_ENV !== "test" && Number.isFinite(gmailIntervalMinutes) && gmailIntervalMinutes >= 5) {
  setTimeout(() => void runScheduledGmailSync(), 15_000).unref();
  setInterval(() => void runScheduledGmailSync(), gmailIntervalMinutes * 60_000).unref();
}
