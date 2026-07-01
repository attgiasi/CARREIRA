import fs from "node:fs";
import path from "node:path";
import { AgentSettings } from "../types.js";

const settingsPath = path.resolve(process.cwd(), "agent-settings.json");

export function loadSettings(): AgentSettings {
  const raw = fs.readFileSync(settingsPath, "utf8");
  return JSON.parse(raw) as AgentSettings;
}

export function saveSettings(settings: AgentSettings): void {
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
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
