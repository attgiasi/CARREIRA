import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { load } from "cheerio";
import { parse } from "devalue";
import { RawJob } from "../../types.js";
import { canonicalJobUrl } from "../jobs/duplicateDetector.js";

type RecordValue = Record<string, any>;
const maxBytes = 3 * 1024 * 1024;

export function isPublicIPv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return false;
  const [a, b] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && [0, 168].includes(b)) || (a === 198 && [18, 19, 51].includes(b)) ||
    (a === 203 && b === 0) || (a === 100 && b >= 64 && b <= 127));
}

export async function readPublicPage(value: string, redirects = 0): Promise<{ html: string; url: string }> {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("A fonte deve usar HTTPS publico, sem credenciais na URL.");
  }
  if (redirects > 3) throw new Error("A fonte redirecionou muitas vezes.");
  const addresses = await lookup(url.hostname, { family: 4, all: true });
  if (!addresses.length || addresses.some(x => !isPublicIPv4(x.address))) throw new Error("Endereco privado ou reservado bloqueado.");
  // Pin the validated IP for this connection; redirects repeat the validation.
  const result = await new Promise<{ status: number; html: string; location?: string }>((resolve, reject) => {
    const req = request(url, {
      lookup: ((_host: string, options: any, callback: any) => options?.all
        ? callback(null, [addresses[0]]) : callback(null, addresses[0].address, 4)) as any,
      headers: { "User-Agent": "ApiceJobReader/1.0", Accept: "text/html, application/json", "Accept-Encoding": "identity" },
      signal: AbortSignal.timeout(12000)
    }, response => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", chunk => {
        size += chunk.length;
        if (size > maxBytes) req.destroy(new Error("Resposta da fonte excede o limite de tamanho."));
        else chunks.push(Buffer.from(chunk));
      });
      response.on("error", reject);
      response.on("end", () => resolve({status: response.statusCode || 0, html: Buffer.concat(chunks).toString("utf8"), location: response.headers.location}));
    });
    req.on("error", reject);
    req.end();
  });
  if (result.status >= 300 && result.status < 400 && result.location) return readPublicPage(new URL(result.location, url).toString(), redirects + 1);
  if (result.status !== 200) throw new Error(`Fonte indisponivel (HTTP ${result.status}).`);
  return { html: result.html, url: url.toString() };
}

export function isSearchPage(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return !["https:", "http:"].includes(url.protocol) ||
      /(^|\.)(google\.[a-z.]+|bing.com|duckduckgo.com)$/.test(host) ||
      /\/(?:search|pesquisa|busca)(?:\/|$)/i.test(url.pathname) ||
      /^\/(?:jobs|vagas|careers)\/?$/i.test(url.pathname) ||
      (host.endsWith("infojobs.com.br") && !/__\d+\.aspx/i.test(url.pathname) && !host.startsWith("pandape.")) ||
      (host === "jobs.quickin.io" && !/^\/[^/]+\/jobs\/[^/]+\/?$/.test(url.pathname));
  } catch { return true; }
}

export function plainText(value: unknown): string {
  const $ = load(String(value || ""));
  $("script,style").remove();
  $("p,li,br,h1,h2,h3").after(" ");
  return $.root().text().replace(/\s+/g, " ").trim();
}

function structuredSalary(salary: RecordValue | undefined): string {
  if (!salary || salary.currency !== "BRL") return "Nao informado";
  const amount = salary.value;
  const minimum = Number(amount?.minValue ?? amount?.value ?? (typeof amount === "number" ? amount : 0));
  const maximum = Number(amount?.maxValue || minimum);
  if (!minimum || !Number.isFinite(minimum) || !Number.isFinite(maximum)) return "Nao informado";
  const unit = String(amount?.unitText || "").toUpperCase();
  if (!unit) return "Nao informado";
  const units: Record<string, string> = { MONTH: "mensal", YEAR: "anual", HOUR: "por hora", DAY: "por dia", WEEK: "por semana" };
  if (!units[unit]) return "Nao informado";
  const money = (n: number) => `R$ ${n.toLocaleString("pt-BR", {minimumFractionDigits:2})}`;
  return `${money(minimum)}${maximum > minimum ? ` a ${money(maximum)}` : ""} ${units[unit]}`;
}

