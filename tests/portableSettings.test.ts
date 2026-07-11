import assert from "node:assert/strict";
import test from "node:test";
import { loadSettings } from "../src/config/settings.js";
import { exportSettings, importSettings } from "../src/config/portableSettings.js";

test("exportação para GitHub remove dados pessoais e credenciais", () => {
  const settings = loadSettings();
  const withUnsafeValue = structuredClone(settings);
  (withUnsafeValue.applications as Record<string, unknown>).apiKey = "nao-pode-sair";

  const exported = exportSettings(withUnsafeValue, "github");
  const raw = JSON.stringify(exported);

  assert.equal(exported.scope, "github");
  assert.doesNotMatch(raw, /att\.giasi@gmail\.com/i);
  assert.doesNotMatch(raw, /Giasi Mandela Silva/i);
  assert.doesNotMatch(raw, /nao-pode-sair/i);
  assert.equal((exported.settings.profile as Record<string, unknown>).city, "Curitiba");
});

test("importação do arquivo para GitHub preserva os dados privados da conta", () => {
  const current = loadSettings();
  current.profile.phone = "telefone-privado";
  const exported = exportSettings(current, "github");
  const portableSettings = exported.settings as Record<string, unknown>;
  const salary = portableSettings.salaryPreferences as Record<string, unknown>;
  salary.rejectWithoutSalary = true;

  const imported = importSettings(exported, current);

  assert.equal(imported.profile.phone, "telefone-privado");
  assert.equal(imported.salaryPreferences.rejectWithoutSalary, true);
});

test("backup privado inclui o perfil, mas nunca inclui chaves adicionadas ao JSON", () => {
  const settings = loadSettings();
  (settings.safety as Record<string, unknown>).refreshToken = "segredo";

  const exported = exportSettings(settings, "private");
  const raw = JSON.stringify(exported);

  assert.match(raw, /Giasi Mandela Silva/);
  assert.doesNotMatch(raw, /segredo/);
});
