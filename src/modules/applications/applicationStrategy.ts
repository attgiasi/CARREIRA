import { AgentSettings, NormalizedJob } from "../../types.js";

export function shouldPrepareApplication(job: NormalizedJob, settings: AgentSettings): boolean {
  return Boolean(settings.applications.prepareApplications) && job.fitScore >= settings.strategy.onlyPrepareAboveScore && job.riskScore < 60;
}

export function shouldApplyAutomatically(_job: NormalizedJob, settings: AgentSettings): boolean {
  return Boolean(settings.applications.autoApply) && !settings.agent.dryRun && settings.applications.requireApprovalBeforeApply === false;
}