export function parseQuickinJobs(docs: RecordValue[], company = "Empresa a confirmar"): RawJob[] {
  return docs.filter(j => j.publicate === "published" && j.title && j.description && j.career_url && !isSearchPage(j.career_url)).map(j => ({
    externalId: canonicalJobUrl(j.career_url), title: plainText(j.title), company: plainText(j.company_id?.name || company),
    location: [j.city, j.region].filter(Boolean).join(", "), source: "quickin", url: String(j.career_url),
    description: plainText([j.description, j.requirements, j.benefits, j.contract_id?.name, j.workplace_type === "remote" ? "Remoto" : j.workplace_type === "hybrid" ? "Hibrido" : "Presencial"].filter(Boolean).join(" ")),
    salary: structuredSalary({currency:j.currency, value:{value:j.remuneration,unitText:String(j.remuneration_period || "").toUpperCase()}}),
    raw: { verifiedAt: new Date().toISOString(), verification: "published_on_source", postedAt: j.created_at || "", applicationUrl: j.career_url }
  }));
}

export function parseJobPage(html: string, pageUrl: string, now = new Date()): RawJob[] {
  if (isSearchPage(pageUrl)) return [];
  const $ = load(html);
  const jobs: RawJob[] = [];
  function visit(value: unknown, depth = 0): void {
    if (!value || depth > 16 || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(item => visit(item, depth + 1)); return; }
    const posting = value as RecordValue;
    const types = Array.isArray(posting["@type"]) ? posting["@type"] : [posting["@type"]];
    if (types.includes("JobPosting")) {
      if (!posting.title || !posting.description || !posting.hiringOrganization?.name) return;
      if (posting.validThrough && Date.parse(posting.validThrough) < now.getTime()) return;
      let url: string;
      try { url = new URL(posting.url || pageUrl, pageUrl).toString(); } catch { return; }
      if (isSearchPage(url)) return;
      const places = Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation];
      const location = places.filter(Boolean).map(p => [p.address?.addressLocality, p.address?.addressRegion].filter(Boolean).join(", ")).join("; ");
      jobs.push({externalId: canonicalJobUrl(url), title: plainText(posting.title), company: plainText(posting.hiringOrganization.name),
        location: location || (posting.jobLocationType === "TELECOMMUTE" ? "Remoto" : "A confirmar"),
        description: plainText(`${posting.description} ${posting.employmentType || ""}`), salary: structuredSalary(posting.baseSalary),
        url, source: new URL(pageUrl).hostname.replace(/^www\./, ""),
        raw: { verifiedAt: now.toISOString(), verification: "job_posting", postedAt: posting.datePosted || "", validThrough: posting.validThrough || "", applicationUrl: url }
      });
    } else if (posting["@graph"]) visit(posting["@graph"], depth + 1);
  }
  $('script[type="application/ld+json"]').each((_i, el) => { try { visit(JSON.parse($(el).text())); } catch { /* Invalid structured data is not a verified job. */ } });
  if (new URL(pageUrl).hostname === "jobs.quickin.io") {
    try {
      const state = parse($("#__NUXT_DATA__").text(), {Reactive: x => x, ShallowReactive: x => x}) as RecordValue;
      const job = state.pinia?.job?.job;
      const candidates = job?._id ? [job] : Object.values(job || {}).filter((j: any) => j?._id);
      const quickinJobs = parseQuickinJobs(candidates as RecordValue[],state.pinia?.careerSite?.site?.name);
      if (quickinJobs.length) return quickinJobs;
    } catch { /* A page requiring login is not treated as a job. */ }
  }
  return jobs;
}

export async function readJobPage(url: string): Promise<RawJob[]> {
  if (isSearchPage(url)) return [];
  const page = await readPublicPage(url);
  return parseJobPage(page.html, page.url);
}

export function extractJobLinks(html: string, baseUrl: string): string[] {
  const $ = load(html);
  const urls = new Set<string>();
  $("a[href]").each((_i, el) => {
    try {
      const url = new URL($(el).attr("href") || "", baseUrl);
      if (url.protocol === "https:" && !isSearchPage(url.toString()) && /\/(?:jobs?|vagas?|careers?)\/[^/]+|__\d+\.aspx|\/viewjob\?/.test(url.toString())) urls.add(url.toString());
    } catch { /* Ignore malformed links. */ }
  });
  return [...urls];
}
