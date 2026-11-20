import { AgentSettings, RawJob } from "../../types.js";
import { plainText, isSearchPage, readPublicPage } from "./jobPageReader.js";
import { titleMatchesPreferences } from "../jobs/searchEligibility.js";
import { collectSources } from "./publicCareerSources.js";

export function parseSmartRecruitersPosting(data: Record<string, any>): RawJob | null {
  if (!data.active || data.visibility !== "PUBLIC" || !data.name || !data.postingUrl || !data.applyUrl || isSearchPage(data.postingUrl)) return null;
  if (data.unpublishOn && Date.parse(data.unpublishOn) < Date.now()) return null;
  const sections = data.jobAd?.sections || {};
  const description = Object.values(sections).map((section: any) => plainText(section.text)).filter(Boolean).join("\n");
  if (!description) return null;
  const hotel = (data.customField || []).find((field: any) => field.fieldLabel === "Hotel Region Americas")?.valueLabel;
  return {
    externalId:`smartrecruiters:${data.id}`, title:plainText(data.name), company:hotel || data.company?.name || "Empresa a confirmar",
    location:[data.location?.city,data.location?.region].filter(Boolean).join(", "), source:"smartrecruiters",url:data.postingUrl,
    description:`${description}\n${data.location?.remote ? "Remoto" : data.location?.hybrid ? "Hibrido" : "Presencial"}`,
    salary:"Nao informado",raw:{verifiedAt:new Date().toISOString(),verification:"public_posting_api",postedAt:data.releasedDate || "",validThrough:data.unpublishOn || "",applicationUrl:data.applyUrl}
  };
}

export async function fetchSmartRecruitersBoard(company: string, settings: AgentSettings): Promise<RawJob[]> {
  if (!/^[a-z0-9_-]{1,100}$/i.test(company)) throw new Error("Identificador de empresa invalido.");
  const postings = new Map<string,Record<string,any>>();
  for (let offset=0; offset<500; offset+=100) {
    const url = new URL(`https://api.smartrecruiters.com/v1/companies/${company}/postings`);
    url.search = new URLSearchParams({limit:"100",offset:String(offset),destination:"PUBLIC"}).toString();
    if (/brasil|brazil|^br$/i.test(settings.profile.country)) url.searchParams.set("country","br");
    const data = JSON.parse((await readPublicPage(url.toString())).html);
    if (!Array.isArray(data.content)) throw new Error("Formato da fonte SmartRecruiters mudou.");
    for (const job of data.content) if (job.id && titleMatchesPreferences(job.name,settings)) postings.set(String(job.id),job);
    if (offset+data.content.length>=data.totalFound || !data.content.length) break;
  }
  const details = await collectSources([...postings.values()].slice(0,40).map(posting => ({name:String(posting.name),run:async()=> {
    const url = `https://api.smartrecruiters.com/v1/companies/${company}/postings/${encodeURIComponent(posting.id)}?destination=PUBLIC`;
    const job = parseSmartRecruitersPosting(JSON.parse((await readPublicPage(url)).html));
    return job ? [job] : [];
  }})));
  if (postings.size && details.reports.every(r=>r.status === "error")) throw new Error("Detalhes SmartRecruiters indisponiveis.");
  return details.jobs;
}
