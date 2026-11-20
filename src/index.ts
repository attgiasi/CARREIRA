import { ensureRuntimeFolders, loadSettings } from "./config/settings.js";
import { CareerDatabase } from "./database/db.js";
import { audit, logError } from "./safety/auditLogger.js";
import { normalizeJob } from "./modules/jobs/normalizer.js";
import { shouldPrepareApplication } from "./modules/applications/applicationStrategy.js";
import { buildApplicationPacket } from "./modules/applications/applicationBuilder.js";
import { enqueueApplication } from "./modules/applications/approvalQueue.js";
import { generateDailySummary } from "./modules/reports/dailySummary.js";
import { generateWeeklyMarketRadar } from "./modules/reports/weeklyMarketRadar.js";
import { AgentSettings } from "./types.js";
import { scanJobs } from "./modules/jobs/searchService.js";

function settingsForUser(db: CareerDatabase, userId: number): AgentSettings {
  const row = db.query<Record<string, unknown>>("SELECT settings_json FROM user_settings WHERE user_id = ? LIMIT 1", [userId])[0];
  return row?.settings_json ? JSON.parse(String(row.settings_json)) as AgentSettings : loadSettings();
}

function runtimeUserId(): number {
  return Number(process.env.CAREER_HUNTER_USER_ID || 1);
}

function activeResumeFile(db: CareerDatabase, userId: number): string {
  const row = db.query<Record<string, unknown>>(
    "SELECT resume_file FROM candidate_profiles WHERE user_id = ? AND is_active = 1 ORDER BY id LIMIT 1",
    [userId]
  )[0];
  return String(row?.resume_file ?? "");
}

function activeUserIds(db: CareerDatabase): number[] {
  const rows = db.query<Record<string, unknown>>("SELECT id FROM users WHERE status = 'active' ORDER BY id");
  if (rows.length === 0) return [runtimeUserId()];
  return rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
}

export async function scan(userId = runtimeUserId()): Promise<void> {
  ensureRuntimeFolders();
  const result = await scanJobs(userId);
  audit("index", "scan", result.message);
  console.log(JSON.stringify(result, null, 2));
}

export async function scanAllUsers(): Promise<void> {
  ensureRuntimeFolders();
  const db = await CareerDatabase.open();
  const userIds = activeUserIds(db);
  for (const userId of userIds) await scan(userId);
  audit("index", "scan-all", `Scan multiusuário concluído para ${userIds.length} usuário(s).`);
}

export async function score(): Promise<void> {
  ensureRuntimeFolders();
  await CareerDatabase.open();
  audit("index", "score", "As vagas são pontuadas durante a normalização; nada pendente.");
  console.log("Score concluído. As notas são calculadas no scan.");
}

export async function prepare(userId = runtimeUserId()): Promise<void> {
  ensureRuntimeFolders();
  const db = await CareerDatabase.open();
  const settings = settingsForUser(db, userId);
  const resumeFile = activeResumeFile(db, userId);
  const rows = db.query<Record<string, unknown>>(
    "SELECT * FROM jobs WHERE user_id = ? AND fit_score >= ? AND risk_score < 60 AND id NOT IN (SELECT COALESCE(job_id, -1) FROM applications WHERE user_id = ?) ORDER BY fit_score DESC LIMIT ?",
    [userId, settings.strategy.onlyPrepareAboveScore, userId, settings.strategy.maxApplicationsPerDay]
  );
  for (const row of rows) {
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
    if (shouldPrepareApplication(job, settings)) {
      await enqueueApplication(buildApplicationPacket(Number(row.id), job, settings, resumeFile), userId);
    }
  }
  audit("index", "prepare", `Candidaturas preparadas: ${rows.length}.`);
  console.log(`Candidaturas preparadas e colocadas em aprovação: ${rows.length}.`);
}

export async function prepareAllUsers(): Promise<void> {
  ensureRuntimeFolders();
  const db = await CareerDatabase.open();
  const userIds = activeUserIds(db);
  for (const userId of userIds) await prepare(userId);
  audit("index", "prepare-all", `Preparo multiusuário concluído para ${userIds.length} usuário(s).`);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "scan";
  try {
    if (command === "scan") return scan();
    if (command === "scan-all") return scanAllUsers();
    if (command === "score") return score();
    if (command === "prepare") return prepare();
    if (command === "prepare-all") return prepareAllUsers();
    if (command === "daily-summary") {
      console.log(await generateDailySummary());
      return;
    }
    if (command === "weekly-radar") {
      console.log(await generateWeeklyMarketRadar());
      return;
    }
    console.log("Comando disponível: scan, scan-all, score, prepare, prepare-all, daily-summary, weekly-radar");
  } catch (error) {
    logError("index", error, { command });
    throw error;
  }
}

main();
