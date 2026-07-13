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

export function isTargetRoleTitle(title: string): boolean {
  const normalized = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/^(novas? )?vagas semelhantes/.test(normalized)) return false;
  return /bartender|barman|mixolog|head bartender|chefe de bar|bar manager|supervisor de bar|coordenador de bar|gerente de bar|alimentos e bebidas|food.{0,3}beverage|guest experience|experiencia do cliente|customer experience|treinador.{0,12}bar|instrutor.{0,12}bebidas|consultor.{0,20}(bar|restaurante|hospitalidade)|gerente.{0,20}(restaurante|hospitalidade)|supervisor.{0,20}(restaurante|hospitalidade)/.test(normalized);
}

export async function syncCareerGmail(db: CareerDatabase, userId: number): Promise<Record<string, unknown>> {
  const settings = settingsForUser(db, userId);
  const replies = await syncRecruiterReplies(db, userId);
  const before = Number(db.query<Record<string, unknown>>("SELECT COUNT(*) as total FROM jobs WHERE user_id = ?", [userId])[0]?.total ?? 0);
  const existingUrls = new Set(
    db.query<Record<string, unknown>>("SELECT url FROM jobs WHERE user_id = ? AND TRIM(COALESCE(url, '')) <> ''", [userId])
      .map((row) => canonicalJobUrl(String(row.url ?? "")))
  );
  const rawJobs = settings.sources.gmailAlerts ? await readGmailJobAlerts(100) : [];
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
  return {
    ...replies,
    jobsFoundInGmail: rawJobs.length,
    jobsImported: Math.max(0, after - before),
    jobsIgnoredAsDuplicates: Math.max(0, rawJobs.length - Math.max(0, after - before)),
    pipeline: getRecruiterPipelineMetrics(db, userId)
  };
}
