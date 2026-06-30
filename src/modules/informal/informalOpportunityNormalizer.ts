import crypto from "node:crypto";
import { InformalOpportunity, RawJob } from "../../types.js";
import { calculateHours, hourlyRate } from "./eventRateCalculator.js";
import { informalRisk } from "./informalRiskDetector.js";
import { classifyInformal, scoreInformalWork } from "./informalWorkScorer.js";

function extractPay(text: string): number {
  const match = text.match(/R\$\s?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i);
  return match ? Number(match[1].replace(/\./g, "").replace(",", ".")) : 0;
}

function extractTime(text: string): { start: string; end: string } {
  const match = text.match(/(\d{1,2})h?(?::?(\d{2}))?\s*(?:às|as|a|-)\s*(\d{1,2})h?(?::?(\d{2}))?/i);
  if (!match) return { start: "", end: "" };
  return { start: `${match[1].padStart(2, "0")}:${match[2] ?? "00"}`, end: `${match[3].padStart(2, "0")}:${match[4] ?? "00"}` };
}

export function normalizeInformal(raw: RawJob): InformalOpportunity {
  const description = `${raw.title} ${raw.description ?? ""}`;
  const pay = extractPay(description);
  const time = extractTime(description);
  const hours = calculateHours(time.start, time.end);
  const rate = hourlyRate(pay, hours);
  const risk = informalRisk(description, rate);
  const base: InformalOpportunity = {
    type: /consult/i.test(description) ? "consultoria" : "freela_evento",
    title: raw.title || "Oportunidade informal",
    contractorName: raw.company ?? "Contratante a confirmar",
    company: raw.company ?? "",
    eventType: /bar|bartender|drink|coquetel/i.test(description) ? "bar_evento" : "evento",
    location: raw.location ?? "A confirmar",
    date: "",
    startTime: time.start,
    endTime: time.end,
    estimatedHours: hours,
    totalPay: pay,
    hourlyRate: rate,
    paymentMethod: /pix/i.test(description) ? "pix" : "a_confirmar",
    paymentDelayDays: /no dia|imediato/i.test(description) ? 0 : 7,
    foodIncluded: /alimentação|alimentacao|janta|lanche/i.test(description),
    transportIncluded: /transporte|uber|ajuda de custo/i.test(description),
    requiresOwnTools: /material próprio|equipamento próprio/i.test(description),
    requiresUniform: /uniforme/i.test(description),
    requiresDriverLicense: /cnh/i.test(description),
    requiresOwnVehicle: /veículo próprio|veiculo proprio/i.test(description),
    description,
    source: raw.source,
    url: raw.url ?? "",
    freelaScore: 0,
    riskScore: risk.score,
    riskFlags: risk.flags,
    status: "Em análise",
    raw: { ...raw.raw, hash: crypto.createHash("sha256").update(description).digest("hex") }
  };
  base.freelaScore = scoreInformalWork(base);
  base.status = classifyInformal(base.freelaScore, base.riskScore);
  return base;
}
