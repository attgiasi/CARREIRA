import { loadSettings } from "../../config/settings.js";
import { CareerDatabase } from "../../database/db.js";
import { AgentSettings } from "../../types.js";
import { deduplicateJobs } from "../jobs/deduplicator.js";
import { normalizeJob } from "../jobs/normalizer.js";
import { canonicalJobUrl, readGmailJobAlerts } from "../sources/gmailJobAlerts.js";
import { getRecruiterPipelineMetrics, syncRecruiterReplies } from "./recruiterReplyReader.js";

function settingsForUser(db: CareerDatabase, userId: number): AgentSettings {
  const row = db.query<Record<string, unknown>>("SELECT settings_json FROM user_settings WHERE user_id = ? LIMIT 1", [userId])[0];
  return row?.settings_json ? JSON.parse(String(row.settings_json)) as AgentSettings : loadSettings();
}

export function gmailJobAlertsDue(lastScanAt: string, now = Date.now(), intervalHours = 6): boolean {
  if (!lastScanAt) return true;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(lastScanAt)
    ? `${lastScanAt.replace(" ", "T")}Z`
    : lastScanAt;
  const lastScan = Date.parse(normalized);
  return !Number.isFinite(lastScan) || now - lastScan >= Math.max(1, intervalHours) * 3_600_000;
}

export function isTargetRoleTitle(title: string): boolean {
  const normalized = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/^(novas? )?vagas semelhantes/.test(normalized)) return false;
  return /bartender|barman|mixolog|head bartender|chefe de bar|bar manager|supervisor de bar|coordenador de bar|gerente de bar|alimentos e bebidas|food.{0,3}beverage|guest experience|experiencia do cliente|customer experience|treinador.{0,12}bar|instrutor.{0,12}bebidas|consultor.{0,20}(bar|restaurante|hospitalidade)|gerente.{0,20}(restaurante|hospitalidade)|supervisor.{0,20}(restaurante|hospitalidade)/.test(normalized);
}

export async function syncCareerGmail(db: CareerDatabase, userId: number): Promise<Record<string, unknown>> {
  const settings = settingsForUser(db, userId);
  const alertState = db.query<Record<string, unknown>>(
    "SELECT last_scan_at FROM gmail_job_alert_sync_state WHERE user_id = ? LIMIT 1",
    [userId]
  )[0];
  const lastSuccessfulSync = db.query<Record<string, unknown>>(
    "SELECT completed_at FROM gmail_sync_runs WHERE user_id = ? AND status = 'concluido' ORDER BY id DESC LIMIT 1",
    [userId]
  )[0];
  const lastAlertScanAt = String(alertState?.last_scan_at ?? lastSuccessfulSync?.completed_at ?? "");
  if (!alertState && lastAlertScanAt) {
    db.run(
      "INSERT OR IGNORE INTO gmail_job_alert_sync_state (user_id, last_scan_at) VALUES (?, ?)",
      [userId, lastAlertScanAt]
    );
  }
  const scanJobAlerts = Boolean(settings.sources.gmailAlerts && gmailJobAlertsDue(lastAlertScanAt));
  const replies = await syncRecruiterReplies(db, userId);
  const before = Number(db.query<Record<string, unknown>>("SELECT COUNT(*) as total FROM jobs WHERE user_id = ?", [userId])[0]?.total ?? 0);
  const existingUrls = new Set(
    db.query<Record<string, unknown>>("SELECT url FROM jobs WHERE user_id = ? AND TRIM(COALESCE(url, '')) <> ''", [userId])
      .map((row) => canonicalJobUrl(String(row.url ?? "")))
  );
  const rawJobs = scanJobAlerts ? await readGmailJobAlerts(50) : [];
  const acceptedStates = new Set(
    ((settings.jobSearchPreferences as { locations?: { acceptedStates?: string[] } }).locations?.acceptedStates ?? [])
      .map((state) => state.toUpperCase())
  );
  const stateByName: Record<string, string> = { "paraná": "PR", "santa catarina": "SC", "são paulo": "SP", "rio grande do sul": "RS", "rio de janeiro": "RJ", "minas gerais": "MG" };
  const jobs = deduplicateJobs(rawJobs.map((raw) => normalizeJob(raw, settings))).filter((job) => {
    if (job.fitScore < 60) return false;
    if (!isTargetRoleTitle(job.title)) return false;
    if (existingUrls.has(canonicalJobUrl(job.url))) return false;
    const detectedState = stateByName[job.location.toLowerCase()];
    return !detectedState || acceptedStates.size === 0 || acceptedStates.has(detectedState);
  });
  for (const job of jobs) db.insertJob(job, userId);
  const after = Number(db.query<Record<string, unknown>>("SELECT COUNT(*) as total FROM jobs WHERE user_id = ?", [userId])[0]?.total ?? 0);
  const imported = Math.max(0, after - before);
  if (scanJobAlerts) {
    db.run(
      `INSERT INTO gmail_job_alert_sync_state (user_id, last_scan_at, messages_scanned, jobs_found, jobs_imported)
       VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         last_scan_at = CURRENT_TIMESTAMP,
         messages_scanned = excluded.messages_scanned,
         jobs_found = excluded.jobs_found,
         jobs_imported = excluded.jobs_imported`,
      [userId, Math.min(50, rawJobs.length), rawJobs.length, imported]
    );
  }
  return {
    ...replies,
    gmailJobAlertsScanned: scanJobAlerts,
    jobsFoundInGmail: rawJobs.length,
    jobsImported: imported,
    jobsIgnoredAsDuplicates: Math.max(0, rawJobs.length - imported),
    pipeline: getRecruiterPipelineMetrics(db, userId)
  };
}
