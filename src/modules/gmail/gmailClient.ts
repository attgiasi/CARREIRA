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
  scope?: string;
  token_type?: string;
}

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
  const material = loadOAuthMaterial();
  if (!material) return null;
  if (material.token.access_token && Number(material.token.expiry_date ?? 0) > Date.now() + 60_000) {
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
  const tokenData = await tokenResponse.json() as { access_token?: string };
  return tokenData.access_token ?? null;
}

async function gmailRequest<T>(accessToken: string, url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gmail retornou ${response.status}: ${body.slice(0, 240)}`);
  }
  return response.json() as Promise<T>;
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

export async function getGmailConnectionStatus(): Promise<{ connected: boolean; email: string; messagesTotal: number; error?: string }> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return { connected: false, email: "", messagesTotal: 0, error: "Credencial do Gmail ausente ou expirada." };
    const profile = await gmailRequest<{ emailAddress?: string; messagesTotal?: number }>(
      accessToken,
      "https://gmail.googleapis.com/gmail/v1/users/me/profile"
    );
    return { connected: true, email: profile.emailAddress ?? "", messagesTotal: Number(profile.messagesTotal ?? 0) };
  } catch (error) {
    return {
      connected: false,
      email: "",
      messagesTotal: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
