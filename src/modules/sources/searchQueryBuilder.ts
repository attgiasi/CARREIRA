import { AgentSettings } from "../../types.js";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export function configuredRoles(settings: AgentSettings): string[] {
  const roles = asStringArray((settings.jobSearchPreferences as { targetRoles?: unknown }).targetRoles);
  return roles.length ? roles : ["Atendimento", "Bartender", "Eventos", "Backoffice"];
}

export function configuredLocations(settings: AgentSettings): string[] {
  const locations = asStringArray(((settings.jobSearchPreferences as { locations?: { preferred?: unknown } }).locations ?? {}).preferred);
  return locations.length ? locations : [`${settings.profile.city}/${settings.profile.state}`];
}

export function limitedSearchPairs(settings: AgentSettings, maxPairs = 18): Array<{ role: string; location: string }> {
  const roles = configuredRoles(settings).slice(0, 9);
  const locations = configuredLocations(settings).slice(0, 6);
  const pairs: Array<{ role: string; location: string }> = [];
  const seen = new Set<string>();
  for (let index = 0; pairs.length < maxPairs && index < roles.length * locations.length * 2; index += 1) {
    const role = roles[index % roles.length];
    const location = locations[index % locations.length];
    const key = `${role}|${location}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ role, location });
  }
  return pairs;
}
