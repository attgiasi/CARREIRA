import test from "node:test";
import assert from "node:assert/strict";
import { classifyRecruiterMessage } from "../src/modules/gmail/recruiterReplyReader.js";
import { buildSalaryAnalytics, parseBaseSalary, sourceDisplayName } from "../src/modules/dashboard/analytics.js";

test("classifica recusa antes de interpretar a menção à próxima fase", () => {
  const result = classifyRecruiterMessage(
    "Retorno do processo seletivo",
    "Infelizmente, não foi possível seguir com sua candidatura para a próxima fase do processo seletivo."
  );
  assert.equal(result.eventType, "rejection");
  assert.equal(result.outcome, "negativa");
});

test("classifica avanço para a segunda fase", () => {
  const result = classifyRecruiterMessage(
    "Você avançou para a próxima fase da vaga de Gerente de Restaurante",
    "Estamos felizes em contar que você passou para a próxima etapa."
  );
  assert.equal(result.eventType, "advanced");
  assert.equal(result.stage, 2);
  assert.equal(result.requiresAction, true);
});

test("classifica proposta como etapa avançada", () => {
  const result = classifyRecruiterMessage("Carta proposta", "Você foi aprovado. Revise a proposta de contratação.");
  assert.equal(result.eventType, "offer");
  assert.equal(result.stage, 3);
});

test("extrai apenas a base salarial mensal", () => {
  assert.deepEqual(parseBaseSalary("R$ 4.000,00 a R$ 5.000,00"), {
    raw: "R$ 4.000,00 a R$ 5.000,00",
    informed: true,
    monthly: true,
    variableOnly: false,
    minimum: 4000,
    maximum: 5000,
    midpoint: 4500
  });
  assert.equal(parseBaseSalary("R$ 300,00 por evento").monthly, false);
  assert.equal(parseBaseSalary("Bonificação de R$ 3.500").informed, false);
});

test("separa salários não informados e acima da meta", () => {
  const result = buildSalaryAnalytics([
    { salary: "R$ 4.000,00" },
    { salary: "R$ 2.500,00" },
    { salary: "A combinar" },
    { salary: "R$ 300,00 por evento" }
  ], 3000);
  assert.equal(result.atOrAboveTarget, 1);
  assert.equal(result.notInformed, 1);
  assert.equal(result.nonMonthly, 1);
});

test("normaliza nomes de fontes equivalentes", () => {
  assert.equal(sourceDisplayName("infojobs"), "InfoJobs");
  assert.equal(sourceDisplayName("InfoJobs"), "InfoJobs");
  assert.equal(sourceDisplayName("linkedin-search"), "LinkedIn");
});
