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
async function collectRawJobs() {
    const settings = loadSettings();
    const batches = await Promise.all([
        settings.sources.gmailAlerts ? readGmailJobAlerts() : [],
        settings.sources.greenhouse ? fetchGreenhouseJobs() : [],
        settings.sources.lever ? fetchLeverJobs() : [],
        settings.sources.gupy ? fetchGupyJobs() : [],
        settings.sources.rss ? fetchRssJobs() : [],
        settings.sources.companyCareerPages ? fetchCompanyCareerPages() : [],
        Promise.resolve(settings.sources.manualUrlImporter ? importManualUrls() : []),
        Promise.resolve(settings.sources.companyHunter ? seedTargetCompanyOpportunities() : [])
    ]);
    return batches.flat().slice(0, settings.agent.maxJobsPerRun);
}
export async function scan() {
    ensureRuntimeFolders();
    const settings = loadSettings();
    if (!settings.agent.enabled || settings.agent.paused) {
        audit("index", "scan", "Agente desativado ou pausado.");
        return;
    }
    const db = await CareerDatabase.open();
    const rawJobs = await collectRawJobs();
    const jobs = deduplicateJobs(rawJobs.map((raw) => normalizeJob(raw, settings)));
    for (const job of jobs)
        db.insertJob(job);
    const rawInformal = await findInformalWork();
    for (const raw of rawInformal)
        db.insertInformal(normalizeInformal(raw));
    audit("index", "scan", `Scan concluído: ${jobs.length} vagas, ${rawInformal.length} informais.`);
    console.log(`Scan concluído: ${jobs.length} vagas e ${rawInformal.length} oportunidades informais.`);
}
export async function score() {
    ensureRuntimeFolders();
    await CareerDatabase.open();
    audit("index", "score", "As vagas são pontuadas durante a normalização; nada pendente.");
    console.log("Score concluído. As notas são calculadas no scan.");
}
export async function prepare() {
    ensureRuntimeFolders();
    const settings = loadSettings();
    const db = await CareerDatabase.open();
    const rows = db.query("SELECT * FROM jobs WHERE fit_score >= ? AND risk_score < 60 AND id NOT IN (SELECT COALESCE(job_id, -1) FROM applications) ORDER BY fit_score DESC LIMIT ?", [settings.strategy.onlyPrepareAboveScore, settings.strategy.maxApplicationsPerDay]);
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
            await enqueueApplication(buildApplicationPacket(Number(row.id), job, settings));
        }
    }
    audit("index", "prepare", `Candidaturas preparadas: ${rows.length}.`);
    console.log(`Candidaturas preparadas e colocadas em aprovação: ${rows.length}.`);
}
async function main() {
    const command = process.argv[2] ?? "scan";
    try {
        if (command === "scan")
            return scan();
        if (command === "score")
            return score();
        if (command === "prepare")
            return prepare();
        if (command === "daily-summary") {
            console.log(await generateDailySummary());
            return;
        }
        if (command === "weekly-radar") {
            console.log(await generateWeeklyMarketRadar());
            return;
        }
        console.log("Comando disponível: scan, score, prepare, daily-summary, weekly-radar");
    }
    catch (error) {
        logError("index", error, { command });
        throw error;
    }
}
main();
