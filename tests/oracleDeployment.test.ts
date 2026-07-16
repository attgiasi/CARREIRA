import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("implantação Oracle persiste dados e mantém o app privado atrás do HTTPS", () => {
  const compose = fs.readFileSync(path.join(root, "deploy/oracle/compose.yaml"), "utf8");
  assert.match(compose, /apice_storage:\/app\/storage/);
  assert.match(compose, /reverse_proxy|Caddyfile/);
  assert.doesNotMatch(compose, /8788:8788/);
});

test("imagem de produção executa sem privilégios administrativos", () => {
  const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /HEALTHCHECK/);
});

test("modelo de ambiente Oracle não contém dados pessoais nem segredos preenchidos", () => {
  const env = fs.readFileSync(path.join(root, "deploy/oracle/env.production.example"), "utf8");
  assert.doesNotMatch(env, /att\.giasi|2000-1904|Pass\*/i);
  assert.match(env, /ACCOUNT_VAULT_KEY=\s*$/m);
  assert.match(env, /OPENAI_API_KEY=\s*$/m);
});
