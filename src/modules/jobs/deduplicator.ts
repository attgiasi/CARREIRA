import { NormalizedJob } from "../../types.js";
import { canonicalJobUrl, jobDuplicateKey } from "./duplicateDetector.js";

export function deduplicateJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const finalUrlKey = canonicalJobUrl(job.url);
    const duplicateKey = jobDuplicateKey({
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url
    });
    const key = finalUrlKey || duplicateKey || `${job.source}|${job.externalId}|${job.url}|${job.title}|${job.company}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
