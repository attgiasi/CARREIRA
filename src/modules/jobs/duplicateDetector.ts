const trackingParams = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid"
]);

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function compactText(value: unknown): string {
  return stripAccents(String(value ?? "").toLowerCase())
    .replace(/\b(vaga|emprego|oportunidade|contratando|hiring|trabalhe conosco)\b/g, " ")
    .replace(/\b(em|para|de|do|da|no|na|at|the|a|o)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function locationKey(value: unknown): string {
  return compactText(value)
    .replace(/\b(pr|parana|brasil|regiao metropolitana)\b/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function canonicalJobUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.hash = "";
    for (const param of [...url.searchParams.keys()]) {
      if (trackingParams.has(param.toLowerCase())) url.searchParams.delete(param);
    }
    if (url.hostname.includes("indeed.") && url.searchParams.has("jk")) {
      return `indeed:${url.searchParams.get("jk")}`;
    }
    const infoJobsId = url.pathname.match(/__(\d+)\.aspx/i)?.[1];
    if (infoJobsId) return `infojobs:${infoJobsId}`;
    const linkedInId = url.pathname.match(/\/jobs\/view\/(?:[^/]+-)?(\d+)/i)?.[1];
    if (linkedInId) return `linkedin:${linkedInId}`;
    const cleanPath = url.pathname.replace(/\/+$/, "").toLowerCase();
    return `${url.hostname.replace(/^www\./, "").toLowerCase()}${cleanPath}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""}`;
  } catch {
    return "";
  }
}

export function jobDuplicateKey(row: Record<string, unknown>): string {
  const urlKey = canonicalJobUrl(row.url);
  if (urlKey) return `url:${urlKey}`;
  const title = compactText(row.title);
  const company = compactText(row.company);
  const location = locationKey(row.location);
  if (!title) return "";
  return `text:${title}|${company || "empresa"}|${location || "local"}`;
}

export function attachDuplicateMetadata<T extends Record<string, unknown>>(rows: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = jobDuplicateKey(row);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return rows.map((row) => {
    const key = jobDuplicateKey(row);
    const group = key ? groups.get(key) ?? [] : [];
    const sources = [...new Set(group.map((item) => String(item.source ?? "")).filter(Boolean))];
    const isCrossSourceDuplicate = sources.length > 1;
    return {
      ...row,
      duplicate_key: key,
      duplicate_count: isCrossSourceDuplicate ? group.length : 1,
      duplicate_source_count: sources.length,
      duplicate_sources: isCrossSourceDuplicate ? sources.join(", ") : ""
    };
  });
}

export function countDuplicateGroups(rows: Record<string, unknown>[]): number {
  const groups = new Map<string, number>();
  for (const row of rows) {
    const key = jobDuplicateKey(row);
    if (!key) continue;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return [...groups.entries()].filter(([key, total]) => {
    if (total <= 1) return false;
    const sources = new Set(rows.filter((row) => jobDuplicateKey(row) === key).map((row) => String(row.source ?? "")));
    return sources.size > 1;
  }).length;
}
