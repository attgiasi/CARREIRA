import test from "node:test";
import assert from "node:assert/strict";

const modulePath = "../src/modules/sources/jobPageReader.js";
const reader = () => import(modulePath);

test("le JobPosting e recusa pagina de pesquisa e anuncio vencido", async () => {
  const { parseJobPage, isSearchPage } = await reader();
  const posting = {"@context":"https://schema.org", "@type":"JobPosting", title:"Head Bartender", description:"<p>Operacao do bar e atendimento ao cliente.</p>", hiringOrganization:{name:"Hotel Exemplo"}, jobLocation:{address:{addressLocality:"Curitiba", addressRegion:"PR"}}, baseSalary:{currency:"BRL",value:{value:4200,unitText:"MONTH"}}, validThrough:"2099-01-01"};
  const html = `<script type="application/ld+json">${JSON.stringify({"@graph":[posting]})}</script>`;
  const jobs = parseJobPage(html,"https://empresa.example/jobs/123");
  assert.equal(jobs[0].title,"Head Bartender");
  assert.equal(jobs[0].location,"Curitiba, PR");
  assert.match(jobs[0].salary,/4.200/);
  assert.equal(jobs[0].description,"Operacao do bar e atendimento ao cliente.");
  assert.equal(parseJobPage(html,"https://www.google.com/search?q=bartender").length,0);
  assert.equal(parseJobPage(html.replace("2099-01-01","2020-01-01"),"https://empresa.example/jobs/123").length,0);
  assert.equal(isSearchPage("https://www.linkedin.com/jobs/search/?keywords=bar"),true);
  assert.equal(isSearchPage("https://jobs.quickin.io/empresa/jobs/123"),false);
});

test("busca nao aceita localhost, IP privado nem redirecionamento interno", async () => {
  const { readPublicPage, isPublicIPv4 } = await reader();
  for (const address of ["127.0.0.1","10.0.0.2","169.254.169.254","192.168.1.1","172.16.0.1","100.64.0.1","0.0.0.0"]) assert.equal(isPublicIPv4(address),false);
  assert.equal(isPublicIPv4("8.8.8.8"),true);
  await assert.rejects(readPublicPage("https://127.0.0.1/private"));
  await assert.rejects(readPublicPage("file:///etc/passwd"));
});

test("Quickin usa apenas anuncios publicados e URL oficial informada", async () => {
  const { parseQuickinJobs } = await reader();
  const job = { _id:"abc",title:"Bartender",publicate:"published",description:"<p>Atendimento no bar.</p>",city:"Curitiba",region:"Parana",company_id:{name:"Restaurante"},career_url:"https://jobs.quickin.io/restaurante/jobs/abc" };
  assert.equal(parseQuickinJobs([job])[0].company,"Restaurante");
  assert.equal(parseQuickinJobs([{...job,publicate:"closed"}]).length,0);
  assert.equal(parseQuickinJobs([{...job,career_url:"https://www.google.com/search?q=bar"}]).length,0);
});
