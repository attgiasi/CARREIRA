import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { AgentSettings } from "../src/types.js";
import { limitedSearchPairs } from "../src/modules/sources/searchQueryBuilder.js";
import { normalizeJob } from "../src/modules/jobs/normalizer.js";
import { deduplicateJobs } from "../src/modules/jobs/deduplicator.js";
import { parseBaseSalary } from "../src/modules/dashboard/analytics.js";
import { salaryNumber } from "../src/modules/jobs/salaryExtractor.js";

const settings = JSON.parse(fs.readFileSync("agent-settings.json", "utf8")) as AgentSettings;

test("busca cobre todas as combinacoes de cargos e locais sem repetir pares", () => {
  const configured = structuredClone(settings);
  configured.jobSearchPreferences = { targetRoles: ["Bartender", "Chefe de Bar"], locations: { preferred: ["Curitiba", "Sao Paulo"] } };
  const pairs = limitedSearchPairs(configured, 10);
  assert.equal(pairs.length, 4);
  assert.equal(new Set(pairs.map(x => `${x.role}:${x.location}`)).size, 4);
});

test("salario base nao inclui gorjetas e beneficios", () => {
  const salary = parseBaseSalary("Salario base R$ 3.200,00 + R$ 800,00 de gorjetas + R$ 500,00 de beneficios");
  assert.equal(salary.minimum, 3200);
  assert.equal(salary.maximum, 3200);
  assert.equal(salaryNumber("3200"), 3200);
  assert.equal(parseBaseSalary("R$ 3.200,00 + gorjetas").minimum, 3200);
  assert.equal(parseBaseSalary("Gorjetas R$ 4.000,00").informed, false);
});

test("filtro visual usa a mesma base salarial da busca", () => {
  const app = fs.readFileSync("public/app.js", "utf8");
  const source = app.slice(app.indexOf("function monthlySalaryValue("), app.indexOf("async function profilePage("));
  const context = vm.createContext({});
  vm.runInContext(source, context);
  const parse = vm.runInContext("monthlySalaryValue", context) as (value: string) => number;
  for (const value of ["3200", "R$ 3.200,00 + R$ 800,00 gorjetas", "Gorjetas R$ 4.000,00", "R$ 60.000,00 por ano", "Nao informado"]) {
    const base = parseBaseSalary(value);
    assert.equal(parse(value), base.informed && base.monthly ? base.minimum : 0, value);
  }
});

test("anuncio direto do InfoJobs nao e classificado como pagina de busca", () => {
  const job = normalizeJob({title:"Bartender", company:"Restaurante", source:"infojobs", url:"https://www.infojobs.com.br/vaga-de-bartender__123456.aspx", description:"Operacao do bar", location:"Curitiba PR"}, settings);
  assert.notEqual(job.status, "Busca Assistida");
});

test("vagas iguais em fontes diferentes sao agrupadas sem misturar cidades", () => {
  const base = {title:"Head Bartender", company:"Restaurante Exemplo", location:"Curitiba PR", description:"Gestao do bar"};
  const jobs = [
    normalizeJob({...base, source:"quickin", url:"https://jobs.quickin.io/exemplo/jobs/abc"}, settings),
    normalizeJob({...base, source:"linkedin", url:"https://www.linkedin.com/jobs/view/12345"}, settings),
    normalizeJob({...base, source:"linkedin", url:"https://www.linkedin.com/jobs/view/67890", location:"Sao Paulo SP"}, settings)
  ];
  assert.equal(deduplicateJobs(jobs).length, 2);
});

test("anuncios com IDs diferentes na mesma fonte sao preservados", () => {
  const base = {title:"Bartender", company:"Restaurante Exemplo", location:"Curitiba PR", description:"Operacao do bar",source:"quickin"};
  assert.equal(deduplicateJobs([
    normalizeJob({...base,url:"https://jobs.quickin.io/exemplo/jobs/abc"},settings),
    normalizeJob({...base,url:"https://jobs.quickin.io/exemplo/jobs/def"},settings)
  ]).length,2);
});
