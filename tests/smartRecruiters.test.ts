import test from "node:test";
import assert from "node:assert/strict";
const modulePath = "../src/modules/sources/smartRecruitersConnector.js";
test("SmartRecruiters importa apenas anuncios publicos ativos com URL individual", async () => {
  const {parseSmartRecruitersPosting} = await import(modulePath);
  const data = {id:"123",name:"Maitre",company:{name:"Hotel"},location:{city:"Itu",region:"SP"},active:true,visibility:"PUBLIC",postingUrl:"https://jobs.smartrecruiters.com/Hotel/123-maitre",applyUrl:"https://jobs.smartrecruiters.com/Hotel/123-maitre?oga=true",jobAd:{sections:{jobDescription:{text:"<p>Lideranca da equipe do restaurante.</p>"}}}};
  assert.equal(parseSmartRecruitersPosting(data)?.title,"Maitre");
  assert.equal(parseSmartRecruitersPosting({...data,active:false}),null);
  assert.equal(parseSmartRecruitersPosting({...data,visibility:"INTERNAL"}),null);
  assert.equal(parseSmartRecruitersPosting({...data,unpublishOn:"2020-01-01"}),null);
});
