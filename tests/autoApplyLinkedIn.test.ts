import assert from "node:assert/strict";
import test from "node:test";
import { decideAutomation } from "../src/modules/applications/autoApplyEngine.js";
import { AgentSettings } from "../src/types.js";

test("LinkedIn recebe pacote de autofill sem autorizar envio cego", () => {
  const decision = decideAutomation(
    {
      title: "Head Bartender",
      company: "Hotel Premium",
      source: "LinkedIn",
      url: "https://www.linkedin.com/jobs/view/123456"
    },
    {
      id: 2,
      name: "Candidato",
      email: "candidato@example.com",
      phone: "41999999999",
      city: "Curitiba",
      state: "PR",
      country: "Brasil"
    },
    [
      { question_key: "availability.start", answer_text: "Imediata" },
      { question_key: "salary.expectation.default", answer_text: "Negociável" },
      { question_key: "work.authorization.br", answer_text: "Sim" }
    ],
    { applications: { autoApply: false, allowQuickApplyAPIs: false } } as unknown as AgentSettings
  );

  assert.equal(decision.status, "linkedin_assistido");
  assert.equal(decision.canAutofill, true);
  assert.equal(decision.canSubmitAutomatically, false);
});
