export interface BaseSalary {
  raw: string;
  informed: boolean;
  monthly: boolean;
  variableOnly: boolean;
  minimum: number;
  maximum: number;
  midpoint: number;
}

export interface SalaryDistributionRow {
  id: string;
  label: string;
  total: number;
  color: string;
}

function moneyNumber(value: string): number {
  if (value.includes(".")) return Number(value.replace(/\./g, "").replace(",", "."));
  return Number(value.replace(",", "."));
}

export function parseBaseSalary(value: unknown): BaseSalary {
  const raw = String(value ?? "").trim();
  const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const unavailable = !raw || /nao informado|a combinar|combinar|confidencial|negociavel/.test(normalized);
  const nonMonthly = /por\s+(hora|dia|evento|turno)|\/\s*(hora|dia)|diaria|freela|freelancer/.test(normalized);
  const variableTerms = /bonifica|gratifica|beneficio|comissao|gorjeta|premiacao|variavel/.test(normalized);
  const baseMarker = /salario|remuneracao|fixo|base/.test(normalized);
  const variableOnly = variableTerms && !baseMarker;
  const matches = unavailable
    ? []
    : [...raw.matchAll(/\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{4,}(?:,\d{2})?|\d{1,3},\d{2}/g)].map((match) => moneyNumber(match[0])).filter((number) => Number.isFinite(number) && number > 0);
  if (!matches.length || variableOnly) {
    return { raw, informed: false, monthly: !nonMonthly, variableOnly, minimum: 0, maximum: 0, midpoint: 0 };
  }
  const minimum = Math.min(...matches);
  const maximum = Math.max(...matches);
  return {
    raw,
    informed: true,
    monthly: !nonMonthly,
    variableOnly,
    minimum,
    maximum,
    midpoint: Math.round((minimum + maximum) / 2)
  };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function buildSalaryAnalytics(rows: Array<Record<string, unknown>>, target = 3000): Record<string, unknown> {
  const parsed = rows.map((row) => parseBaseSalary(row.salary));
  const monthly = parsed.filter((item) => item.informed && item.monthly);
  const nonMonthly = parsed.filter((item) => item.informed && !item.monthly);
  const notInformed = parsed.length - monthly.length - nonMonthly.length;
  const guaranteed = monthly.map((item) => item.minimum);
  const distribution: SalaryDistributionRow[] = [
    { id: "under_2000", label: "Até R$ 1.999", total: guaranteed.filter((value) => value < 2000).length, color: "#c15f4a" },
    { id: "2000_2999", label: "R$ 2.000 a 2.999", total: guaranteed.filter((value) => value >= 2000 && value < 3000).length, color: "#d19a35" },
    { id: "3000_3999", label: "R$ 3.000 a 3.999", total: guaranteed.filter((value) => value >= 3000 && value < 4000).length, color: "#2b8a6e" },
    { id: "4000_4999", label: "R$ 4.000 a 4.999", total: guaranteed.filter((value) => value >= 4000 && value < 5000).length, color: "#3268a8" },
    { id: "5000_plus", label: "R$ 5.000 ou mais", total: guaranteed.filter((value) => value >= 5000).length, color: "#6f57a8" },
    { id: "not_informed", label: "Não informado", total: notInformed, color: "#8994a3" },
    { id: "non_monthly", label: "Freela / não mensal", total: nonMonthly.length, color: "#5d727f" }
  ];
  return {
    total: rows.length,
    informedMonthly: monthly.length,
    notInformed,
    nonMonthly: nonMonthly.length,
    atOrAboveTarget: monthly.filter((item) => item.minimum >= target).length,
    belowTarget: monthly.filter((item) => item.minimum < target).length,
    averageMinimum: guaranteed.length ? Math.round(guaranteed.reduce((sum, value) => sum + value, 0) / guaranteed.length) : 0,
    medianMinimum: median(guaranteed),
    target,
    distribution
  };
}

export function sourceDisplayName(value: unknown): string {
  const source = String(value ?? "").trim().toLowerCase();
  if (source.includes("infojobs") || source.includes("pandape")) return "InfoJobs";
  if (source.includes("linkedin")) return "LinkedIn";
  if (source.includes("indeed")) return "Indeed";
  if (source.includes("gupy")) return "Gupy";
  if (source.includes("vagascom") || source === "vagas.com") return "Vagas.com";
  if (source.includes("catho")) return "Catho";
  if (source.includes("netvagas")) return "NetVagas";
  if (source.includes("jobs99") || source.includes("99jobs")) return "99jobs";
  if (source.includes("trabalhabrasil")) return "Trabalha Brasil";
  if (source.includes("bne")) return "BNE";
  if (source.includes("solides")) return "Sólides";
  if (source.includes("abler")) return "Abler";
  if (source.includes("glassdoor")) return "Glassdoor";
  if (source.includes("sine")) return "SINE";
  if (source.includes("google")) return "Google";
  if (source.includes("greenhouse")) return "Greenhouse";
  if (source.includes("lever")) return "Lever";
  if (source.includes("gmail")) return "Gmail";
  if (source.includes("jobbol")) return "Jobbol";
  if (source.includes("manual")) return "Link direto";
  if (source.includes("rh-agencies") || source.includes("companyhunter")) return "Agências de RH";
  return String(value ?? "Fonte não identificada") || "Fonte não identificada";
}
