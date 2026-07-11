import { ensureRuntimeFolders, loadSettings } from "./config/settings.js";
import { CareerDatabase } from "./database/db.js";
import { audit, logError } from "./safety/auditLogger.js";
import { readGmailJobAlerts } from "./modules/sources/gmailJobAlerts.js";
import { fetchGreenhouseJobs } from "./modules/sources/greenhouseConnector.js";
import { fetchLeverJobs } from "./modules/sources/leverConnector.js";
import { fetchGupyJobs } from "./modules/sources/gupyConnector.js";
import { fetchRssJobs } from "./modules/sources/rssConnector.js";
import { fetchCompanyCareerPages } from "./modules/sources/companyCareerPageConnector.js";
import { importManualUrls } from "./modules/sources/manualUrlImporter.js";
import { importWhatsappMessages } from "./modules/sources/whatsappTextImporter.js";
import { fetchGoogleJobsSearch } from "./modules/sources/googleJobsSearchConnector.js";
import { fetchJobBoardSearches } from "./modules/sources/jobBoardsConnector.js";
import { fetchRhAgencySearches } from "./modules/sources/rhAgenciesConnector.js";
import { seedTargetCompanyOpportunities } from "./modules/sources/companyHunter.js";
import { findInformalWork } from "./modules/informal/informalWorkHunter.js";
import { normalizeInformal } from "./modules/informal/informalOpportunityNormalizer.js";
import { normalizeJob } from "./modules/jobs/normalizer.js";
import { deduplicateJobs } from "./modules/jobs/deduplicator.js";
import { shouldPrepareApplication } from "./modules/applications/applicationStrategy.js";
import { buildApplicationPacket } from "./modules/applications/applicationBuilder.js";
import { enqueueApplication } from "./modules/applications/approvalQueue.js";
import { generateDailySummary } from "./modules/reports/dailySummary.js";
import { generateWeeklyMarketRadar } from "./modules/reports/weeklyMarketRadar.js";
import { AgentSettings, RawJob } from "./types.js";
import { syncRecruiterReplies } from "./modules/gmail/recruiterReplyReader.js";

function settingsForUser(db: CareerDatabase, userId: number): AgentSettings {
  const row = db.query<Record<string, unknown>>("SELECT settings_json FROM user_settings WHERE user_id = ? LIMIT 1", [userId])[0];
  return row?.settings_json ? JSON.parse(String(row.settings_json)) as AgentSettings : loadSettings();
}

async function collectRawJobs(settings: AgentSettings): Promise<RawJob[]> {
  const batches = await Promise.all([
    settings.sources.gmailAlerts ? readGmailJobAlerts() : [],
    settings.sources.greenhouse ? fetchGreenhouseJobs() : [],
    settings.sources.lever ? fetchLeverJobs() : [],
    settings.sources.gupy ? fetchGupyJobs() : [],
    settings.sources.rss ? fetchRssJobs() : [],
    settings.sources.companyCareerPages ? fetchCompanyCareerPages() : [],
    Promise.resolve(settings.sources.manualUrlImporter ? importManualUrls() : []),
    Promise.resolve(importWhatsappMessages()),
    settings.sources.googleJobsSearch ? fetchGoogleJobsSearch(settings) : [],
    Promise.resolve(settings.sources.sine ? fetchJobBoardSearches(settings, "sine") : []),
    Promise.resolve(settings.sources.infojobs ? fetchJobBoardSearches(settings, "infojobs") : []),
    Promise.resolve(settings.sources.jobs99 ? fetchJobBoardSearches(settings, "jobs99") : []),
    Promise.resolve(settings.sources.linkedinSearch ? fetchJobBoardSearches(settings, "linkedinSearch") : []),
    Promise.resolve(settings.sources.indeedSearch ? fetchJobBoardSearches(settings, "indeedSearch") : []),
    Promise.resolve(settings.sources.vagasCom ? fetchJobBoardSearches(settings, "vagasCom") : []),
    Promise.resolve(settings.sources.cathoSearch ? fetchJobBoardSearches(settings, "cathoSearch") : []),
    Promise.resolve(settings.sources.netvagas ? fetchJobBoardSearches(settings, "netvagas") : []),
    Promise.resolve(settings.sources.bne ? fetchJobBoardSearches(settings, "bne") : []),
    Promise.resolve(settings.sources.trabalhaBrasil ? fetchJobBoardSearches(settings, "trabalhaBrasil") : []),
    Promise.resolve(settings.sources.glassdoorSearch ? fetchJobBoardSearches(settings, "glassdoorSearch") : []),
    Promise.resolve(settings.sources.empregosComBr ? fetchJobBoardSearches(settings, "empregosComBr") : []),
    Promise.resolve(settings.sources.solidesJobs ? fetchJobBoardSearches(settings, "solidesJobs") : []),
    Promise.resolve(settings.sources.ablerJobs ? fetchJobBoardSearches(settings, "ablerJobs") : []),
    Promise.resolve(settings.sources.pandapeJobs ? fetchJobBoardSearches(settings, "pandapeJobs") : []),
    Promise.resolve(settings.sources.rhAgenciesCuritiba ? fetchRhAgencySearches(settings) : []),
    Promise.resolve(settings.sources.companyHunter ? seedTargetCompanyOpportunities() : [])
  ]);
  return batches.flat().slice(0, settings.agent.maxJobsPerRun);
}

function runtimeUserId(): number {
  return Number(process.env.CAREER_HUNTER_USER_ID || 1);
}

function activeUserIds(db: CareerDatabase): number[] {
  const rows = db.query<Record<string, unknown>>("SELECT id FROM users WHERE status = 'active' ORDER BY id");
  if (rows.length === 0) return [runtimeUserId()];
  return rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
}

export async function scan(userId = runtimeUserId()): Promise<void> {
  ensureRuntimeFolders();
  const db = await CareerDatabase.open();
  const settings = settingsForUser(db, userId);
  if (!settings.agent.enabled || settings.agent.paused) {
    audit("index", "scan", "Agente desativado ou pausado.");
    return;
  }
  const rawJobs = await collectRawJobs(settings);
  const jobs = deduplicateJobs(rawJobs.map((raw) => normalizeJob(raw, settings)));
  for (const job of jobs) db.insertJob(job, userId);
  const rawInformal = await findInformalWork();
  for (const raw of rawInformal) db.insertInformal(normalizeInformal(raw), userId);
  if (settings.sources.gmailAlerts) {
    try {
      await syncRecruiterReplies(db, userId);
    } catch (error) {
      logError("index.gmailSync", error, { userId });
    }
  }
  audit("index", "scan", `Scan concluído: ${jobs.length} vagas, ${rawInformal.length} informais.`);
  console.log(`Scan concluído: ${jobs.length} vagas e ${rawInformal.length} oportunidades informais.`);
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
      await enqueueApplication(buildApplicationPacket(Number(row.id), job, settings), userId);
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
