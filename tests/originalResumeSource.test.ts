import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildApplicationPacket } from "../src/modules/applications/applicationBuilder.js";
import { generateCoverLetter } from "../src/modules/applications/coverLetterGenerator.js";
import { suggestedAnswers } from "../src/modules/applications/questionAnswerer.js";
import { AgentSettings, NormalizedJob } from "../src/types.js";

const settings = JSON.parse(fs.readFileSync("agent-settings.json", "utf8")) as AgentSettings;
const job: NormalizedJob = {
  externalId: "test-original-resume",
  title: "Chefe de Bar",
  company: "Restaurante Teste",
  location: "Curitiba, PR",
  source: "teste",
  url: "https://example.com/vaga",
  description: "Liderança de bar, atendimento e experiência do cliente.",
  salary: "Não informado",
  workModel: "presencial",
  travelRequired: false,
  driverLicenseRequired: false,
  driverLicenseCategories: [],
  ownVehicleRequired: false,
  educationRequired: "",
  educationLevelDetected: "",
  seniorityLevel: "lideranca",
  careerTrack: "hospitalidade_eventos",
  employmentType: "clt",
  scheduleType: "escala",
  fitScore: 90,
  hireChanceScore: 80,
  jobQualityScore: 80,
  riskScore: 0,
  fitReason: "",
  hireChanceReason: "",
  riskFlags: [],
  status: "Vaga Ouro",
  raw: {}
};

test("pacote usa o PDF original informado pelo perfil", () => {
  const packet = buildApplicationPacket(1, job, settings, "resumes/CV-Hospitalidade.pdf");
  assert.equal(packet.generatedResumePath, "resumes/CV-Hospitalidade.pdf");
  assert.match(packet.notes, /currículo original/i);
});

test("textos auxiliares não inventam tempo de experiência ou pós-graduação", () => {
  const combined = [
    settings.profile.summary,
    generateCoverLetter(job, settings),
    suggestedAnswers(job, settings).fale_sobre_voce,
    ...settings.profile.education.degrees
  ].join("\n");
  assert.doesNotMatch(combined, /mais de 12 anos|pós-graduação|customer success|backoffice/i);
  assert.match(combined, /sólida experiência/i);
});
