export function shouldPrepareApplication(job, settings) {
    return Boolean(settings.applications.prepareApplications) && job.fitScore >= settings.strategy.onlyPrepareAboveScore && job.riskScore < 60;
}
export function shouldApplyAutomatically(_job, settings) {
    return Boolean(settings.applications.autoApply) && !settings.agent.dryRun && settings.applications.requireApprovalBeforeApply === false;
}
