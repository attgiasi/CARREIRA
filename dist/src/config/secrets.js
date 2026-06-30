import dotenv from "dotenv";
dotenv.config();
export const secrets = {
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
    gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN ?? "",
    googleCalendarEnabled: process.env.GOOGLE_CALENDAR_ENABLED === "true",
    databaseUrl: process.env.DATABASE_URL ?? "file:./data/jobs.sqlite",
    dashboardPort: Number(process.env.DASHBOARD_PORT ?? "8788")
};
export function hasGmailSecrets() {
    return Boolean(secrets.googleClientId && secrets.googleClientSecret && secrets.googleRedirectUri && secrets.gmailRefreshToken);
}
