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
  const roles = [...new Set(configuredRoles(settings))];
  const locations = [...new Set(configuredLocations(settings))];
  const pairs: Array<{ role: string; location: string }> = [];
  // Rotate the first location per role, then cover every remaining combination.
  for (let round = 0; round < locations.length; round += 1) {
    for (let index = 0; index < roles.length && pairs.length < maxPairs; index += 1) {
      pairs.push({ role: roles[index], location: locations[(index + round) % locations.length] });
    }
  }
  return pairs;
}
