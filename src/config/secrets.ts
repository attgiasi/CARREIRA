import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

dotenv.config();
const gmailEnvPath = path.resolve(process.cwd(), ".env.gmail");
if (fs.existsSync(gmailEnvPath)) dotenv.config({ path: gmailEnvPath, override: true });

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
    googleCredentialsJson: process.env.GOOGLE_CREDENTIALS_JSON ?? "",
    googleTokenJson: process.env.GOOGLE_TOKEN_JSON ?? "",
    googleCredentialsPath: process.env.GOOGLE_CREDENTIALS_PATH ?? "",
    googleTokenPath: process.env.GOOGLE_TOKEN_PATH ?? "",
    googleCalendarEnabled: process.env.GOOGLE_CALENDAR_ENABLED === "true",
    googleSearchApiKey: process.env.GOOGLE_SEARCH_API_KEY ?? "",
    googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID ?? "",
    accountVaultKey: process.env.ACCOUNT_VAULT_KEY ?? "",
    databaseUrl: process.env.DATABASE_URL ?? "file:./data/jobs.sqlite",
    dashboardPort: Number(dashboardPort)
  };
}

export const secrets = currentSecrets();

export function refreshSecrets(): void {
  Object.assign(secrets, currentSecrets());
}

export function hasGmailSecrets(): boolean {
  const hasLegacyToken = Boolean(secrets.googleClientId && secrets.googleClientSecret && secrets.gmailRefreshToken);
  const hasJsonToken = Boolean(secrets.googleCredentialsJson && secrets.googleTokenJson);
  const hasFileToken = Boolean(
    secrets.googleCredentialsPath &&
    secrets.googleTokenPath &&
    fs.existsSync(path.resolve(secrets.googleCredentialsPath)) &&
    fs.existsSync(path.resolve(secrets.googleTokenPath))
  );
  return hasLegacyToken || hasJsonToken || hasFileToken;
}

export function hasGoogleSearchSecrets(): boolean {
  return Boolean(secrets.googleSearchApiKey && secrets.googleSearchEngineId);
}
