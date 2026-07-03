import dotenv from "dotenv";

dotenv.config();

function currentSecrets() {
  const dashboardPort = process.env.PORT || process.env.DASHBOARD_PORT || "8788";
  return {
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    geminiModel: process.env.GEMINI_MODEL ?? "gemini-1.5-flash",
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
    gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN ?? "",
    googleCalendarEnabled: process.env.GOOGLE_CALENDAR_ENABLED === "true",
    googleSearchApiKey: process.env.GOOGLE_SEARCH_API_KEY ?? "",
    googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID ?? "",
    databaseUrl: process.env.DATABASE_URL ?? "file:./data/jobs.sqlite",
    dashboardPort: Number(dashboardPort)
  };
}

export const secrets = currentSecrets();

export function refreshSecrets(): void {
  Object.assign(secrets, currentSecrets());
}

export function hasGmailSecrets(): boolean {
  return Boolean(secrets.googleClientId && secrets.googleClientSecret && secrets.googleRedirectUri && secrets.gmailRefreshToken);
}

export function hasGoogleSearchSecrets(): boolean {
  return Boolean(secrets.googleSearchApiKey && secrets.googleSearchEngineId);
}
