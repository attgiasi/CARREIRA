import fs from "node:fs";
import path from "node:path";
import { AgentSettings } from "../types.js";

const settingsPath = path.resolve(process.cwd(), "agent-settings.json");
const localSettingsPath = path.resolve(process.cwd(), "agent-settings.local.json");

export function loadSettings(): AgentSettings {
  const source = fs.existsSync(localSettingsPath) ? localSettingsPath : settingsPath;
  const raw = fs.readFileSync(source, "utf8");
  return JSON.parse(raw) as AgentSettings;
}

export function saveSettings(settings: AgentSettings): void {
  fs.writeFileSync(localSettingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

export function ensureRuntimeFolders(): void {
  for (const folder of [
    "data",
    "logs",
    "resumes",
    "generated/resumes",
    "generated/cover-letters",
    "generated/application-packets",
    "generated/landing-page",
    "generated/reports"
  ]) {
    fs.mkdirSync(path.resolve(process.cwd(), folder), { recursive: true });
  }
}
