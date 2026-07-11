import { AgentSettings } from "../types.js";

export type SettingsExportScope = "github" | "private";

export interface PortableSettingsEnvelope {
  product: "apice-career-agent";
  schemaVersion: 1;
  scope: SettingsExportScope;
  exportedAt: string;
  notice: string;
  settings: Record<string, unknown>;
}

const forbiddenKey = /(api.?key|password|passwd|senha|secret|token|credential|cookie|cpf|\brg\b|birth|nascimento)/i;
const unsafeObjectKeys = new Set(["__proto__", "prototype", "constructor"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !unsafeObjectKeys.has(key) && !forbiddenKey.test(key))
      .map(([key, child]) => [key, scrub(child)])
  );
}

function githubSettings(settings: AgentSettings): Record<string, unknown> {
  return scrub({
    agent: {
      enabled: settings.agent.enabled,
      paused: settings.agent.paused,
      dryRun: settings.agent.dryRun,
      timezone: settings.agent.timezone,
      runEveryHours: settings.agent.runEveryHours,
      maxJobsPerRun: settings.agent.maxJobsPerRun
    },
    ai: settings.ai,
    profile: {
      city: settings.profile.city,
      state: settings.profile.state,
      country: settings.profile.country,
      summary: settings.profile.summary,
      education: settings.profile.education,
      driverLicense: settings.profile.driverLicense
    },
    careerTracks: settings.careerTracks,
    jobSearchPreferences: settings.jobSearchPreferences,
    salaryPreferences: settings.salaryPreferences,
    informalWork: settings.informalWork,
    sources: settings.sources,
    strategy: settings.strategy,
    applications: settings.applications,
    platformRules: settings.platformRules,
    safety: settings.safety,
    badJobDetection: settings.badJobDetection
  }) as Record<string, unknown>;
}

export function exportSettings(settings: AgentSettings, scope: SettingsExportScope): PortableSettingsEnvelope {
  const isPrivate = scope === "private";
  return {
    product: "apice-career-agent",
    schemaVersion: 1,
    scope,
    exportedAt: new Date().toISOString(),
    notice: isPrivate
      ? "Backup privado com dados pessoais do perfil. Não publique no GitHub. Chaves e credenciais são sempre removidas."
      : "Preferências portáteis sem nome, e-mail, telefone, documentos ou credenciais. Adequado para versionar no GitHub.",
    settings: isPrivate
      ? scrub(settings) as Record<string, unknown>
      : githubSettings(settings)
  };
}

function mergeObjects(base: unknown, incoming: unknown): unknown {
  if (Array.isArray(incoming)) return incoming.map(scrub);
  if (!isPlainObject(incoming)) return incoming;
  const result: Record<string, unknown> = isPlainObject(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(incoming)) {
    if (unsafeObjectKeys.has(key) || forbiddenKey.test(key)) continue;
    result[key] = mergeObjects(result[key], value);
  }
  return result;
}

export function importSettings(input: unknown, current: AgentSettings): AgentSettings {
  if (!isPlainObject(input)) throw new Error("O arquivo precisa conter um objeto JSON.");

  let scope: SettingsExportScope = "private";
  let settingsInput: unknown = input;
  if ("product" in input || "schemaVersion" in input || "settings" in input) {
    if (input.product !== "apice-career-agent" || input.schemaVersion !== 1 || !isPlainObject(input.settings)) {
      throw new Error("Arquivo de configuração incompatível com esta versão do Ápice.");
    }
    scope = input.scope === "github" ? "github" : "private";
    settingsInput = input.settings;
  }

  const cleaned = scope === "github"
    ? githubSettings(mergeObjects(current, settingsInput) as AgentSettings)
    : scrub(settingsInput);
  const merged = mergeObjects(current, cleaned) as AgentSettings;

  if (!merged.agent || !merged.profile || !merged.jobSearchPreferences || !merged.applications) {
    throw new Error("A configuração não contém todas as seções obrigatórias.");
  }
  return merged;
}
