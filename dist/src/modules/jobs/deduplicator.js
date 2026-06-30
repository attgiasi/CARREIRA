export function deduplicateJobs(jobs) {
    const seen = new Set();
    return jobs.filter((job) => {
        const key = `${job.source}|${job.externalId}|${job.url}|${job.title}|${job.company}`.toLowerCase();
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
