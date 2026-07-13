import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("IA Candidatura usa a fonte oficial sem iframe bloqueado", () => {
  const appSource = fs.readFileSync(path.resolve(process.cwd(), "public", "app.js"), "utf8");

  assert.doesNotMatch(appSource, /<iframe[^>]+aiApplyFrame/i);
  assert.match(appSource, /Abrir vaga no site oficial/);
  assert.match(appSource, /Portais de emprego bloqueiam janelas incorporadas por segurança/);
});
