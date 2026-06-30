import { AgentSettings } from "../types.js";

export function assertApplicationAllowed(settings: AgentSettings): void {
  if (settings.agent.dryRun) throw new Error("Candidatura bloqueada: dry-run está ativo.");
  if (settings.applications.requireApprovalBeforeApply !== false) {
    throw new Error("Candidatura bloqueada: aprovação do usuário é obrigatória.");
  }
  if (settings.applications.neverMassApplyWithoutApproval !== false) {
    throw new Error("Candidatura em massa bloqueada por política de segurança.");
  }
}

export function validateTruthfulText(text: string): string {
  const forbidden = ["fluente em inglês", "mestrado", "doutorado", "certificado", "CNH B"];
  const lower = text.toLowerCase();
  for (const term of forbidden) {
    if (lower.includes(term.toLowerCase())) {
      return `Revisar afirmação sensível antes de usar: ${term}`;
    }
  }
  return "";
}
