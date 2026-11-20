import fs from "node:fs";
import { CareerDatabase } from "../../database/db.js";
import { loadSettings } from "../../config/settings.js";
import { AgentSettings, RawJob } from "../../types.js";
import { searchCareerPages, collectSources, SourceReport } from "../sources/publicCareerSources.js";
import { searchGoogleJobs } from "../sources/googleJobsSearchConnector.js";
import { readJobPage } from "../sources/jobPageReader.js";
import { readGmailJobAlerts } from "../sources/gmailJobAlerts.js";
import { hasGmailSecrets } from "../../config/secrets.js";
import { normalizeJob } from "./normalizer.js";
import { deduplicateJobs } from "./deduplicator.js";
import { canonicalJobUrl, jobDuplicateKey } from "./duplicateDetector.js";
import { exclusionReason } from "./searchEligibility.js";

export interface ScanResult { found: number; eligible: number; inserted: number; duplicates: number; excluded: Record<string,number>; reports: SourceReport[]; completedAt: string; message: string }
const activeScans = new Map<number,Promise<ScanResult>>();

export function scanJobs(userId: number): Promise<ScanResult> {
  const active = activeScans.get(userId);
  if (active) return active;
  const scan = performScan(userId).finally(() => activeScans.delete(userId));
  activeScans.set(userId,scan);
  return scan;
}

async function performScan(userId: number): Promise<ScanResult> {
  if (!Number.isSafeInteger(userId) || userId < 1) throw new Error("Usuario invalido.");
  const db = await CareerDatabase.open();
  const row = db.query<{settings_json:string}>("SELECT settings_json FROM user_settings WHERE user_id = ?",[userId])[0];
  if (!row && userId !== Number(process.env.CAREER_HUNTER_USER_ID || 1)) throw new Error("Configure suas preferencias antes de buscar.");
  const settings = row ? JSON.parse(row.settings_json) as AgentSettings : loadSettings();
  if (!settings.agent.enabled || settings.agent.paused) throw new Error("O agente esta pausado nas configuracoes.");
  const jobs: RawJob[] = [];
  const reports: SourceReport[] = [];
  if (settings.sources.companyCareerPages) {
    const result = await searchCareerPages(settings); jobs.push(...result.jobs); reports.push(...result.reports);
  }
  if (settings.sources.googleJobsSearch) {
    const result = await searchGoogleJobs(settings); jobs.push(...result.jobs); reports.push(...result.reports);
  }
  const ownerId = Number(process.env.CAREER_HUNTER_USER_ID || 1);
  // The local Gmail connection and legacy URL file belong only to the owner.
  if (userId === ownerId && settings.sources.manualUrlImporter && fs.existsSync("data/manual-urls.txt")) {
    const urls = [...new Set(fs.readFileSync("data/manual-urls.txt","utf8").split(/\r?\n/).map(x=>x.trim()).filter(x=>x && !x.startsWith("#")))].slice(-20);
    const result = await collectSources(urls.map(url => ({name:"Links importados", run:() => readJobPage(url)})));
    jobs.push(...result.jobs); reports.push(...result.reports);
  }
  if (settings.sources.gmailAlerts) {
    if (userId === ownerId && hasGmailSecrets()) {
      const result = await collectSources([{name:"Gmail",run:() => readGmailJobAlerts()}]);
      jobs.push(...result.jobs); reports.push(...result.reports);
    } else reports.push({source:"Gmail",status:"not_configured",found:0,message:"Gmail nao conectado para esta conta."});
  }
  const normalized = jobs.map(raw => normalizeJob(raw,settings));
  const excluded: Record<string,number> = {};
  const candidates = normalized.filter(job => {
    const reason = exclusionReason(job,settings);
    if (reason) excluded[reason] = (excluded[reason] || 0) + 1;
    return !reason;
  });
  const unique = deduplicateJobs(candidates).sort((a,b) => b.fitScore - a.fitScore);
  const existing = db.query<Record<string,unknown>>("SELECT title,company,location,url,source FROM jobs WHERE user_id = ?",[userId]);
  const urls = new Set(existing.map(j => canonicalJobUrl(j.url)).filter(Boolean));
  const identities = new Map(existing.filter(j=>j.company && j.location && !/confirmar|confidencial/i.test(String(j.company))).map(j=>[jobDuplicateKey({...j,url:""}),String(j.source)]));
  let duplicates = candidates.length - unique.length;
  let inserted = 0;
  const limit = Math.min(500,Math.max(1,Number(settings.agent.maxJobsPerRun) || 100));
  db.transaction(() => {
    for (const job of unique) {
      const identity = jobDuplicateKey({title:job.title,company:job.company,location:job.location});
      const url = canonicalJobUrl(job.url);
      if (urls.has(url) || (identities.has(identity) && identities.get(identity) !== job.source)) { duplicates += 1; continue; }
      if (inserted >= limit) continue;
      db.insertJob(job,userId); urls.add(url);
      if (!/confirmar|confidencial/i.test(job.company)) identities.set(identity,job.source);
      inserted += 1;
    }
  });
  const result: ScanResult = {found:jobs.length, eligible:unique.length, inserted, duplicates, excluded, reports, completedAt:new Date().toISOString(),
    message:`${inserted} novas vagas. ${duplicates} repetidas ignoradas. ${Object.values(excluded).reduce((a,b)=>a+b,0)} fora das preferencias.`};
  db.run("INSERT INTO job_search_runs (user_id,result_json) VALUES (?,?)",[userId,JSON.stringify(result)]);
  return result;
}
