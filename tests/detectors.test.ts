import test from "node:test";
import assert from "node:assert/strict";
import { detectWorkStyle } from "../src/modules/jobs/workStyleDetector.js";
import { detectEducationRequirement } from "../src/modules/jobs/educationRequirementDetector.js";
import { detectDriverLicense } from "../src/modules/jobs/driverLicenseDetector.js";
import { extractSalary } from "../src/modules/jobs/salaryExtractor.js";
import { calculateHours, hourlyRate } from "../src/modules/informal/eventRateCalculator.js";

test("detecta modelo remoto", () => {
  assert.equal(detectWorkStyle("vaga home office para atendimento"), "remoto");
});

test("detecta escolaridade superior completo", () => {
  assert.equal(detectEducationRequirement("exige superior completo").level, "superior_completo");
});

test("detecta CNH e veículo próprio", () => {
  const result = detectDriverLicense("necessário CNH B e veículo próprio");
  assert.equal(result.required, true);
  assert.equal(result.ownVehicle, true);
  assert.deepEqual(result.categories, ["B"]);
});

test("extrai salário em BRL", () => {
  assert.equal(extractSalary("Salário R$ 3.500,00 + benefícios"), "R$ 3.500,00");
});

test("calcula diária atravessando meia-noite", () => {
  const hours = calculateHours("18:00", "02:00");
  assert.equal(hours, 8);
  assert.equal(hourlyRate(240, hours), 30);
});
