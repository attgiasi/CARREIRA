export function detectSeniority(text: string): string {
  const lower = text.toLowerCase();
  if (/gerente|gerência|gerencia/.test(lower)) return "gerencia";
  if (/coordena/.test(lower)) return "coordenacao";
  if (/supervis/.test(lower)) return "supervisao";
  if (/especialista/.test(lower)) return "especialista";
  if (/analista/.test(lower)) return "analista";
  if (/assistente/.test(lower)) return "assistente";
  if (/auxiliar/.test(lower)) return "auxiliar";
  if (/freela|freelancer|consultor|consultoria/.test(lower)) return "consultoria";
  return "operacional";
}
