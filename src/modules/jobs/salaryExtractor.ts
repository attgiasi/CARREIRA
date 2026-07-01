export function extractSalary(text: string): string {
  const matches = [...text.matchAll(/R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?(?:\s?(?:a|-|até)\s?R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?)?/gi)];
  return matches[0]?.[0] ?? "Não informado";
}

export function salaryNumber(salary: string): number {
  const match = salary.match(/\d{1,3}(?:\.\d{3})*(?:,\d{2})?/);
  if (!match) return 0;
  return Number(match[0].replace(/\./g, "").replace(",", "."));
}
