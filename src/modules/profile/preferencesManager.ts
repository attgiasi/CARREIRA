import { AgentSettings } from "../../types.js";

export function targetRoles(settings: AgentSettings): string[] {
  const prefs = settings.jobSearchPreferences as { targetRoles?: string[] };
  return prefs.targetRoles ?? [];
}

export function acceptsCareerLevel(settings: AgentSettings, level: string): boolean {
  const prefs = settings.jobSearchPreferences as { careerLevels?: Record<string, boolean> };
  return prefs.careerLevels?.[level] ?? true;
}
