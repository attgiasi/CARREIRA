import { hasGmailSecrets, secrets } from "../../config/secrets.js";

export interface GmailClientLike {
  users: {
    messages: {
      list(args: Record<string, unknown>): Promise<{ data: { messages?: Array<{ id?: string }> } }>;
      get(args: Record<string, unknown>): Promise<{ data: { payload?: { headers?: Array<{ name?: string; value?: string }> }; snippet?: string } }>;
    };
    drafts: {
      create(args: Record<string, unknown>): Promise<{ data: { id?: string } }>;
    };
  };
}

export async function getGmailClient(): Promise<GmailClientLike | null> {
  if (!hasGmailSecrets()) return null;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: secrets.googleClientId,
      client_secret: secrets.googleClientSecret,
      refresh_token: secrets.gmailRefreshToken,
      grant_type: "refresh_token"
    })
  });
  if (!tokenResponse.ok) return null;
  const tokenData = await tokenResponse.json() as { access_token?: string };
  const accessToken = tokenData.access_token;
  if (!accessToken) return null;
  const request = async <T>(url: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) }
    });
    return response.json() as Promise<T>;
  };
  return {
    users: {
      messages: {
        list: async (args) => request(`https://gmail.googleapis.com/gmail/v1/users/${args.userId}/messages?q=${encodeURIComponent(String(args.q ?? ""))}&maxResults=${args.maxResults ?? 20}`),
        get: async (args) => request(`https://gmail.googleapis.com/gmail/v1/users/${args.userId}/messages/${args.id}?format=${args.format ?? "full"}`)
      },
      drafts: {
        create: async (args) => request(`https://gmail.googleapis.com/gmail/v1/users/${args.userId}/drafts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args.requestBody)
        })
      }
    }
  };
}
