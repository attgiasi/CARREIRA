import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJobUrl, extractDirectJobLinks, isDirectJobLink } from "../src/modules/sources/gmailJobAlerts.js";

test("reconhece links diretos de ATS e rejeita pesquisas", () => {
  assert.equal(isDirectJobLink("https://boards.greenhouse.io/acme/jobs/123"), true);
  assert.equal(isDirectJobLink("https://www.linkedin.com/jobs/view/123456"), true);
  assert.equal(isDirectJobLink("https://www.google.com/search?q=vagas+bartender"), false);
  assert.equal(isDirectJobLink("https://empresa.com/unsubscribe?id=42"), false);
  assert.equal(isDirectJobLink("https://www.infojobs.com.br/empregos-barman-em-sao-paulo.aspx"), false);
  assert.equal(isDirectJobLink("https://www.infojobs.com.br/Candidate/Premium/Contract/Contract.aspx?utm_term=vaga"), false);
  assert.equal(isDirectJobLink("https://www.infojobs.com.br/vaga-de-Bartender-em-parana__123456.aspx"), true);
  assert.equal(isDirectJobLink("https://www.linkedin.com/comm/jobs/collections/similar-jobs?referenceJobId=123"), false);
  assert.equal(isDirectJobLink("https://jobs.smartrecruiters.com/my-applications/Empresa/123"), false);
});

test("extrai vagas de newsletter, remove duplicadas e ignora descadastro", () => {
  const html = `
    <a href="https://www.google.com/url?q=https%3A%2F%2Fjobs.lever.co%2Facme%2Fabc123&amp;sa=D">Bartender sênior</a>
    <a href="https://jobs.lever.co/acme/abc123">Ver vaga</a>
    <a href="https://empresa.com/unsubscribe?id=9">Descadastrar</a>
  `;
  const links = extractDirectJobLinks(html);
  assert.equal(links.length, 1);
  assert.equal(links[0].url.startsWith("https://jobs.lever.co/acme/abc123"), true);
  assert.equal(links[0].label, "Bartender sênior");
});

test("canoniza links rastreados para detectar repetição entre fontes", () => {
  const first = canonicalJobUrl("https://www.infojobs.com.br/vaga-de-Bartender-em-parana__123456.aspx?utm_source=email&origenvisita=41");
  const second = canonicalJobUrl("https://www.infojobs.com.br/vaga-de-Bartender-em-parana__123456.aspx?smlr=1");
  assert.equal(first, second);
  assert.equal(
    canonicalJobUrl("https://www.linkedin.com/comm/jobs/view/4433455163/?trackingId=abc"),
    "https://www.linkedin.com/jobs/view/4433455163"
  );
});
