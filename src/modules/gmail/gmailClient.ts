import fs from "node:fs";
import path from "node:path";
import { hasGmailSecrets, secrets } from "../../config/secrets.js";

export interface GmailHeader {
  name?: string;
  value?: string;
}

export interface GmailPayload {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPayload[];
}

export interface GmailMessageData {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  internalDate?: string;
  snippet?: string;
  payload?: GmailPayload;
}

export interface GmailClientLike {
  users: {
    messages: {
      list(args: Record<string, unknown>): Promise<{ data: { messages?: Array<{ id?: string }>; nextPageToken?: string; resultSizeEstimate?: number } }>;
      get(args: Record<string, unknown>): Promise<{ data: GmailMessageData }>;
    };
    drafts: {
      create(args: Record<string, unknown>): Promise<{ data: { id?: string } }>;
    };
  };
}

interface GoogleCredentials {
  installed?: GoogleCredentialConfig;
  web?: GoogleCredentialConfig;
  client_id?: string;
  client_secret?: string;
  redirect_uris?: string[];
}

interface GoogleCredentialConfig {
  client_id?: string;
  client_secret?: string;
  redirect_uris?: string[];
}

interface GoogleToken {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export interface GmailConnectionStatus {
  connected: boolean;
  email: string;
  messagesTotal: number;
  rateLimited?: boolean;
  retryAfter?: string;
  warning?: string;
  error?: string;
  cached?: boolean;
}

let cachedAccessToken = "";
let cachedAccessTokenExpiresAt = 0;
let cachedConnectionStatus: GmailConnectionStatus | null = null;
let cachedConnectionStatusExpiresAt = 0;
let gmailRateLimitedUntil = 0;

function parseJson<T>(value: string): T | null {
  if (!value.trim()) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function readJsonFile<T>(value: string): T | null {
  if (!value.trim()) return null;
  try {
    const file = path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function loadOAuthMaterial(): { credentials: GoogleCredentialConfig; token: GoogleToken } | null {
  const credentialsDocument = parseJson<GoogleCredentials>(secrets.googleCredentialsJson) ?? readJsonFile<GoogleCredentials>(secrets.googleCredentialsPath);
  const tokenDocument = parseJson<GoogleToken>(secrets.googleTokenJson) ?? readJsonFile<GoogleToken>(secrets.googleTokenPath);
  if (credentialsDocument && tokenDocument) {
    const credentials = credentialsDocument.installed ?? credentialsDocument.web ?? credentialsDocument;
    if (credentials.client_id && credentials.client_secret && tokenDocument.refresh_token) return { credentials, token: tokenDocument };
  }
  if (secrets.googleClientId && secrets.googleClientSecret && secrets.gmailRefreshToken) {
    return {
      credentials: {
        client_id: secrets.googleClientId,
        client_secret: secrets.googleClientSecret,
        redirect_uris: secrets.googleRedirectUri ? [secrets.googleRedirectUri] : []
      },
      token: { refresh_token: secrets.gmailRefreshToken }
    };
  }
  return null;
}

async function getAccessToken(): Promise<string | null> {
  if (cachedAccessToken && cachedAccessTokenExpiresAt > Date.now() + 60_000) return cachedAccessToken;
  const material = loadOAuthMaterial();
  if (!material) return null;
  if (material.token.access_token && Number(material.token.expiry_date ?? 0) > Date.now() + 60_000) {
    cachedAccessToken = material.token.access_token;
    cachedAccessTokenExpiresAt = Number(material.token.expiry_date);
    return material.token.access_token;
  }
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: String(material.credentials.client_id ?? ""),
      client_secret: String(material.credentials.client_secret ?? ""),
      refresh_token: String(material.token.refresh_token ?? ""),
      grant_type: "refresh_token"
    })
  });
  if (!tokenResponse.ok) return null;
  const tokenData = await tokenResponse.json() as { access_token?: string; expires_in?: number };
  if (!tokenData.access_token) return null;
  cachedAccessToken = tokenData.access_token;
  cachedAccessTokenExpiresAt = Date.now() + Math.max(300, Number(tokenData.expires_in ?? 3600)) * 1000;
  return cachedAccessToken;
}

