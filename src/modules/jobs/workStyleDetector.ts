export function detectWorkStyle(text: string): string {
  const lower = text.toLowerCase();
  if (/híbrido|hibrido/.test(lower)) return "hibrido";
  if (/remoto|home office|home-office|teletrabalho/.test(lower)) return "remoto";
  if (/externo|campo/.test(lower)) return "campo_externo";
  return "presencial";
}

export function detectsTravel(text: string): boolean {
  return /viagem|viajar|disponibilidade para viagens/i.test(text);
}
