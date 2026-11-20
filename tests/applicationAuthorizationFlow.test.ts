import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const appSource = fs.readFileSync(path.resolve(process.cwd(), "public/app.js"), "utf8");
const apiSource = fs.readFileSync(path.resolve(process.cwd(), "src/modules/dashboard/api.ts"), "utf8");
const schemaSource = fs.readFileSync(path.resolve(process.cwd(), "src/database/schema.sql"), "utf8");

test("aprovar vaga não inicia candidatura antes da autorização", () => {
  assert.match(appSource, /data-job-approve=/);
  assert.doesNotMatch(appSource, /data-job-ai=/);
  assert.match(apiSource, /application_status = 'Autorizada para candidatura'/);
  assert.match(apiSource, /authorization_status = 'aguardando_autorizacao'/);
});

test("autorização fica registrada separadamente do envio real", () => {
  assert.match(schemaSource, /authorization_status TEXT DEFAULT 'aguardando_autorizacao'/);
  assert.match(schemaSource, /authorized_at TEXT/);
  assert.match(apiSource, /post\("\/applications\/authorize"/);
  assert.match(apiSource, /authorization_status = 'autorizada', authorized_at = CURRENT_TIMESTAMP/);
  assert.match(apiSource, /authorization_status = 'concluida'.*sent_by_agent = 1/);
});

test("navegação principal mantém apenas o fluxo essencial", () => {
  assert.match(appSource, /\["dashboard", "Visão geral"\]/);
  assert.match(appSource, /\["jobs", "Vagas"\]/);
  assert.match(appSource, /\["applications", "Candidaturas"\]/);
  assert.match(appSource, /\["profile", "Meu perfil"\]/);
});

test("configuração da conta acompanha todo o fluxo e renova filtros", () => {
  assert.match(appSource, /ensurePreferenceSettings\(\)/);
  assert.match(appSource, /data-preference-context/);
  assert.match(appSource, /preferenceContextObserver\.observe\(app/);
  assert.match(appSource, /preferredJobFilters\(preferences/);
  assert.match(appSource, /localStorage\.removeItem\(filterKey\("jobs-v3"\)\)/);
  assert.match(appSource, /Configurações salvas e aplicadas em todo o fluxo/);
  assert.match(apiSource, /loadUserSettings\(db, userId\)/);
});
