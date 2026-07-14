import crypto from "node:crypto";
import { hasGmailSecrets } from "../../config/secrets.js";
import { RawJob } from "../../types.js";
import { audit, logError } from "../../safety/auditLogger.js";
import { getGmailClient, GmailPayload, isGmailRateLimitError } from "../gmail/gmailClient.js";

const redirectParameters = ["url", "q", "u", "target", "redirect", "redirect_url", "redirect_uri", "destination", "dest"];
const ignoredText = /^(acesse|abrir|aplicar|candidate-se|clique aqui|saiba mais|ver agora|ver detalhes|ver oportunidade|ver vaga)$/i;
const applicationUpdateSubject = /candidatura|processo seletivo|curr[ií]culo (foi |visualizado)|retorno|entrevista|n[aã]o selecionad|thank you for applying|application (was|has been|status)|em an[aá]lise/i;

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function decodeBody(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
}

function payloadText(payload?: GmailPayload): string {
  if (!payload) return "";
  const own = payload.body?.data ? decodeBody(payload.body.data) : "";
  return [own, ...(payload.parts ?? []).map(payloadText)].filter(Boolean).join("\n");
}

function stripHtml(value: string): string {
  return decodeHtml(value.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function unwrapRedirect(value: string, depth = 0): string {
  if (depth > 3) return value;
  let decoded = decodeHtml(value).trim().replace(/[),.;]+$/, "");
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // The link was not percent encoded.
  }
  try {
    const parsed = new URL(decoded);
    for (const parameter of redirectParameters) {
      const target = parsed.searchParams.get(parameter);
      if (target && /^https?%?3a|^https?:/i.test(target)) return unwrapRedirect(target, depth + 1);
    }
    return parsed.toString();
  } catch {
    return decoded;
  }
}

