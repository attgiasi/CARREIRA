export function detectEducationRequirement(text: string): { label: string; level: string } {
  const lower = text.toLowerCase();
  if (/doutorado/.test(lower)) return { label: "Doutorado", level: "doutorado" };
  if (/mestrado/.test(lower)) return { label: "Mestrado", level: "mestrado" };
  if (/mba/.test(lower)) return { label: "MBA", level: "mba" };
  if (/pós|pos-graduação|pós-graduação/.test(lower)) return { label: "Pós-graduação", level: "pos_graduacao" };
  if (/superior completo|graduação completa/.test(lower)) return { label: "Superior completo", level: "superior_completo" };
  if (/superior cursando|graduação cursando/.test(lower)) return { label: "Superior cursando", level: "superior_cursando" };
  if (/técnico|tecnico/.test(lower)) return { label: "Técnico", level: "tecnico" };
  if (/ensino médio|ensino medio|2º grau/.test(lower)) return { label: "Ensino médio", level: "ensino_medio" };
  if (/ensino fundamental/.test(lower)) return { label: "Ensino fundamental", level: "ensino_fundamental" };
  return { label: "Não informado", level: "nao_informado" };
}
