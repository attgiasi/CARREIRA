export function platformCanBeAutomated(platform: string): boolean {
  const normalized = platform.toLowerCase();
  if (normalized.includes("linkedin")) return false;
  if (normalized.includes("indeed")) return false;
  return ["greenhouse", "lever"].some((allowed) => normalized.includes(allowed));
}

export function platformRuleSummary(platform: string): string {
  if (!platformCanBeAutomated(platform)) return "Modo seguro: apenas leitura de alertas, preparação de texto e assistência manual.";
  return "API pública permitida quando configurada; envio ainda depende de aprovação.";
}
