import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("retornos continuam disponíveis sem criar um menu redundante", () => {
  const appSource = fs.readFileSync(path.resolve(process.cwd(), "public", "app.js"), "utf8");
  const apiSource = fs.readFileSync(path.resolve(process.cwd(), "src", "modules", "dashboard", "api.ts"), "utf8");

  assert.doesNotMatch(appSource, /\["returns", "Retornos"\]/);
  assert.match(appSource, /attention: "Precisam de atenção"/);
  assert.match(appSource, /sent: "Candidatadas"/);
  assert.match(appSource, /Resultado de cada candidatura/);
  assert.match(appSource, /Abrir e-mail/);
  assert.match(apiSource, /apiRouter\.get\("\/returns"/);
  assert.match(apiSource, /LEFT JOIN ranked_events/);
});
