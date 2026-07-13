import assert from "node:assert/strict";
import test from "node:test";
import { isTargetRoleTitle } from "../src/modules/gmail/careerGmailSync.js";

test("mantém vagas de A&B e bloqueia consultoria genérica", () => {
  assert.equal(isTargetRoleTitle("Head Bartender - Resort"), true);
  assert.equal(isTargetRoleTitle("Gerente de Restaurante"), true);
  assert.equal(isTargetRoleTitle("Consultor de bares e restaurantes"), true);
  assert.equal(isTargetRoleTitle("Pessoa Consultora de Negócios"), false);
  assert.equal(isTargetRoleTitle("Consultor SAP Group Reporting"), false);
  assert.equal(isTargetRoleTitle("Vagas semelhantes à de Bartender"), false);
});
