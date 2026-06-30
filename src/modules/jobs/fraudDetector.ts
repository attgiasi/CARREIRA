export function fraudClassification(riskScore: number): string {
  if (riskScore >= 80) return "Golpe provável";
  if (riskScore >= 60) return "Suspeita";
  return "Sem alerta crítico";
}
