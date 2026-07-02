import { AgentSettings, NormalizedJob } from "../../types.js";

export function isAssistedSearchSource(source: string): boolean {
  return ["google-assisted-search", "sine", "infojobs", "jobs99", "rh-agencies-curitiba"].includes(source);
}

export function shouldPrepareApplication(job: NormalizedJob, settings: AgentSettings): boolean {
  if (!settings.applications.prepareApplications) return false;
  if (job.fitScore < settings.strategy.onlyPrepareAboveScore) return false;
  if (job.riskScore >= 60) return false;
  if (isAssistedSearchSource(job.source)) return false;
  return true;
}

export function shouldApplyAutomatically(_job: NormalizedJob, settings: AgentSettings): boolean {
  return Boolean(settings.applications.autoApply) && !settings.agent.dryRun && settings.applications.requireApprovalBeforeApply === false;
}