export function isDirectJobLink(value: string): boolean {
  try {
    const url = new URL(unwrapRedirect(value));
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const path = `${url.pathname}${url.search}`.toLowerCase();
    if (!/^https?:$/.test(url.protocol)) return false;
    if (/mail\.google|accounts\.google|googleusercontent|doubleclick|facebook|instagram|youtube/.test(host)) return false;
    if (/unsubscribe|descadastrar|optout|privacy|preferencias|preferences/.test(path)) return false;
    if (/\.(png|jpe?g|gif|webp|svg|css|js|woff2?)(\?|$)/.test(path)) return false;
    if (/^google\./.test(host) && (url.pathname.includes("/search") || url.searchParams.has("q"))) return false;
    if (host.includes("linkedin.com")) return /\/jobs\/view\/\d+/.test(path);
    if (/smartrecruiters/.test(host) && /\/my-applications\//.test(path)) return false;
    if (/greenhouse|lever\.co|gupy\.io|workdayjobs|smartrecruiters|workable|pandape|solides|abler|jobconvo/.test(host)) return true;
    if (/indeed\./.test(host)) return /viewjob|rc\/clk|pagead\/clk/.test(path);
    if (/infojobs\./.test(host)) return /\/vaga-de-[^?]*__\d+\.aspx$/i.test(url.pathname);
    return /\/(jobs?|vagas?|vacancies|oportunidades?|careers?|positions?|recrutamento|apply)(\/|\?|$)/.test(path);
  } catch {
    return false;
  }
}

interface LinkCandidate {
  url: string;
  label: string;
}

export function canonicalJobUrl(value: string): string {
  const unwrapped = unwrapRedirect(value);
  try {
    const url = new URL(unwrapped);
    url.hash = "";
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (/linkedin\.com/.test(host)) {
      const jobId = url.pathname.match(/\/jobs\/view\/(\d+)/)?.[1];
      if (jobId) return `https://www.linkedin.com/jobs/view/${jobId}`;
      url.search = "";
    } else if (/infojobs\./.test(host)) {
      url.search = "";
    } else {
      [...url.searchParams.keys()].forEach((key) => {
        if (/^utm_|^(trk|trackingid|refid|lipi|midtoken|midsig|trkemail|eid|otptoken|source)$/i.test(key)) url.searchParams.delete(key);
      });
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return unwrapped.replace(/\/$/, "");
  }
}

function labelQuality(value: string): number {
  const clean = stripHtml(value);
  if (!clean || ignoredText.test(clean)) return 0;
  if (clean.length < 4 || clean.length > 140) return 1;
  return 3;
}

export function extractDirectJobLinks(content: string): LinkCandidate[] {
  const candidates: LinkCandidate[] = [];
  for (const match of content.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    candidates.push({ url: unwrapRedirect(match[1]), label: stripHtml(match[2]) });
  }
  for (const match of content.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
    candidates.push({ url: unwrapRedirect(match[0]), label: "" });
  }
  const unique = new Map<string, LinkCandidate>();
  candidates.forEach((candidate) => {
    if (!isDirectJobLink(candidate.url)) return;
    const url = canonicalJobUrl(candidate.url);
    const current = unique.get(url);
    if (!current || labelQuality(candidate.label) > labelQuality(current.label)) unique.set(url, { url, label: candidate.label });
  });
  return [...unique.values()];
}

function senderName(value: string): string {
  const visible = value.split("<")[0].replace(/["']/g, "").trim();
  if (visible) return visible;
  const domain = value.match(/@([^>\s]+)/)?.[1] ?? "Gmail";
  return domain.split(".")[0].replace(/\b\w/g, (char) => char.toUpperCase());
}

function usefulTitle(label: string, subject: string, index: number): string {
  const clean = stripHtml(label).replace(/\s*[|·-]\s*(candidate-se|aplicar|ver vaga).*$/i, "").trim();
  if (clean.length >= 4 && clean.length <= 140 && !ignoredText.test(clean)) return clean;
  return index === 0 ? subject : `${subject} · oportunidade ${index + 1}`;
}

function locationFromLink(value: string): string {
  let text = value.toLowerCase();
  try {
    text = decodeURIComponent(text);
  } catch {
    // Keep the original URL when it contains malformed encoding.
  }
  if (/parana|curitiba|londrina|maringa|ponta-grossa/.test(text)) return "Paraná";
  if (/santa-catarina|florianopolis|joinville|blumenau|balneario-camboriu/.test(text)) return "Santa Catarina";
  if (/sao-paulo|campinas|santos|sorocaba|ribeirao-preto/.test(text)) return "São Paulo";
  if (/rio-grande-do-sul|porto-alegre/.test(text)) return "Rio Grande do Sul";
  if (/rio-de-janeiro/.test(text)) return "Rio de Janeiro";
  if (/minas-gerais|belo-horizonte/.test(text)) return "Minas Gerais";
  return "A confirmar";
}

export async function readGmailJobAlerts(maxMessages = 100): Promise<RawJob[]> {
  if (!hasGmailSecrets()) {
    audit("gmailJobAlerts", "scan", "Gmail não configurado; pulando leitura de alertas.");
    return [];
  }
  try {
    const gmail = await getGmailClient();
    if (!gmail) return [];
    const query = 'newer_than:14d (vaga OR vagas OR oportunidade OR oportunidades OR "job alert" OR "alerta de vagas" OR "novas vagas")';
    const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults: Math.min(500, Math.max(1, maxMessages)) });
    const jobs: RawJob[] = [];
    for (const item of list.data.messages ?? []) {
      if (!item.id) continue;
      const message = await gmail.users.messages.get({ userId: "me", id: item.id, format: "full" });
      const headers = message.data.payload?.headers ?? [];
      const subject = headers.find((header) => header.name?.toLowerCase() === "subject")?.value?.trim() || "Alerta de vaga";
      const from = headers.find((header) => header.name?.toLowerCase() === "from")?.value ?? "Gmail";
      const snippet = message.data.snippet ?? "";
      if (applicationUpdateSubject.test(`${subject} ${snippet}`)) continue;
      const body = payloadText(message.data.payload);
      const links = extractDirectJobLinks(`${body}\n${snippet}`).slice(0, 12);
      links.forEach((link, index) => {
        const hash = crypto.createHash("sha256").update(link.url).digest("hex").slice(0, 16);
        jobs.push({
          externalId: `${item.id}:${hash}`,
          title: usefulTitle(link.label, subject, index),
          company: senderName(from),
          location: locationFromLink(link.url),
          source: "gmail",
          url: link.url,
          description: `${subject}. ${stripHtml(snippet)}`.slice(0, 1200),
          raw: { gmailMessageId: item.id, subject, from, extractedFromNewsletter: true }
        });
      });
    }
    audit("gmailJobAlerts", "scan", `Alertas e newsletters lidos: ${list.data.messages?.length ?? 0}; links de vagas: ${jobs.length}.`);
    return jobs;
  } catch (error) {
    logError("gmailJobAlerts", error);
    if (isGmailRateLimitError(error)) throw error;
    return [];
  }
}
