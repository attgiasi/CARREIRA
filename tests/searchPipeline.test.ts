import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { collectSources } from "../src/modules/sources/publicCareerSources.js";
import { exclusionReason, configuredLocationMatches } from "../src/modules/jobs/searchEligibility.js";
import { normalizeJob } from "../src/modules/jobs/normalizer.js";
import { AgentSettings } from "../src/types.js";
import { buildApplicationPacket } from "../src/modules/applications/applicationBuilder.js";

const settings = JSON.parse(fs.readFileSync("agent-settings.json","utf8")) as AgentSettings;
settings.jobSearchPreferences.targetRoles = ["Bartender","Chefe de Bar"];
settings.jobSearchPreferences.locations = {acceptedStates:["PR","SC","SP"],rejectOutsidePreferredLocations:true};
settings.salaryPreferences.rejectBelowMinimum = true;
const raw = {title:"Bartender",company:"Restaurante",location:"Curitiba, PR",source:"quickin",url:"https://jobs.quickin.io/restaurante/jobs/abc",salary:"R$ 3.500,00",description:"Atendimento ao cliente"};

test("falha em uma fonte nao descarta resultados de outra", async () => {
  const result = await collectSources([{name:"falha",run:async () => {throw new Error("HTTP 403");}}, {name:"publica",run:async () => [raw]}]);
  assert.equal(result.jobs.length,1);
  assert.equal(result.reports.find(r=>r.source === "falha")?.status,"error");
});

test("preferencias filtram titulo, local e salario antes de inserir", () => {
  assert.equal(exclusionReason(normalizeJob(raw,settings),settings),"");
  for (const patch of [{title:"Cozinheiro",description:"Trabalha junto ao bartender"},{location:"Rio de Janeiro, RJ"},{salary:"R$ 2.000,00 + R$ 2.000,00 gorjetas"}]) {
    assert.notEqual(exclusionReason(normalizeJob({...raw,...patch},settings),settings),"");
  }
  assert.equal(configuredLocationMatches("Hibrido Brasil",settings),false);
  assert.equal(configuredLocationMatches("Florianopolis, Santa Catarina",settings),true);
});

test("curriculo configurado e preservado quando o perfil nao informa arquivo", () => {
  settings.applications.originalResumeFile = "resumes/users/7/atual.pdf";
  assert.equal(buildApplicationPacket(1,normalizeJob(raw,settings),settings).generatedResumePath,"resumes/users/7/atual.pdf");
});
