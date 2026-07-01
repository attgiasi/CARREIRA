import { AgentSettings } from "../../types.js";

const order = ["ensino_fundamental", "ensino_medio", "tecnico", "superior_cursando", "superior_completo", "pos_graduacao", "mba", "mestrado", "doutorado"];

export function educationRank(level: string): number {
  return Math.max(0, order.indexOf(level));
}

export function userMeetsEducation(settings: AgentSettings, required: string): boolean {
  return educationRank(settings.profile.education.highestLevel) >= educationRank(required);
}
