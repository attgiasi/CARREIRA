import { AgentSettings, NormalizedJob } from "../../types.js";
import { parseBaseSalary } from "../dashboard/analytics.js";
import { configuredRoles } from "../sources/searchQueryBuilder.js";
import { isSearchPage } from "../sources/jobPageReader.js";

const normalized = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const states: Record<string,string> = {AC:"acre",AL:"alagoas",AP:"amapa",AM:"amazonas",BA:"bahia",CE:"ceara",DF:"distrito federal",ES:"espirito santo",GO:"goias",MA:"maranhao",MT:"mato grosso",MS:"mato grosso do sul",MG:"minas gerais",PA:"para",PB:"paraiba",PR:"parana",PE:"pernambuco",PI:"piaui",RJ:"rio de janeiro",RN:"rio grande do norte",RS:"rio grande do sul",RO:"rondonia",RR:"roraima",SC:"santa catarina",SP:"sao paulo",SE:"sergipe",TO:"tocantins"};

export function configuredLocationMatches(value: string, settings: AgentSettings): boolean {
  const place = ` ${normalized(value)} `;
  const locations = settings.jobSearchPreferences.locations as {acceptedStates?:string[];preferred?:string[]} | undefined;
  const work = settings.jobSearchPreferences.workStyles as Record<string,boolean> | undefined;
  if (/remoto|remote|home office/.test(place)) return Boolean(work?.remoto || work?.homeOffice);
  if (locations?.acceptedStates?.length) return locations.acceptedStates.some(state => place.includes(` ${state.toLowerCase()} `) || place.includes(` ${states[state.toUpperCase()] || state.toLowerCase()} `));
  return (locations?.preferred || [settings.profile.city]).some(city => {
    const name = normalized(city).split(/ e regiao| e campinas| e rmc/)[0];
    return name.length > 2 && place.includes(` ${name} `);
  });
}

export function titleMatchesPreferences(value: string, settings: AgentSettings): boolean {
  const title = normalized(value);
  const levels = settings.jobSearchPreferences.careerLevels as Record<string,boolean> | undefined;
  if (levels?.auxiliar === false && /\b(auxiliar|ajudante|barback)\b/.test(title) && !/bartender e|bartender ou/.test(title)) return false;
  return configuredRoles(settings).some(role => {
    const terms = normalized(role).split(" ").filter(t => !["de","do","da","em","e","senior","junior","pleno"].includes(t));
    return terms.length > 0 && terms.every(term => title.includes(term));
  });
}

export function exclusionReason(job: NormalizedJob, settings: AgentSettings): string {
  if (!job.url || isSearchPage(job.url) || job.status === "Busca Assistida") return "Sem anuncio individual";
  if (job.raw.validThrough && Date.parse(String(job.raw.validThrough)) < Date.now()) return "Anuncio vencido";
  if (!titleMatchesPreferences(job.title,settings)) return "Cargo fora das preferencias";
  const locations = settings.jobSearchPreferences.locations as {rejectOutsidePreferredLocations?:boolean} | undefined;
  if (locations?.rejectOutsidePreferredLocations && !configuredLocationMatches(job.location,settings)) return "Local fora das preferencias";
  const salary = parseBaseSalary(job.salary);
  if (!salary.informed && settings.salaryPreferences.rejectWithoutSalary) return "Salario nao informado";
  const contracts = settings.salaryPreferences.salaryByContractType as Record<string,{minimumMonthly?:number}> | undefined;
  const minimum = Number(contracts?.[job.employmentType]?.minimumMonthly || 0);
  if (settings.salaryPreferences.rejectBelowMinimum && salary.monthly && salary.informed && minimum && salary.minimum < minimum) return "Salario-base abaixo do minimo";
  return "";
}
