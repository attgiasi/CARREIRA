import { NormalizedJob } from "../../types.js";
import { canonicalJobUrl, jobDuplicateKey } from "./duplicateDetector.js";

export function deduplicateJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const seen = new Set<string>();
  const textSources = new Map<string, string>();
  return jobs.filter((job) => {
    const finalUrlKey = canonicalJobUrl(job.url);
    const duplicateKey = jobDuplicateKey({
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url
    });
    const textKey = job.company && !/confirmar|confidencial|resultado/i.test(job.company) && job.location
      ? jobDuplicateKey({ title: job.title, company: job.company, location: job.location }) : "";
    const key = finalUrlKey || duplicateKey || `${job.source}|${job.externalId}`;
    if (seen.has(key) || (textKey && textSources.has(textKey) && textSources.get(textKey) !== job.source)) return false;
    seen.add(key);
    if (textKey) textSources.set(textKey,job.source);
    return true;
  });
}
