import crypto from "node:crypto";
import { AgentSettings, NormalizedJob, RawJob } from "../../types.js";
import { extractRequirements } from "./requirementExtractor.js";
import { scoreRisk } from "./riskScorer.js";
import { scoreFit } from "./fitScorer.js";
import { scoreHireChance } from "./hireChanceScorer.js";
import { scoreJobQuality } from "./jobQualityScorer.js";
import { classifyJob } from "./jobClassifier.js";

const assistedSources = new Set(["google-assisted-search", "sine", "infojobs", "jobs99", "rh-agencies-curitiba"]);

function detectCareerTrack(text: string): string {
  const lower = text.toLowerCase();
  if (/fraude|risco|backoffice/.test(lower)) return "prevencao_backoffice";
  if (/customer|atendimento|sac|cliente/.test(lower)) return "atendimento_cx";
  if (/supervis|coordena|gerente|gestão/.test(lower)) return "gestao_supervisao";
  if (/consult/.test(lower)) return "consultoria";
  return "hospitalidade_eventos";
}

function detectEmployment(text: string): string {
  const lower = text.toLowerCase();
  if (/pj/.test(lower)) return "pj";
  if (/freela|freelancer|diária|diaria|taxa/.test(lower)) return "freelancer";
  if (/temporário|temporario/.test(lower)) return "temporario";
  if (/intermitente/.test(lower)) return "intermitente";
  return "clt";
}

export function normalizeJob(raw: RawJob, settings: AgentSettings): NormalizedJob {
  const description = raw.description ?? "";
  const text = `${raw.title} ${raw.company ?? ""} ${raw.location ?? ""} ${description}`;
  const req = extractRequirements(text);
  const externalId = raw.externalId ?? crypto.createHash("sha256").update(`${raw.source}|${raw.url}|${raw.title}`).digest("hex");
  const job: NormalizedJob = {
    externalId,
    title: raw.title,
    company: raw.company ?? "Empresa a confirmar",
    location: raw.location ?? "A confirmar",
    source: raw.source,
    url: raw.url ?? "",
    description,
    salary: raw.salary ?? req.salary,
    workModel: req.workModel,
    travelRequired: req.travelRequired,
    driverLicenseRequired: req.driverLicenseRequired,
    driverLicenseCategories: req.driverLicenseCategories,
    ownVehicleRequired: req.ownVehicleRequired,
    educationRequired: req.educationRequired,
    educationLevelDetected: req.educationLevelDetected,
    seniorityLevel: req.seniorityLevel,
    careerTrack: detectCareerTrack(text),
    employmentType: detectEmployment(text),
    scheduleType: /noturno|madrugada/i.test(text) ? "noturno" : /6x1|escala/i.test(text) ? "escala" : "comercial_ou_a_confirmar",
    fitScore: 0,
    hireChanceScore: 0,
    jobQualityScore: 0,
    riskScore: 0,
    fitReason: "",
    hireChanceReason: "",
    riskFlags: [],
    status: "Encontrada",
    raw: raw.raw ?? {}
  };
  const risk = scoreRisk(text, settings);
  const fit = scoreFit(job, settings);
  const hire = scoreHireChance(job, settings);
  job.riskScore = risk.score;
  job.riskFlags = risk.flags;
  job.fitScore = fit.score;
  job.fitReason = fit.reason;
  job.hireChanceScore = hire.score;
  job.hireChanceReason = hire.reason;
  job.jobQualityScore = scoreJobQuality(job);
  job.status = classifyJob(job);
  if (assistedSources.has(job.source)) {
    job.fitScore = Math.min(job.fitScore, 62);
    job.hireChanceScore = Math.min(job.hireChanceScore, 45);
    job.jobQualityScore = Math.min(job.jobQualityScore, 42);
    job.riskScore = Math.max(job.riskScore, 25);
    job.status = "Busca Assistida";
    job.fitReason = "Fonte útil para encontrar vagas reais, mas esta entrada ainda é uma busca ou portal. Abra a fonte e importe o link específico da vaga.";
    job.hireChanceReason = "Chance real só pode ser calculada depois de identificar a vaga específica, empresa, requisitos e formulário oficial.";
  }
  return job;
}
