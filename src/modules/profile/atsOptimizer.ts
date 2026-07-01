import { realExperienceKeywords } from "./careerProfile.js";

export function atsSuggestions(description: string): { present: string[]; missingButPossible: string[]; gaps: string[] } {
  const text = description.toLowerCase();
  const known = realExperienceKeywords();
  const present = known.filter((keyword) => text.includes(keyword));
  const possible = ["Excel", "CRM", "indicadores", "relatórios", "treinamento", "padronização"].filter((keyword) => text.includes(keyword.toLowerCase()));
  const gaps = ["inglês", "Power BI", "CNH", "veículo próprio"].filter((keyword) => text.includes(keyword.toLowerCase()));
  return { present, missingButPossible: possible, gaps };
}