async function gmailRequest<T>(accessToken: string, url: string, init: RequestInit = {}): Promise<T> {
  if (gmailRateLimitedUntil > Date.now()) {
    throw new Error(`Gmail retornou 429; tentar novamente após ${new Date(gmailRateLimitedUntil).toISOString()}: pausa local de proteção ativa.`);
  }
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) }
  });
  if (!response.ok) {
    const body = await response.text();
    const retryHeader = response.headers.get("retry-after")?.trim() ?? "";
    const retryInBody = body.match(/Retry after\s+([^"\s]+)/i)?.[1] ?? "";
    const retryAfter = retryHeader || retryInBody;
    if (response.status === 429) {
      const retryTimestamp = /^\d+$/.test(retryAfter)
        ? Date.now() + Number(retryAfter) * 1000
        : Date.parse(retryAfter);
      gmailRateLimitedUntil = Math.max(
        Number.isFinite(retryTimestamp) ? retryTimestamp : 0,
        Date.now() + 30 * 60_000
      );
    }
    throw new Error(`Gmail retornou ${response.status}${retryAfter ? `; tentar novamente após ${retryAfter}` : ""}: ${body.slice(0, 240)}`);
  }
  return response.json() as Promise<T>;
}

export function gmailRetryAfterFromError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const raw = message.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/i)?.[0] ?? "";
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

export function gmailProtectedRetryAfter(error: unknown, failedAt = "", minimumMinutes = 30): string {
  const providerRetry = Date.parse(gmailRetryAfterFromError(error));
  const normalizedFailure = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(failedAt)
    ? `${failedAt.replace(" ", "T")}Z`
    : failedAt;
  const failureTime = Date.parse(normalizedFailure);
  const protectedRetry = Number.isFinite(failureTime)
    ? failureTime + Math.max(15, minimumMinutes) * 60_000
    : 0;
  const resolved = Math.max(Number.isFinite(providerRetry) ? providerRetry : 0, protectedRetry);
  return resolved ? new Date(resolved).toISOString() : "";
}

export function isGmailRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Gmail retornou 429|user-rate limit exceeded|rateLimitExceeded/i.test(message);
}

function cacheConnectionStatus(status: GmailConnectionStatus, ttlMs: number): GmailConnectionStatus {
  cachedConnectionStatus = status;
  cachedConnectionStatusExpiresAt = Date.now() + Math.max(5_000, ttlMs);
  return status;
}

export async function getGmailClient(): Promise<GmailClientLike | null> {
  if (!hasGmailSecrets()) return null;
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  return {
    users: {
      messages: {
        list: async (args) => {
          const query = new URLSearchParams({
            q: String(args.q ?? ""),
            maxResults: String(args.maxResults ?? 100)
          });
          if (args.pageToken) query.set("pageToken", String(args.pageToken));
          const data = await gmailRequest<{ messages?: Array<{ id?: string }>; nextPageToken?: string; resultSizeEstimate?: number }>(
            accessToken,
            `https://gmail.googleapis.com/gmail/v1/users/${args.userId ?? "me"}/messages?${query.toString()}`
          );
          return { data };
        },
        get: async (args) => {
          const data = await gmailRequest<GmailMessageData>(
            accessToken,
            `https://gmail.googleapis.com/gmail/v1/users/${args.userId ?? "me"}/messages/${args.id}?format=${args.format ?? "full"}`
          );
          return { data };
        }
      },
      drafts: {
        create: async (args) => {
          const data = await gmailRequest<{ id?: string }>(
            accessToken,
            `https://gmail.googleapis.com/gmail/v1/users/${args.userId ?? "me"}/drafts`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(args.requestBody)
            }
          );
          return { data };
        }
      }
    }
  };
}

export async function getGmailConnectionStatus(): Promise<GmailConnectionStatus> {
  if (cachedConnectionStatus && cachedConnectionStatusExpiresAt > Date.now()) {
    return { ...cachedConnectionStatus, cached: true };
  }
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return cacheConnectionStatus(
        { connected: false, email: "", messagesTotal: 0, error: "Credencial do Gmail ausente ou expirada." },
        30_000
      );
    }
    if (gmailRateLimitedUntil > Date.now()) {
      const retryAfter = new Date(gmailRateLimitedUntil).toISOString();
      return cacheConnectionStatus({
        connected: true,
        email: cachedConnectionStatus?.email ?? "",
        messagesTotal: cachedConnectionStatus?.messagesTotal ?? 0,
        rateLimited: true,
        retryAfter,
        warning: "Conta autorizada. O Google aplicou uma pausa temporária por excesso de leituras; o Ápice tentará novamente automaticamente."
      }, gmailRateLimitedUntil - Date.now() + 5_000);
    }
    const profile = await gmailRequest<{ emailAddress?: string; messagesTotal?: number }>(
      accessToken,
      "https://gmail.googleapis.com/gmail/v1/users/me/profile"
    );
    return cacheConnectionStatus(
      { connected: true, email: profile.emailAddress ?? "", messagesTotal: Number(profile.messagesTotal ?? 0) },
      5 * 60_000
    );
  } catch (error) {
    if (isGmailRateLimitError(error)) {
      const retryAfter = gmailRetryAfterFromError(error);
      const retryAt = Date.parse(retryAfter);
      const ttl = Number.isFinite(retryAt) ? Math.min(15 * 60_000, Math.max(30_000, retryAt - Date.now() + 5_000)) : 60_000;
      return cacheConnectionStatus({
        connected: true,
        email: cachedConnectionStatus?.email ?? "",
        messagesTotal: cachedConnectionStatus?.messagesTotal ?? 0,
        rateLimited: true,
        retryAfter,
        warning: "Conta autorizada. O Google aplicou uma pausa temporária por excesso de leituras; o Ápice tentará novamente automaticamente."
      }, ttl);
    }
    return {
      connected: false,
      email: "",
      messagesTotal: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
