const app = document.querySelector("#app");
const header = document.querySelector("header");
let currentTab = "dashboard";
let aiApplyPrefill = null;
let aiApplyReturnTab = "applications";
let currentUser = null;
let registrationOpen = true;
let startupAiApplyPrefill = readAiApplyPrefillFromQuery();

if (localStorage.getItem("careerHunter:directFlowVersion") !== "2") {
  localStorage.removeItem("careerHunter:approved:filters");
  localStorage.removeItem("careerHunter:applications:filters");
  localStorage.setItem("careerHunter:directFlowVersion", "2");
}

const tabs = [
  ["dashboard", "Visão geral"],
  ["jobs", "Vagas"],
  ["applications", "Candidaturas"],
  ["profile", "Meu perfil"],
  ["settings", "Configurações"]
];

const tabIcons = {
  dashboard: "dashboard",
  jobs: "briefcase",
  applications: "clipboard-check",
  profile: "user",
  settings: "settings"
};

const pageMeta = {
  dashboard: ["CENTRAL DE CARREIRA", "Visão geral"],
  jobs: ["OPORTUNIDADES", "Vagas"],
  applications: ["PIPELINE", "Candidaturas"],
  profile: ["IDENTIDADE PROFISSIONAL", "Meu perfil"],
  settings: ["CONTROLE DO AGENTE", "Configurações"],
  returns: ["PIPELINE", "Retornos das candidaturas"],
  aiApply: ["ASSISTENTE", "Candidatura com IA"],
  accounts: ["INTEGRAÇÕES", "Agências conectadas"],
  sources: ["INTELIGÊNCIA DE MERCADO", "Fontes de vagas"],
  logs: ["SISTEMA", "Saúde do agente"]
};

const assistedSources = new Set([
  "google-assisted-search",
  "sine",
  "infojobs",
  "jobs99",
  "rh-agencies-curitiba",
  "linkedin-search",
  "indeed-search",
  "vagascom-search",
  "catho-search",
  "netvagas-search",
  "bne-search",
  "trabalhabrasil-search",
  "glassdoor-search",
  "empregos-search",
  "solides-search",
  "abler-search",
  "pandape-search"
]);

document.documentElement.dataset.theme = localStorage.getItem("careerHunterTheme") || "light";

function icon(name, className = "") {
  return `<i data-lucide="${escapeHtml(name)}"${className ? ` class="${escapeHtml(className)}"` : ""}></i>`;
}

function refreshIcons(root = document) {
  requestAnimationFrame(() => window.apiceRenderIcons?.(root));
}

window.addEventListener("apice-icons-ready", () => refreshIcons());

function initials(value) {
  return String(value || "A").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
}

function updateShellState(tab = currentTab) {
  const [kicker, title] = pageMeta[tab] || pageMeta.dashboard;
  const kickerNode = document.querySelector("#pageKicker");
  const titleNode = document.querySelector("#pageTitle");
  if (kickerNode) kickerNode.textContent = kicker;
  if (titleNode) titleNode.textContent = title;
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  document.querySelector("#appSidebar")?.classList.remove("open");
  document.querySelector("#sidebarBackdrop")?.classList.remove("visible");
  refreshIcons();
}

function renderShell() {
  document.body.classList.toggle("authenticated", Boolean(currentUser));
  if (!currentUser) {
    header.innerHTML = `<div class="auth-topbar">
      <button class="brand-lockup" data-tab="dashboard" title="Ápice">
        <img class="brand-logo" src="/apice-mark.svg" alt="">
        <span><strong>ÁPICE</strong><small>Inteligência de carreira</small></span>
      </button>
      <button id="themeToggle" class="icon-button" title="Alternar tema" aria-label="Alternar tema">${icon(document.documentElement.dataset.theme === "dark" ? "sun" : "moon")}</button>
    </div>`;
    refreshIcons(header);
    return;
  }

  const nav = tabs.map(([id, label]) => `<button class="nav-link ${currentTab === id ? "active" : ""}" data-tab="${id}">
    ${icon(tabIcons[id])}<span>${label}</span>
  </button>`).join("");
  const [kicker, title] = pageMeta[currentTab] || pageMeta.dashboard;
  header.innerHTML = `
    <div class="sidebar-backdrop" id="sidebarBackdrop"></div>
    <aside class="app-sidebar" id="appSidebar">
      <button class="brand-lockup" data-tab="dashboard" title="Ir para a visão geral">
        <img class="brand-logo" src="/apice-mark.svg" alt="">
        <span><strong>ÁPICE</strong><small>Carreira inteligente</small></span>
      </button>
      <div class="nav-caption">MENU PRINCIPAL</div>
      <nav id="mainNav" aria-label="Navegação principal">${nav}</nav>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-status">
        <span class="live-dot"></span>
        <div><strong>Agente disponível</strong><small>Dados protegidos por usuário</small></div>
      </div>
      <div class="account-panel">
        <span class="account-avatar">${escapeHtml(initials(currentUser.name))}</span>
        <div><strong>${escapeHtml(currentUser.name)}</strong><small>${escapeHtml(currentUser.email)}</small></div>
        <button id="logoutButton" class="icon-button subtle" title="Sair" aria-label="Sair">${icon("logout")}</button>
      </div>
      <span class="product-version">Ápice · 3.0</span>
    </aside>
    <div class="topbar">
      <button id="mobileMenu" class="icon-button mobile-menu" title="Abrir menu" aria-label="Abrir menu">${icon("menu")}</button>
      <div class="topbar-title"><span id="pageKicker">${escapeHtml(kicker)}</span><h1 id="pageTitle">${escapeHtml(title)}</h1></div>
      <div class="topbar-actions">
        <span class="save-indicator" id="globalStatus"><i></i>Agente pronto</span>
        <button id="globalSync" class="button secondary" title="Atualizar respostas do Gmail">${icon("refresh")}<span>Atualizar Gmail</span></button>
        <button id="globalScan" class="button primary" title="Buscar novas vagas">${icon("search")}<span>Buscar vagas</span></button>
        <button id="themeToggle" class="icon-button" title="Alternar tema" aria-label="Alternar tema">${icon(document.documentElement.dataset.theme === "dark" ? "sun" : "moon")}</button>
      </div>
    </div>`;
  refreshIcons(header);
}

async function json(url, options) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    if (response.status === 401 && !url.includes("/api/auth/")) {
      currentUser = null;
      renderAuth();
    }
    throw new Error(typeof data === "string" ? data : data.error || "Erro na requisição");
  }
  return data;
}

function renderAuth(message = "", canRegister = registrationOpen) {
  renderShell();
  app.innerHTML = `<section class="auth-shell">
    <div class="auth-hero">
      <span class="eyebrow">Career Hunter Online</span>
      <h1>Entre para buscar vagas, preparar candidaturas e manter seus dados separados.</h1>
      <p>Cada usuário tem suas próprias vagas, candidaturas, perfis, memória de respostas e configurações.</p>
    </div>
    <div class="auth-panel">
      <div class="stage-tabs" id="authTabs">
        <button data-auth-mode="login" class="active">Entrar</button>
        ${canRegister ? `<button data-auth-mode="register">Criar conta</button>` : ""}
      </div>
      <div id="authMessage" class="note ${message ? "" : "hidden"}">${message}</div>
      <form id="loginForm" class="auth-form">
        <label>E-mail<input name="email" type="email" autocomplete="email" required></label>
        <label>Senha<input name="password" type="password" autocomplete="current-password" required></label>
        <button class="primary" type="submit">Entrar</button>
      </form>
      ${canRegister ? `<form id="registerForm" class="auth-form hidden">
        <label>Nome completo<input name="name" autocomplete="name" required></label>
        <label>E-mail<input name="email" type="email" autocomplete="email" required></label>
        <label>Senha<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
        <small>Use pelo menos 8 caracteres com letras e números.</small>
        <button class="primary" type="submit">Criar conta</button>
      </form>` : `<div class="note"><strong>Cadastros protegidos</strong><p>Esta instalação já possui uma conta administradora. Solicite acesso ao responsável pelo painel.</p></div>`}
    </div>
  </section>`;
  document.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-auth-mode]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const mode = button.dataset.authMode;
    document.querySelector("#loginForm").classList.toggle("hidden", mode !== "login");
    document.querySelector("#registerForm")?.classList.toggle("hidden", mode !== "register");
  }));
  document.querySelector("#loginForm").addEventListener("submit", (event) => submitAuth(event, "login"));
  document.querySelector("#registerForm")?.addEventListener("submit", (event) => submitAuth(event, "register"));
}

async function submitAuth(event, mode) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const data = await json(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    currentUser = data.user;
    renderShell();
    toast(mode === "register" ? "Conta criada com segurança." : "Login realizado.", "success");
    await loadStartupDestination();
  } catch (error) {
    showInlineResult("#authMessage", escapeHtml(error.message));
  }
}

async function boot() {
  try {
    const session = await json("/api/auth/me");
    registrationOpen = Boolean(session.registrationOpen);
    if (!session.authenticated) {
      currentUser = null;
      renderAuth(session.users ? "" : "<strong>Primeiro acesso:</strong><p>Crie a conta administradora. Os dados atuais serão vinculados a ela.</p>", registrationOpen);
      return;
    }
    currentUser = session.user;
    renderShell();
    await loadStartupDestination();
  } catch {
    renderAuth();
  }
}

function readAiApplyPrefillFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const url = String(params.get("aiUrl") || params.get("url") || "").trim();
  if (!url) return null;
  return {
    url,
    title: String(params.get("aiTitle") || params.get("title") || "").trim(),
    company: String(params.get("aiCompany") || params.get("company") || "").trim(),
    applicationId: 0,
    autoLoad: true,
    autoPrepare: false
  };
}

async function loadStartupDestination() {
  if (startupAiApplyPrefill?.url) {
    setAiApplyPrefill(startupAiApplyPrefill);
    startupAiApplyPrefill = null;
    window.history.replaceState({}, "", window.location.pathname);
    await load("aiApply");
    return;
  }
  await load("dashboard");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function getPath(obj, path, fallback = "") {
  return path.split(".").reduce((acc, part) => acc && acc[part] !== undefined ? acc[part] : undefined, obj) ?? fallback;
}

function setPath(obj, path, value) {
  const parts = path.split(".");
  let target = obj;
  for (const part of parts.slice(0, -1)) {
    target[part] = target[part] ?? {};
    target = target[part];
  }
  target[parts.at(-1)] = value;
}

function labelize(key) {
  const labels = {
    googleJobsSearch: "Google Jobs",
    rhAgenciesCuritiba: "Agências de RH em Curitiba",
    jobs99: "99jobs",
    linkedinSearch: "LinkedIn Jobs",
    indeedSearch: "Indeed",
    vagasCom: "Vagas.com",
    cathoSearch: "Catho",
    netvagas: "NetVagas",
    bne: "BNE",
    trabalhaBrasil: "Trabalha Brasil",
    glassdoorSearch: "Glassdoor",
    empregosComBr: "Empregos.com.br",
    solidesJobs: "Sólides Jobs",
    ablerJobs: "Abler",
    pandapeJobs: "Pandapé",
    gmailAlerts: "Alertas do Gmail",
    manualUrlImporter: "Links manuais",
    companyHunter: "Empresas-alvo",
    companyCareerPages: "Páginas de carreira",
    linkedinEmailAlertsOnly: "LinkedIn por e-mail",
    indeedEmailAlertsOnly: "Indeed por e-mail",
    cathoEmailAlertsOnly: "Catho por e-mail",
    infojobsEmailAlertsOnly: "InfoJobs por e-mail",
    informalWorkHunter: "Freelas e bicos",
    homeOffice: "Home office",
    remoto: "Remoto",
    hibrido: "Híbrido",
    presencial: "Presencial",
    comViagem: "Com viagem",
    semViagem: "Sem viagem",
    campoExterno: "Campo externo",
    comMudancaCidade: "Com mudança de cidade",
    semMudancaCidade: "Sem mudança de cidade",
    operacional: "Operacional",
    auxiliar: "Auxiliar",
    assistente: "Assistente",
    tecnico: "Técnico",
    analista: "Analista",
    especialista: "Especialista",
    supervisao: "Supervisão",
    coordenacao: "Coordenação",
    gestao: "Gestao",
    gerencia: "Gerencia",
    consultoria: "Consultoria",
    freelancerEventos: "Freelancer/eventos",
    clt: "CLT",
    pj: "PJ",
    temporario: "Temporário",
    freelancer: "Freelancer",
    contrato: "Contrato",
    intermitente: "Intermitente",
    estagio: "Estágio"
  };
  return labels[key] || String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace("Cnh", "CNH")
    .replace("Pj", "PJ")
    .replace("Clt", "CLT");
}

function input(label, path, value, type = "text", hint = "") {
  return `<div class="field"><label>${label}</label><input type="${type}" data-path="${path}" value="${escapeHtml(value)}">${hint ? `<small>${hint}</small>` : ""}</div>`;
}

function textareaField(label, path, value, hint = "") {
  return `<div class="field field-wide"><label>${label}</label><textarea data-path="${path}" rows="5">${escapeHtml(Array.isArray(value) ? value.join("\n") : value)}</textarea>${hint ? `<small>${hint}</small>` : ""}</div>`;
}

function numberInput(label, path, value, hint = "") {
  return input(label, path, value, "number", hint);
}

function optionDescription(key) {
  const descriptions = {
    googleJobsSearch: "Importa pelo Google apenas links finais de vagas quando a API estiver configurada.",
    linkedinSearch: "Localiza vagas no LinkedIn; você abre e se candidata manualmente pela sua conta.",
    infojobs: "Busca oportunidades no InfoJobs e ajuda a filtrar vagas reais.",
    jobs99: "Monitora oportunidades na 99jobs por cargo e localização.",
    sine: "Inclui SINE, Emprega Curitiba e portais públicos relacionados.",
    indeedSearch: "Cria buscas no Indeed para ampliar o radar sem scraping agressivo.",
    vagasCom: "Busca vagas em Vagas.com por cargo e cidade.",
    cathoSearch: "Inclui Catho como fonte de pesquisa.",
    netvagas: "Inclui NetVagas para oportunidades nacionais e remotas.",
    bne: "Inclui Banco Nacional de Empregos como fonte de pesquisa.",
    trabalhaBrasil: "Amplia buscas em Trabalha Brasil, útil para vagas operacionais.",
    glassdoorSearch: "Busca vagas e sinais de reputação via Glassdoor.",
    empregosComBr: "Inclui Empregos.com.br como fonte adicional.",
    solidesJobs: "Busca páginas públicas da Sólides Jobs usadas por empresas e consultorias.",
    ablerJobs: "Inclui vagas hospedadas no ATS Abler, usado por consultorias e RHs.",
    pandapeJobs: "Inclui vagas em Pandapé/InfoJobs Empresas, comum em recrutamento operacional.",
    autoApply: "Permite tentar envio automático apenas em canais permitidos e configurados.",
    autoApplyWhenAllowed: "Aciona automação somente quando a plataforma permite e os dados estão completos.",
    autoFillFormsWhenAllowed: "Prepara os campos para preenchimento de formulário quando houver canal oficial.",
    askAndRememberMissingFields: "Quando faltar uma resposta, o agente pergunta e salva para as próximas vagas.",
    allowLinkedInSearchOnly: "Usa LinkedIn só como fonte de descoberta; candidatura fica manual.",
    requireApprovalBeforeApply: "Exige sua aprovação antes de qualquer tentativa de envio.",
    allowQuickApplyAPIs: "Só deve ser ligado quando houver API oficial ou integração permitida.",
    allowBrowserAutofill: "Prepara preenchimento no navegador, sem burlar CAPTCHA.",
    neverApplyOnLinkedInAutomatically: "Protege sua conta: nada de candidatura automática no LinkedIn."
  };
  return descriptions[key] || "Ative se esta opção fizer sentido para seu objetivo de busca e candidatura.";
}

function checkboxGrid(title, group, values) {
  return `<div class="field-block"><label>${title}</label><div class="choice-grid">${Object.entries(values || {}).map(([key, value]) => `
    <label class="check-pill described"><input type="checkbox" data-path="${group}.${key}" ${value ? "checked" : ""}> <span><strong>${labelize(key)}</strong><small>${escapeHtml(optionDescription(key))}</small></span></label>
  `).join("")}</div></div>`;
}

function settingToggle(label, path, value, description) {
  return `<label class="check-pill described"><input type="checkbox" data-path="${path}" ${value ? "checked" : ""}> <span><strong>${label}</strong><small>${escapeHtml(description)}</small></span></label>`;
}

function riskClass(value) {
  if (Number(value) >= 60) return "risk-high";
  if (Number(value) >= 35) return "risk-mid";
  return "";
}

function ensureToastRoot() {
  let root = document.querySelector("#toastRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "toastRoot";
    document.body.appendChild(root);
  }
  return root;
}

function toast(message, type = "info") {
  const root = ensureToastRoot();
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.innerHTML = message;
  root.appendChild(item);
  window.setTimeout(() => item.remove(), 9000);
}

function shortDescription(value, max = 180) {
  const clean = String(value || "Sem descrição informada.").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}

function scoreBadge(row) {
  return `<div class="score-stack">
    <strong>${row.fit_score ?? "-"}</strong>
    <span>${escapeHtml(row.status || row.job_status || "Sem classificação")}</span>
    <small>Chance ${row.hire_chance_score ?? "-"} · Risco ${row.risk_score ?? "-"}</small>
  </div>`;
}

function applicationState(row) {
  if (String(row.pipeline_outcome || "") === "negativa") {
    return { label: "Não selecionado", tone: "warning", detail: row.last_recruiter_email_at ? `Retorno em ${formatDate(row.last_recruiter_email_at)}` : "Retorno negativo confirmado" };
  }
  if (Number(row.pipeline_stage || 1) >= 3) {
    return { label: "3ª fase", tone: "success", detail: row.next_action || "Etapa avançada do processo" };
  }
  if (Number(row.pipeline_stage || 1) >= 2) {
    return { label: "2ª fase", tone: "success", detail: row.next_action || "Avançou na triagem inicial" };
  }
  if (String(row.next_action || "").trim()) {
    return { label: "Ação necessária", tone: "warning", detail: row.next_action };
  }
  if (isSentApplication(row)) {
    return { label: "Candidatado", tone: "success", detail: row.applied_at ? `Enviado em ${formatDate(row.applied_at)}` : "Envio registrado" };
  }
  if (row.application_status === "Pronta para envio assistido") {
    return { label: "Pronta", tone: "ready", detail: "Abrir fonte oficial" };
  }
  if (row.application_status === "Preenchimento automático pronto") {
    return { label: "Preenchimento pronto", tone: "ready", detail: "Vaga real com dados preparados" };
  }
  if (row.application_status === "Candidatura automática pronta") {
    return { label: "IA pronta", tone: "ready", detail: "Aguardando permissão final" };
  }
  if (row.application_status === "Aguardando vaga real da fonte") {
    return { label: "Precisa vaga real", tone: "warning", detail: "Fonte de busca" };
  }
  if (row.application_status === "Aguardando canal de candidatura") {
    return { label: "Sem canal", tone: "warning", detail: "Confirmar link/e-mail" };
  }
  if (row.approval_status === "rejeitado_pelo_usuario") {
    return { label: "Rejeitada", tone: "muted", detail: "Fora da fila ativa" };
  }
  if (String(row.authorization_status || "") === "requer_canal") {
    return { label: "Precisa de link real", tone: "warning", detail: "Ainda não existe um canal oficial de candidatura" };
  }
  if (isAwaitingAuthorization(row)) {
    return { label: "Aguardando autorização", tone: "gold", detail: "A vaga foi aprovada, mas a IA ainda não pode iniciar" };
  }
  if (String(row.authorization_status || "") === "autorizada" && !isSentApplication(row)) {
    return { label: "IA autorizada", tone: "ready", detail: "Preparação liberada pelo usuário" };
  }
  if (row.approval_status === "aprovado_pelo_usuario") {
    return { label: "Pronta", tone: "ready", detail: "Pode iniciar candidatura" };
  }
  if (row.application_id || row.id) {
    return { label: "Preparada", tone: "info", detail: "Aguardando aprovação" };
  }
  return { label: "Nova", tone: "muted", detail: "Ainda em vagas" };
}

function stateChip(row) {
  const state = applicationState(row);
  return `<span class="state-chip ${state.tone}">${state.label}</span><small>${escapeHtml(state.detail)}</small>`;
}

function sourceBadge(sourceOrRow) {
  return `<span class="source-badge">${escapeHtml(sourceName(sourceOrRow) || "Fonte")}</span>`;
}

function sourceName(sourceOrRow) {
  const row = typeof sourceOrRow === "object" && sourceOrRow ? sourceOrRow : null;
  const source = row ? String(row.source || "") : String(sourceOrRow || "");
  const host = row ? urlHost(row.url) : "";
  const hostNames = [
    ["infojobs", "InfoJobs"],
    ["linkedin", "LinkedIn"],
    ["indeed", "Indeed"],
    ["jobbol", "Jobbol"],
    ["quickin", "Quickin"],
    ["gupy", "Gupy"],
    ["bebee", "BeBee"],
    ["jobijoba", "Jobijoba"],
    ["glassdoor", "Glassdoor"],
    ["99jobs", "99jobs"],
    ["vagas.com", "Vagas.com"],
    ["sine", "SINE"],
    ["catho", "Catho"],
    ["netvagas", "NetVagas"],
    ["bne", "BNE"],
    ["trabalhabrasil", "Trabalha Brasil"],
    ["empregos.com", "Empregos.com.br"],
    ["solides", "Sólides"],
    ["abler", "Abler"],
    ["pandape", "Pandapé"],
    ["greenhouse", "Greenhouse"],
    ["lever", "Lever"]
  ];
  const matchedHost = hostNames.find(([needle]) => host.includes(needle));
  if (matchedHost) return matchedHost[1];
  const names = {
    "google-real-job": "Google",
    "google-assisted-search": "Google",
    "manual-real-job": "Link importado",
    manual: "Link importado",
    sine: "SINE",
    infojobs: "InfoJobs",
    vagascom: "Vagas.com",
    linkedin: "LinkedIn",
    indeed: "Indeed",
    catho: "Catho",
    sine: "SINE",
    jobs99: "99jobs",
    "rh-agencies-curitiba": "RH Curitiba",
    "linkedin-search": "LinkedIn",
    "indeed-search": "Indeed",
    "vagascom-search": "Vagas.com",
    "catho-search": "Catho",
    "netvagas-search": "NetVagas",
    "bne-search": "BNE",
    "trabalhabrasil-search": "Trabalha Brasil",
    "glassdoor-search": "Glassdoor",
    "empregos-search": "Empregos.com.br",
    "solides-search": "Sólides",
    "abler-search": "Abler",
    "pandape-search": "Pandapé",
    gupy: "Gupy",
    greenhouse: "Greenhouse",
    lever: "Lever",
    rss: "RSS",
    whatsapp: "WhatsApp",
    gmail: "Gmail / newsletters"
  };
  return names[source] || source.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) || "Fonte";
}

function urlHost(value) {
  try {
    return new URL(String(value || "")).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function sourceRank(name) {
  const order = ["InfoJobs", "LinkedIn", "Indeed", "Jobbol", "Quickin", "Gupy", "Vagas.com", "Catho", "SINE", "99jobs", "BeBee", "Jobijoba", "Glassdoor", "RH Curitiba", "Google", "Link importado"];
  const index = order.indexOf(name);
  return index === -1 ? 999 : index;
}

function uniqueSources(rows) {
  return [...new Set(rows.map(sourceName).filter(Boolean))]
    .sort((a, b) => sourceRank(a) - sourceRank(b) || a.localeCompare(b, "pt-BR"));
}

function groupRowsBySource(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const name = sourceName(row);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(row);
  });
  return [...groups.entries()].sort(([a], [b]) => sourceRank(a) - sourceRank(b) || a.localeCompare(b, "pt-BR"));
}

function sourceGroupStats(rows) {
  const direct = rows.filter(hasDirectJobUrl).length;
  const ia = rows.filter((row) => applicationChannel(row).id === "ia").length;
  const sent = rows.filter(isSentApplication).length;
  const pending = rows.length - sent;
  return [
    `<span>${direct} link(s) direto(s)</span>`,
    ia ? `<span>${ia} por IA</span>` : "",
    sent ? `<span>${sent} enviada(s)</span>` : "",
    pending ? `<span>${pending} pendente(s)</span>` : ""
  ].filter(Boolean).join("");
}

function renderGroupedCards(rows, cardRenderer, itemLabel) {
  return `<div class="source-groups">${groupRowsBySource(rows).map(([name, sourceRows]) => `
    <section class="source-group">
      <div class="source-group-head">
        <div>
          <span class="eyebrow">Fonte</span>
          <h3>${escapeHtml(name)}</h3>
          <p>${sourceRows.length} ${escapeHtml(itemLabel)}${sourceRows.length === 1 ? "" : "s"} nesta fonte.</p>
        </div>
        <div class="source-group-stats">${sourceGroupStats(sourceRows)}</div>
      </div>
      <div class="opportunity-grid">${sourceRows.map(cardRenderer).join("")}</div>
    </section>`).join("")}</div>`;
}

function sourceLink(row, label = sourceName(row)) {
  return hasDirectJobUrl(row)
    ? `<a class="source-link" href="${escapeHtml(row.url)}" target="_blank" rel="noreferrer">${escapeHtml(label)} ${icon("external-link")}</a>`
    : isAssistedSource(row.source) && hasUsableJobUrl(row)
      ? `<a class="source-link" href="${escapeHtml(row.url)}" target="_blank" rel="noreferrer">Buscar no ${escapeHtml(label)} ${icon("external-link")}</a>`
    : `<span class="source-badge">${escapeHtml(label)}</span>`;
}

function sourceActionLink(row) {
  if (hasDirectJobUrl(row)) {
    return `<a class="action" href="${escapeHtml(row.url)}" target="_blank" rel="noreferrer">${icon("external-link")} Abrir vaga</a>`;
  }
  if (isAssistedSource(row.source) && hasUsableJobUrl(row)) {
    return `<a class="action secondary" href="${escapeHtml(row.url)}" target="_blank" rel="noreferrer">${icon("search")} Buscar no ${escapeHtml(sourceName(row))}</a>`;
  }
  return "";
}

function aiAccelerateButton(row, label = "Acelerar candidatura", applicationId = "") {
  if (!hasDirectJobUrl(row)) return "";
  const title = row.title || "";
  const company = row.company || "";
  return `<button class="primary" data-accelerate-url="${escapeHtml(row.url)}" data-accelerate-title="${escapeHtml(title)}" data-accelerate-company="${escapeHtml(company)}" data-accelerate-application-id="${escapeHtml(applicationId)}" data-accelerate-job-id="${escapeHtml(row.id || row.job_id || "")}">${escapeHtml(label)}</button>`;
}

function duplicateBadge(row) {
  const count = Number(row.duplicate_count || 0);
  if (count <= 1) return "";
  const sources = row.duplicate_sources ? `Fontes: ${row.duplicate_sources}` : "Mesmo cargo, empresa, local ou link detectado em outra fonte.";
  return `<span class="state-chip warning" title="${escapeHtml(sources)}">Possível duplicada (${count})</span>`;
}

function isGoogleSearchUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.replace(/^www\./, "");
    return host.startsWith("google.") && (url.pathname.includes("/search") || url.searchParams.has("q") || url.searchParams.has("udm"));
  } catch {
    return false;
  }
}

function hasUsableJobUrl(row) {
  return Boolean(row?.url) && !isGoogleSearchUrl(row.url);
}

function hasDirectJobUrl(row) {
  return hasUsableJobUrl(row) && !isAssistedSource(row.source);
}

function fileName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Não gerado";
  return raw.split(/[\\/]/).filter(Boolean).pop() || raw;
}

function isSentApplication(row) {
  return Number(row.sent_by_agent) === 1 || Boolean(row.applied_at) || /candidatura enviada|enviada pelo|enviada por e-mail/i.test(String(row.application_status || ""));
}

function isApprovedApplication(row) {
  return row.approval_status === "aprovado_pelo_usuario" && !isSentApplication(row);
}

function isAuthorizedApplication(row) {
  return isApprovedApplication(row) && String(row.authorization_status || "") === "autorizada";
}

function isAwaitingAuthorization(row) {
  return isApprovedApplication(row) && String(row.authorization_status || "aguardando_autorizacao") === "aguardando_autorizacao";
}

function isAssistedSource(source) {
  return assistedSources.has(String(source || ""));
}

function applicationChannel(row) {
  const url = String(row.url || "").toLowerCase();
  const text = [row.source, row.description, row.application_status, row.notes].join(" ").toLowerCase();
  if (url.startsWith("mailto:") || /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(text)) return { id: "email", label: "E-mail", tone: "ready" };
  if (url.includes("wa.me") || url.includes("whatsapp") || text.includes("whatsapp")) return { id: "whatsapp", label: "WhatsApp", tone: "success" };
  if (url.startsWith("tel:") || text.includes("telefone") || text.includes("ligar")) return { id: "telefone", label: "Telefone", tone: "info" };
  if (!hasDirectJobUrl(row)) return { id: "precisa_link", label: "Precisa link real", tone: "warning" };
  if (String(row.source || "").includes("linkedin") || url.includes("linkedin.com")) return { id: "manual", label: "Você faz", tone: "warning" };
  if (row.application_status === "Aguardando resposta do usuário") return { id: "dados", label: "Faltam dados", tone: "warning" };
  return { id: "ia", label: "IA pode ajudar", tone: "ready" };
}

function applicationNextAction(row) {
  const channel = applicationChannel(row);
  if (isSentApplication(row)) return "Acompanhar resposta, retorno do recrutador e disponibilidade da vaga.";
  if (String(row.authorization_status || "") === "requer_canal") return "Abra a fonte, encontre a vaga individual e importe o link oficial antes de autorizar.";
  if (isAwaitingAuthorization(row)) return "Revise a vaga e autorize a IA. Nenhuma candidatura será iniciada antes dessa confirmação.";
  if (channel.id === "ia") return "Abra o assistente para preparar campos, respostas, currículo e carta.";
  if (channel.id === "email") return "Enviar currículo/carta por e-mail somente depois de revisar a mensagem.";
  if (channel.id === "whatsapp") return "Abrir WhatsApp, confirmar empresa, responsável, remuneração e enviar currículo com cuidado.";
  if (channel.id === "telefone") return "Ligar ou chamar o contato e registrar retorno no painel.";
  if (channel.id === "manual") return "Abrir a fonte e concluir pela sua conta. A IA deixa os dados prontos para copiar.";
  if (channel.id === "dados") return "Responder as perguntas que faltam. O agente salva na memória para próximas vagas.";
  return "Abrir a fonte, entrar na vaga individual e importar o link oficial.";
}

function availabilityChip(row) {
  const status = String(row.availability_status || "nao_verificado");
  if (status === "aberta") return `<span class="state-chip success">Aberta</span><small>Verificada: ${formatDate(row.availability_checked_at)}</small>`;
  if (status === "fechada") return `<span class="state-chip warning">Fechada</span><small>Aviso por 15 dias desde ${formatDate(row.availability_closed_at || row.availability_checked_at)}</small>`;
  if (status === "indefinida") return `<span class="state-chip info">Indefinida</span><small>Não foi possível confirmar automaticamente.</small>`;
  return `<span class="state-chip muted">Não verificada</span><small>Use Verificar disponibilidade.</small>`;
}

function metaGrid(items) {
  return `<div class="compact-meta-grid">${items.map(([label, value]) => `
    <div><span>${escapeHtml(label)}</span><strong>${value}</strong></div>
  `).join("")}</div>`;
}

function cardCheckbox(className, id) {
  return `<label class="card-check"><input class="${className}" type="checkbox" value="${id}"><span>Selecionar</span></label>`;
}

function formatDate(value) {
  if (!value) return "Ainda não registrado";
  const raw = String(value).trim();
  const iso = raw.replace(" ", "T");
  const date = new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

function formatDayMonth(value) {
  if (!value) return "--/--";
  const raw = String(value).trim();
  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}`;
  const brazilianDate = raw.match(/^(\d{2})\/(\d{2})/);
  if (brazilianDate) return `${brazilianDate[1]}/${brazilianDate[2]}`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

function protectGmailSyncButton(button, gmail, readyLabel) {
  if (!button || !gmail?.rateLimited) return;
  const retryAt = Date.parse(gmail.retryAfter || "");
  button.disabled = true;
  button.textContent = Number.isFinite(retryAt)
    ? `Retoma às ${new Date(retryAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}`
    : "Pausa temporária";
  if (!Number.isFinite(retryAt)) return;
  window.setTimeout(() => {
    if (!document.contains(button)) return;
    button.disabled = false;
    button.textContent = readyLabel;
  }, Math.max(1_000, retryAt - Date.now() + 2_000));
}

function moneyAwareSalary(row) {
  const salary = String(row.salary || "").trim().toLowerCase();
  return salary && !["nao informado", "não informado", "a combinar", "-"].includes(salary);
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function optionList(values, current, allLabel) {
  return [`<option value="all">${allLabel}</option>`, ...values.map((value) => `<option value="${escapeHtml(value)}" ${current === value ? "selected" : ""}>${escapeHtml(value)}</option>`)].join("");
}

function prefKey(scope) {
  return `careerHunter:${scope}:columns`;
}

function filterKey(scope) {
  return `careerHunter:${scope}:filters`;
}

function getVisibleColumns(scope, columns) {
  const stored = localStorage.getItem(prefKey(scope));
  const defaults = columns.filter((column) => column.always || column.default !== false).map((column) => column.id);
  const ids = stored ? JSON.parse(stored) : defaults;
  return new Set(ids);
}

function saveVisibleColumns(scope, columns) {
  const visible = [...document.querySelectorAll(`[data-column-scope="${scope}"]:checked`)].map((input) => input.value);
  const always = columns.filter((column) => column.always).map((column) => column.id);
  localStorage.setItem(prefKey(scope), JSON.stringify([...new Set([...visible, ...always])]));
}

function columnPicker(scope, columns) {
  const visible = getVisibleColumns(scope, columns);
  return `<div class="column-picker">
    <div><strong>Colunas visiveis</strong><small>Escolha quais caracteristicas aparecem na tabela.</small></div>
    <div class="choice-grid compact">${columns.filter((column) => !column.always).map((column) => `
      <label class="check-pill"><input type="checkbox" data-column-scope="${scope}" value="${column.id}" ${visible.has(column.id) ? "checked" : ""}> <span>${column.label}</span></label>
    `).join("")}</div>
  </div>`;
}

function renderTable(scope, rows, columns, emptyHtml) {
  const visible = getVisibleColumns(scope, columns);
  const activeColumns = columns.filter((column) => column.always || visible.has(column.id));
  if (!rows.length) return emptyHtml;
  return `<table class="data-table ${scope}-table"><thead><tr>${activeColumns.map((column) => `<th>${escapeHtml(column.label || "Selecionar")}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${activeColumns.map((column) => `<td data-label="${escapeHtml(column.label || "Selecionar")}"><div class="cell-content">${column.render(row)}</div></td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function getSavedFilters(scope, defaults) {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(filterKey(scope)) || "{}") };
  } catch {
    return defaults;
  }
}

function saveFilters(scope, filters) {
  localStorage.setItem(filterKey(scope), JSON.stringify(filters));
}

function includesSearch(row, query) {
  if (!query) return true;
  const haystack = [row.title, row.company, row.location, row.source, row.description, row.application_status, row.status].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

async function runScanAndRefresh(target = "dashboard") {
  toast("Buscando novas vagas. O radar está rodando uma nova pesquisa.", "info");
  try {
    const data = await json("/api/scan", { method: "POST" });
    if (!data.ok) throw new Error(data.error || "falha desconhecida");
    toast("Busca concluída. Novas oportunidades foram verificadas.", "success");
    await load(target);
  } catch (error) {
    toast(`Erro ao buscar vagas: ${escapeHtml(error.message)}`, "error");
  }
}

function realLinkImporter(idPrefix, onImported) {
  return `<div class="real-link-box">
    <div>
      <span class="eyebrow">Vaga real</span>
      <strong>Colar link oficial de candidatura</strong>
      <small>Use quando uma página de busca abrir uma vaga individual com formulário, e-mail ou página oficial.</small>
    </div>
    <label>Link da vaga<input id="${idPrefix}RealJobUrl" placeholder="https://site-da-vaga.com/vaga/oficial"></label>
    <button id="${idPrefix}ImportRealJob" class="primary">Importar link real</button>
    <span id="${idPrefix}RealJobStatus"></span>
  </div>`;
}

function jobNextStep(row) {
  if (assistedSources.has(row.source)) return "Fonte de busca: abra, escolha uma vaga individual e importe o link real.";
  if (!hasDirectJobUrl(row)) return "Sem canal de candidatura: confirme e-mail, formulário ou página oficial antes de enviar dados.";
  return "Fonte direta validada: aprove a vaga para colocá-la na fila de autorização.";
}

function jobCard(row) {
  const canApprove = hasDirectJobUrl(row);
  const fit = Number(row.fit_score || 0);
  const fitTone = fit >= 85 ? "excellent" : fit >= 70 ? "good" : fit >= 50 ? "average" : "low";
  return `<article class="opportunity-card">
    <div class="card-topline">
      <div class="card-select-wrap">${canApprove ? cardCheckbox("job-check", row.id) : `<span class="state-chip warning">Sem link direto</span>`}${fit >= 85 ? `<span class="recommendation-tag">Recomendada</span>` : ""}</div>
      <div class="card-score ${fitTone}"><strong>${row.fit_score ?? "-"}</strong><span>aderência</span></div>
    </div>
    <div class="card-title-row">
      <div>
        <h3>${escapeHtml(row.title)}</h3>
        <p>${escapeHtml(row.company || "Empresa a confirmar")}</p>
      </div>
      ${sourceLink(row)}
    </div>
    <div class="mini-chip-row">${duplicateBadge(row)}<span class="state-chip neutral">Chance ${escapeHtml(row.hire_chance_score ?? "-")}/100</span></div>
    ${metaGrid([
      ["Salário", escapeHtml(row.salary || "Não informado")],
      ["Local", escapeHtml(row.location || "A confirmar")],
      ["Modelo", escapeHtml(row.work_model || "A confirmar")],
      ["Encontrada", escapeHtml(formatDate(row.found_at))]
    ])}
    <p class="card-description">${escapeHtml(shortDescription(row.description, 360))}</p>
    <div class="fit-explanation">
      <span>${icon("sparkles")}</span>
      <p><strong>Por que combina</strong>${escapeHtml(shortDescription(row.fit_reason || "A nota considera seu currículo, o cargo, o local e a qualidade do anúncio.", 180))}</p>
    </div>
    <div class="card-actions">
      ${sourceActionLink(row)}
      ${canApprove ? `<button class="primary" data-job-approve="${row.id}">${icon("check")} Aprovar</button>` : ""}
      <button data-detail="${row.id}">${icon("file-text")} Detalhes</button>
    </div>
  </article>`;
}

function applicationCard(row, context = "approved") {
  const channel = applicationChannel(row);
  const state = applicationState(row);
  const authorized = isAuthorizedApplication(row);
  const needsAttention = Number(row.latest_requires_action || 0) === 1 || Boolean(String(row.next_action || "").trim()) || row.application_status === "Aguardando resposta do usuário";
  const canApplyWithAi = authorized && ["ia", "dados"].includes(channel.id);
  const fit = Number(row.fit_score || 0);
  const fitTone = fit >= 85 ? "excellent" : fit >= 70 ? "good" : fit >= 50 ? "average" : "low";
  const latestReturn = String(row.latest_email_subject || row.latest_action_summary || row.latest_email_excerpt || "").trim();
  return `<article class="opportunity-card application-card" data-channel="${channel.id}">
    <div class="card-topline">
      ${cardCheckbox("application-check", row.id)}
      <div class="card-score ${fitTone}"><strong>${row.fit_score ?? "-"}</strong><span>aderência</span></div>
    </div>
    <div class="card-title-row">
      <div>
        <h3>${escapeHtml(row.title || `Candidatura ${row.id}`)}</h3>
        <p>${escapeHtml(row.company || "Empresa a confirmar")}</p>
      </div>
      ${sourceLink(row)}
    </div>
    <div class="mini-chip-row">${duplicateBadge(row)}<span class="state-chip ${state.tone}">${escapeHtml(state.label)}</span><span class="state-chip neutral">Chance ${escapeHtml(row.hire_chance_score ?? "-")}/100</span></div>
    ${metaGrid([
      ["Salário", escapeHtml(row.salary || "Não informado")],
      ["Local", escapeHtml(row.location || "A confirmar")],
      ["Modelo", escapeHtml(row.work_model || "A confirmar")],
      [context === "sent" ? "Candidatado em" : "Aprovada em", escapeHtml(formatDate(context === "sent" ? row.applied_at : row.updated_at))]
    ])}
    <p class="card-description">${escapeHtml(shortDescription(row.description, 280))}</p>
    ${latestReturn ? `<div class="return-preview ${Number(row.latest_requires_action || 0) === 1 ? "attention" : ""}">
      ${icon(Number(row.latest_requires_action || 0) === 1 ? "circle-alert" : "mail")}
      <div><strong>${Number(row.latest_requires_action || 0) === 1 ? "Ação solicitada" : "Último retorno"}</strong><p>${escapeHtml(shortDescription(latestReturn, 220))}</p></div>
    </div>` : ""}
    <div class="application-timeline" aria-label="Linha do tempo">
      <span class="done"><i></i><strong>Aprovada</strong><small>${escapeHtml(formatDayMonth(row.created_at || row.updated_at))}</small></span>
      <span class="${authorized || context === "sent" ? "done" : "current"}"><i></i><strong>Autorizada</strong><small>${authorized || context === "sent" ? escapeHtml(formatDayMonth(row.authorized_at)) : "Aguardando"}</small></span>
      <span class="${context === "sent" ? "done" : authorized ? "current" : ""}"><i></i><strong>Enviada</strong><small>${context === "sent" ? escapeHtml(formatDayMonth(row.applied_at)) : authorized ? "Em preparação" : "Pendente"}</small></span>
    </div>
    <div class="card-footer application-next-step">
      ${context !== "sent" ? `<span class="state-chip ${channel.tone}">${escapeHtml(channel.label)}</span>` : availabilityChip(row)}
      <small>${escapeHtml(context === "sent" ? row.next_action || "O Gmail monitora respostas e mudanças de etapa." : applicationNextAction(row))}</small>
    </div>
    <div class="card-actions">
      ${sourceActionLink(row)}
      ${row.latest_email_url ? `<a class="action" href="${escapeHtml(row.latest_email_url)}" target="_blank" rel="noreferrer">${icon("mail")} Abrir e-mail</a>` : ""}
      ${context !== "sent" && isAwaitingAuthorization(row) && !needsAttention ? `<button class="primary" data-authorize="${row.id}">${icon("wand")} Autorizar IA</button>` : ""}
      ${canApplyWithAi && context !== "sent" ? `<button class="primary" data-ai-apply="${row.id}" data-application-url="${escapeHtml(row.url || "")}" data-application-title="${escapeHtml(row.title || "")}" data-application-company="${escapeHtml(row.company || "")}">${icon("bot")} Abrir e preencher</button>` : ""}
      ${context !== "sent" && authorized ? `<button data-mark-sent="${row.id}">${icon("check-circle")} Confirmar envio</button>` : context === "sent" ? `<button data-retry="${row.id}">${icon("retry")} Candidatar novamente</button>` : ""}
      ${row.job_id ? `<button data-detail="${row.job_id}">${icon("file-text")} Detalhes</button>` : ""}
    </div>
  </article>`;
}

function actionCard(action) {
  const tone = action.priority === "alta" ? "warning" : action.type === "candidatada" ? "success" : "info";
  return `<article class="action-card">
    <div>
      <span class="state-chip ${tone}">${escapeHtml(action.label || action.type || "Ação")}</span>
      <h3>${escapeHtml(action.title || "Ação pendente")}</h3>
      <p>${escapeHtml(action.message || "")}</p>
      <small>${escapeHtml(action.nextStep || "")}</small>
    </div>
    <div class="card-actions">
      ${action.url && !isGoogleSearchUrl(action.url) ? `<a class="action" href="${escapeHtml(action.url)}" target="_blank" rel="noreferrer">Abrir fonte</a>` : ""}
      ${action.url && !isGoogleSearchUrl(action.url) ? `<button class="primary" data-accelerate-url="${escapeHtml(action.url)}" data-accelerate-title="${escapeHtml(action.title || "")}" data-accelerate-company="" data-accelerate-application-id="${escapeHtml(action.applicationId || "")}">Abrir na IA</button>` : ""}
      ${action.applicationId ? `<button data-tab="applications">Ver candidatura</button>` : ""}
      ${action.jobId ? `<button data-detail="${action.jobId}">Detalhes</button>` : ""}
    </div>
  </article>`;
}

function jobGuidancePanel(rows) {
  const realLinks = rows.filter(hasDirectJobUrl).length;
  const assisted = rows.filter((row) => assistedSources.has(row.source)).length;
  const noChannel = rows.filter((row) => !hasUsableJobUrl(row) && !assistedSources.has(row.source)).length;
  return `<div class="guidance-panel">
    <div>
      <span class="eyebrow">Fluxo simples</span>
      <h3>Você escolhe. A IA só começa com autorização.</h3>
      <p>Analise a aderência e a fonte. Ao aprovar, a vaga sai desta tela e entra em Candidaturas aguardando sua ordem final.</p>
    </div>
    <div class="guidance-steps">
      <div><strong>1. Analise</strong><small>Cargo, salário, local, nota e fonte.</small></div>
      <div><strong>2. Aprove</strong><small>Envie apenas as melhores para sua fila.</small></div>
      <div><strong>3. Autorize</strong><small>A IA começa somente depois da sua confirmação.</small></div>
    </div>
    <div class="guidance-stats">
      <span class="state-chip success">${realLinks} com link direto</span>
      <span class="state-chip warning">${assisted} fontes de busca</span>
      <span class="state-chip info">${noChannel} sem canal claro</span>
    </div>
  </div>`;
}

function bindRealLinkImporter(idPrefix, onImported = () => load("jobs")) {
  const button = document.querySelector(`#${idPrefix}ImportRealJob`);
  if (!button) return;
  button.onclick = async () => {
    const input = document.querySelector(`#${idPrefix}RealJobUrl`);
    const status = document.querySelector(`#${idPrefix}RealJobStatus`);
    const url = input.value.trim();
    if (!url) {
      status.textContent = "Cole o link real da vaga antes de importar.";
      return;
    }
    try {
      const result = await json("/api/manual-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      status.textContent = result.message || "Link importado.";
      toast("Link real importado para a fila de vagas.", "success");
      input.value = "";
      await onImported(result);
    } catch (error) {
      status.textContent = error.message;
      toast(`Erro ao importar link: ${escapeHtml(error.message)}`, "error");
    }
  };
}

async function dashboard() {
  const [summary, gmail, sourceData] = await Promise.all([
    json("/api/summary"),
    json("/api/gmail/status"),
    json("/api/sources")
  ]);
  const pipeline = summary.pipeline || {};
  const salary = summary.salary || {};
  const momentum = summary.momentum || {};
  const activityTrend = summary.activityTrend || [];
  const sourceRows = (sourceData.sources || []).slice(0, 5);
  const gmailLimited = Boolean(gmail.rateLimited);
  const gmailPillClass = gmailLimited ? "limited" : gmail.connected ? "online" : "offline";
  const gmailPillLabel = gmailLimited ? "conectado, em pausa" : gmail.connected ? "conectado" : "desconectado";
  const gmailAccountLabel = gmail.email || (gmail.connected ? "Conta Google autorizada" : "Conta não conectada");
  const gmailStatusDetail = gmailLimited
    ? `${gmail.warning || "O Google limitou temporariamente as leituras."}${gmail.retryAfter ? ` Nova tentativa em ${formatDayMonth(gmail.retryAfter)}.` : ""}`
    : `${gmail.lastSync?.completed_at ? `Última leitura: ${formatDayMonth(gmail.lastSync.completed_at)}` : "Nenhuma leitura registrada"}. Atualização automática a cada ${gmail.automaticEveryMinutes || 30} min.`;
  const suggestions = dashboardAiSuggestions(summary, gmail, sourceRows);
  const firstName = String(currentUser?.name || "").trim().split(/\s+/)[0] || "profissional";
  const currentHour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  const greeting = currentHour < 12 ? "Bom dia" : currentHour < 18 ? "Boa tarde" : "Boa noite";
  const recentEvents = (summary.recentRecruiterEvents || []).slice(0, 5);

  app.innerHTML = `<section class="apice-command">
    <div class="command-copy">
      <span class="eyebrow">Central Ápice</span>
      <h1>${greeting}, ${escapeHtml(firstName)}.</h1>
      <p>Seu próximo avanço está organizado em uma única sequência. Aprove boas vagas, autorize a IA e acompanhe apenas candidaturas confirmadas.</p>
    </div>
    <div class="command-actions">
      <span class="connection-pill ${gmailPillClass}"><i></i> Gmail ${gmailPillLabel}</span>
      <button id="syncGmail">Atualizar Gmail</button>
      <button id="scanNow" class="primary">Buscar novas vagas</button>
    </div>
  </section>

  <section class="workflow-band" aria-label="Fluxo de candidatura">
    ${workflowNode("01", "Vagas encontradas", summary.availableJobs || 0, "Você analisa e aprova", "jobs", "discover")}
    <span class="workflow-line"></span>
    ${workflowNode("02", "Aguardando autorização", summary.awaitingAuthorization || 0, "Nada começa sem sua ordem", "applications", "authorize")}
    <span class="workflow-line"></span>
    ${workflowNode("03", "IA em preparação", summary.authorized || 0, "Dados e materiais prontos", "applications", "execute")}
    <span class="workflow-line"></span>
    ${workflowNode("04", "Candidatadas", pipeline.actual || 0, "Envios realmente confirmados", "applications", "track")}
  </section>

  <div class="executive-scoreboard">
    ${metricCard("Candidaturas reais", pipeline.actual, `Última: ${formatDayMonth(summary.lastAppliedAt)}`, "blue")}
    ${metricCard("Avançaram", pipeline.selected, `${pipeline.responseRate || 0}% de taxa de retorno`, "success")}
    ${metricCard("Precisam de você", pipeline.actions, "Ações objetivas e pendências", "warning")}
    ${metricCard("Conversão positiva", `${momentum.positiveRate || 0}%`, "Entre respostas com decisão", "gold")}
  </div>

  <div class="dashboard-core-grid">
    <section class="ai-advisor">
      <div class="section-head">
        <div><span class="eyebrow">Ápice IA</span><h2>Decisões recomendadas agora</h2><p>Prioridades calculadas com suas vagas, respostas, salário e situação do perfil.</p></div>
        <span class="advisor-signal">${suggestions.length} recomendações</span>
      </div>
      <div class="advisor-list">${suggestions.map(aiSuggestionRow).join("")}</div>
    </section>

    <aside class="system-brief">
      <div class="section-head"><div><span class="eyebrow">Sistema</span><h3>Operação sob controle</h3></div></div>
      <div class="system-status-list">
        <div><span class="status-dot ${gmailPillClass}"></span><div><strong>Gmail ${gmailPillLabel}</strong><small>${escapeHtml(gmailAccountLabel)}</small></div></div>
        <div><span class="status-index">${summary.memoryAnswers || 0}</span><div><strong>Respostas memorizadas</strong><small>Reutilizadas nos próximos formulários</small></div></div>
        <div><span class="status-index">${salary.atOrAboveTarget || 0}</span><div><strong>Vagas na meta salarial</strong><small>Salário-base de ${formatMoney(salary.target || 3000)} ou mais</small></div></div>
      </div>
      <p class="system-note">${escapeHtml(gmailStatusDetail)}</p>
      <button data-tab="profile">Revisar meu perfil</button>
    </aside>
  </div>

  <div class="dashboard-insight-grid">
    <section class="performance-panel">
      <div class="section-head"><div><span class="eyebrow">Desempenho</span><h3>Atividade dos últimos 14 dias</h3></div><span class="data-caption">${momentum.applications7d || 0} envios e ${momentum.replies7d || 0} respostas em 7 dias</span></div>
      ${activityPulseChart(activityTrend)}
    </section>
    <section class="recruiter-panel">
      <div class="section-head"><div><span class="eyebrow">Recrutadores</span><h3>Movimentos recentes</h3></div><button data-tab="applications">Ver candidaturas</button></div>
      <div class="event-feed">
        ${recentEvents.map(recruiterEventRow).join("") || `<div class="empty-mini">Nenhuma resposta nova. O Gmail continuará monitorando.</div>`}
      </div>
    </section>
  </div>

  <section class="market-intelligence">
    <div class="section-head">
      <div><span class="eyebrow">Inteligência de mercado</span><h3>Onde concentrar sua energia</h3></div>
      <span class="data-caption">Salário-base, qualidade das fontes e retorno real</span>
    </div>
    <div class="market-grid">
      <div>
        <div class="salary-summary">
          <div><strong>${salary.atOrAboveTarget || 0}</strong><span>na meta salarial</span></div>
          <div><strong>${salary.notInformed || 0}</strong><span>sem salário informado</span></div>
          <div><strong>${formatMoney(salary.medianMinimum || 0)}</strong><span>mediana anunciada</span></div>
        </div>
        ${salaryChart(salary.distribution || [])}
      </div>
      <div class="source-performance">
        ${sourceRows.map(sourcePerformanceRow).join("") || `<div class="empty-mini">As fontes aparecerão depois da próxima busca.</div>`}
      </div>
    </div>
  </section>`;

  document.querySelector("#scanNow").onclick = () => runScanAndRefresh("dashboard");
  document.querySelector("#syncGmail").onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Lendo Gmail...";
    try {
      const result = await json("/api/gmail/sync", { method: "POST" });
      toast(`${result.matched} retorno(s) vinculados e ${result.jobsImported || 0} nova(s) vaga(s) importada(s) do Gmail.`, "success");
      await dashboard();
    } catch (error) {
      toast(error.message, "error");
      button.disabled = false;
      button.textContent = "Atualizar Gmail agora";
    }
  };
  protectGmailSyncButton(document.querySelector("#syncGmail"), gmail, "Atualizar Gmail");
}

function workflowNode(index, label, value, detail, tab, tone) {
  return `<button class="workflow-node ${tone}" data-tab="${tab}">
    <span>${index}</span>
    <strong>${value}</strong>
    <div><b>${escapeHtml(label)}</b><small>${escapeHtml(detail)}</small></div>
  </button>`;
}

function dashboardAiSuggestions(summary, gmail, sourceRows) {
  const suggestions = [];
  const actions = summary.recruiterActions || [];
  if (actions.length) {
    const first = actions[0];
    suggestions.push({
      tone: "urgent",
      priority: "Prioridade alta",
      title: `${actions.length} ação(ões) aguardando você`,
      detail: `${first.title || "Vaga"} em ${first.company || "empresa"}: ${first.next_action || "revisar retorno"}.`,
      label: "Resolver agora",
      tab: "applications"
    });
  }
  if (Number(summary.awaitingAuthorization || 0) > 0) {
    suggestions.push({
      tone: "decision",
      priority: "Sua decisão",
      title: `Autorize ${summary.awaitingAuthorization} candidatura(s) aprovada(s)`,
      detail: "A IA só prepara ou executa essas candidaturas depois da sua autorização explícita.",
      label: "Revisar e autorizar",
      tab: "applications"
    });
  }
  if (Number(summary.authorized || 0) > 0) {
    suggestions.push({
      tone: "progress",
      priority: "Em andamento",
      title: `${summary.authorized} candidatura(s) liberada(s) para a IA`,
      detail: "Abra a fila para concluir formulários permitidos e identificar dados que ainda faltam.",
      label: "Acompanhar fila",
      tab: "applications"
    });
  }
  if (Number(summary.availableJobs || 0) > 0) {
    suggestions.push({
      tone: "opportunity",
      priority: "Oportunidade",
      title: `${summary.availableJobs} vaga(s) aguardando análise`,
      detail: "Comece pelas notas mais altas, fontes diretas e anúncios com salário-base informado.",
      label: "Analisar vagas",
      tab: "jobs"
    });
  }
  if (!gmail.connected) {
    suggestions.push({
      tone: "urgent",
      priority: "Integração",
      title: "Reconecte o Gmail",
      detail: "Sem a conexão, o Ápice não consegue classificar respostas, recusas e convites de entrevista.",
      label: "Abrir perfil",
      tab: "profile"
    });
  } else if (gmail.rateLimited) {
    suggestions.push({
      tone: "decision",
      priority: "Monitoramento",
      title: "Gmail em pausa automática",
      detail: "A autorização continua válida. O sistema retomará a leitura sem exigir uma nova conexão.",
      label: "Ver candidaturas",
      tab: "applications"
    });
  }
  if (sourceRows[0] && Number(sourceRows[0].responseRate || 0) > 0) {
    suggestions.push({
      tone: "insight",
      priority: "Fonte eficiente",
      title: `${sourceRows[0].source} lidera seu retorno`,
      detail: `${sourceRows[0].responseRate}% de resposta nas candidaturas registradas nesta fonte.`,
      label: "Buscar novas vagas",
      tab: "jobs"
    });
  }
  if (!suggestions.length) {
    suggestions.push({
      tone: "progress",
      priority: "Tudo em ordem",
      title: "Seu fluxo está atualizado",
      detail: "Rode uma nova busca para descobrir oportunidades alinhadas ao seu perfil.",
      label: "Buscar vagas",
      tab: "jobs"
    });
  }
  return suggestions.slice(0, 4);
}

function aiSuggestionRow(item) {
  return `<article class="advisor-row ${item.tone}">
    <span class="advisor-marker"></span>
    <div><small>${escapeHtml(item.priority)}</small><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></div>
    <button data-tab="${escapeHtml(item.tab)}">${escapeHtml(item.label)}</button>
  </article>`;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function phaseCard(label, data, detail) {
  const total = Number(data?.total || 0);
  const positive = Number(data?.positive || 0);
  const negative = Number(data?.negative || 0);
  const waiting = Number(data?.waiting || 0);
  return `<article class="phase-card">
    <div><span>${label}</span><strong>${total}</strong><small>${escapeHtml(detail)}</small></div>
    <div class="phase-outcomes">
      <span class="positive">${positive} positivas</span>
      <span class="negative">${negative} negativas</span>
      <span class="waiting">${waiting} sem retorno</span>
    </div>
  </article>`;
}

function salaryChart(rows) {
  const max = Math.max(1, ...rows.map((row) => Number(row.total || 0)));
  return `<div class="salary-chart">${rows.map((row) => `<div class="salary-row">
    <span>${escapeHtml(row.label)}</span>
    <div><i style="width:${Math.max(row.total ? 4 : 0, Math.round((Number(row.total || 0) / max) * 100))}%;background:${escapeHtml(row.color)}"></i></div>
    <strong>${row.total || 0}</strong>
  </div>`).join("")}</div>`;
}

function activityPulseChart(rows) {
  const max = Math.max(1, ...rows.flatMap((row) => [Number(row.applications || 0), Number(row.replies || 0)]));
  return `<div class="activity-pulse">
    <div class="activity-legend"><span><i class="application"></i>Candidaturas</span><span><i class="reply"></i>Respostas</span></div>
    <div class="activity-bars">${rows.map((row) => `<div class="activity-day" title="${escapeHtml(formatDayMonth(row.day))}: ${row.applications || 0} candidatura(s), ${row.replies || 0} resposta(s)">
      <div><i class="application" style="height:${Math.max(Number(row.applications) ? 8 : 2, Math.round((Number(row.applications || 0) / max) * 100))}%"></i><i class="reply" style="height:${Math.max(Number(row.replies) ? 8 : 2, Math.round((Number(row.replies || 0) / max) * 100))}%"></i></div>
      <small>${escapeHtml(formatDayMonth(row.day))}</small>
    </div>`).join("")}</div>
  </div>`;
}

function sourcePerformanceRow(row) {
  return `<div class="source-performance-row">
    <div><strong>${escapeHtml(row.source)}</strong><small>${row.applications || 0} candidaturas · ${row.jobs || 0} vagas</small></div>
    <div><span>${row.selected || 0} avanços</span><strong>${row.responseRate || 0}%</strong></div>
  </div>`;
}

function recruiterEventRow(row) {
  const labels = {
    rejection: ["Não selecionado", "negative"],
    advanced: ["Avançou de fase", "positive"],
    interview: ["Entrevista", "positive"],
    offer: ["Proposta", "positive"],
    action_required: ["Ação necessária", "needs-action"],
    reviewing: ["Em análise", "waiting"]
  };
  const [label, tone] = labels[row.event_type] || ["Atualização", "waiting"];
  return `<div class="decision-row">
    <span class="decision-mark ${tone}"></span>
    <div><strong>${escapeHtml(row.title || row.job_title || "Vaga")}</strong><small>${escapeHtml(row.company || "Empresa")} · ${formatDayMonth(row.received_at)}</small></div>
    <span class="outcome-label ${tone}">${label}</span>
    ${row.action_url ? `<a class="action" href="${escapeHtml(row.action_url)}" target="_blank" rel="noreferrer">E-mail</a>` : ""}
  </div>`;
}

function gmailMessageUrl(row) {
  const direct = String(row.latest_email_url || row.action_url || "").trim();
  if (direct) return direct;
  const messageId = String(row.gmail_message_id || "").trim();
  return messageId ? `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(messageId)}` : "";
}

function applicationReturnState(row) {
  const outcome = String(row.pipeline_outcome || row.latest_event_outcome || "sem_retorno");
  const stage = Number(row.pipeline_stage || 1);
  if (outcome === "negativa" || row.latest_event_type === "rejection") return { id: "negative", label: "Não selecionado", tone: "danger" };
  if (outcome === "positiva" || stage >= 2 || ["advanced", "interview", "offer"].includes(String(row.latest_event_type || ""))) {
    return { id: "positive", label: stage >= 3 ? "Etapa avançada" : "Retorno positivo", tone: "success" };
  }
  return { id: "waiting", label: "Aguardando retorno", tone: "neutral" };
}

function emailEventState(row) {
  const type = String(row.event_type || "other");
  if (row.outcome === "negativa" || type === "rejection") return { id: "negative", label: "Negativo", tone: "danger" };
  if (row.outcome === "positiva" || ["advanced", "interview", "offer"].includes(type)) return { id: "positive", label: type === "offer" ? "Proposta" : type === "interview" ? "Entrevista" : "Positivo", tone: "success" };
  if (Number(row.requires_action || 0) === 1 || type === "action_required") return { id: "action", label: "Ação necessária", tone: "warning" };
  if (type === "confirmation") return { id: "waiting", label: "Candidatura confirmada", tone: "info" };
  if (type === "reviewing") return { id: "waiting", label: "Em análise", tone: "gold" };
  return { id: "waiting", label: "Atualização", tone: "neutral" };
}

function returnApplicationCard(row) {
  const state = applicationReturnState(row);
  const emailUrl = gmailMessageUrl(row);
  const needsAction = Number(row.latest_requires_action || 0) === 1;
  return `<article class="return-card">
    <div class="return-card-head">
      <div><span class="eyebrow">${escapeHtml(sourceName(row))}</span><h3>${escapeHtml(row.title || "Vaga")}</h3><p>${escapeHtml(row.company || "Empresa a confirmar")}</p></div>
      <span class="state-chip ${state.tone}">${escapeHtml(state.label)}</span>
    </div>
    ${metaGrid([
      ["Candidatado", escapeHtml(formatDate(row.applied_at))],
      ["Etapa", `${Number(row.pipeline_stage || 1)}ª fase`],
      ["E-mails", String(row.email_count || 0)],
      ["Último retorno", row.latest_email_at ? escapeHtml(formatDate(row.latest_email_at)) : "Ainda não recebido"]
    ])}
    <div class="return-email-preview ${row.latest_subject ? "" : "empty"}">
      <span>${row.latest_subject ? "Último e-mail" : "Situação atual"}</span>
      <strong>${escapeHtml(row.latest_subject || "Nenhuma resposta vinculada a esta candidatura")}</strong>
      <p>${escapeHtml(shortDescription(row.latest_excerpt || row.recruiter_status || "O Gmail continuará monitorando esta vaga automaticamente.", 360))}</p>
      ${needsAction ? `<small class="return-action-note">${escapeHtml(row.latest_action_summary || row.next_action || "Abra o retorno e conclua a ação solicitada.")}</small>` : ""}
    </div>
    <div class="card-actions">
      ${emailUrl ? `<a class="action primary-link" href="${escapeHtml(emailUrl)}" target="_blank" rel="noreferrer">Abrir e-mail</a>` : ""}
      ${row.url && !isGoogleSearchUrl(row.url) ? `<a class="action" href="${escapeHtml(row.url)}" target="_blank" rel="noreferrer">Abrir vaga</a>` : ""}
      ${row.job_id ? `<button data-detail="${row.job_id}">Detalhes</button>` : ""}
    </div>
  </article>`;
}

function returnHistoryRow(row) {
  const state = emailEventState(row);
  const emailUrl = gmailMessageUrl(row);
  return `<div class="return-history-row">
    <span class="decision-mark ${state.id === "positive" ? "positive" : state.id === "negative" ? "negative" : state.id === "action" ? "needs-action" : "waiting"}"></span>
    <div class="return-history-main">
      <div><strong>${escapeHtml(row.subject || "Atualização da candidatura")}</strong><span class="state-chip ${state.tone}">${escapeHtml(state.label)}</span></div>
      <small>${escapeHtml(row.title || row.job_title || "Vaga")} · ${escapeHtml(row.company || "Empresa")} · ${escapeHtml(formatDate(row.received_at))}</small>
      <p>${escapeHtml(shortDescription(row.excerpt || row.action_summary || "", 420))}</p>
    </div>
    ${emailUrl ? `<a class="action" href="${escapeHtml(emailUrl)}" target="_blank" rel="noreferrer">Abrir e-mail</a>` : ""}
  </div>`;
}

async function returnsPage(initialMessage = "") {
  const [data, gmail] = await Promise.all([json("/api/returns"), json("/api/gmail/status")]);
  const rows = data.applications || [];
  const events = data.events || [];
  const pipeline = data.pipeline || {};
  const sources = [...new Set([...rows, ...events].map(sourceName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const gmailLimited = Boolean(gmail.rateLimited);
  const gmailPillClass = gmailLimited ? "limited" : gmail.connected ? "online" : "offline";
  const gmailPillLabel = gmailLimited ? "conectado · em pausa" : gmail.connected ? "conectado" : "desconectado";

  app.innerHTML = `<section class="page-panel returns-page">
    <div class="page-title-row">
      <div><span class="eyebrow">Retornos</span><h2>Decisões, respostas e próximas ações</h2><p>Todas as candidaturas enviadas aparecem aqui, inclusive as que ainda não receberam resposta. Cada retorno do Gmail abre diretamente no e-mail correspondente.</p></div>
      <div class="toolbar-actions">
        <span class="connection-pill ${gmailPillClass}"><i></i> Gmail ${gmailPillLabel}</span>
        <button id="syncReturnsGmail" class="primary">Atualizar Gmail</button>
      </div>
    </div>
    ${gmailLimited ? `<div class="note"><strong>Gmail conectado.</strong><p>O Google pausou temporariamente novas leituras${gmail.retryAfter ? ` até ${escapeHtml(formatDate(gmail.retryAfter))}` : ""}. O Ápice retomará automaticamente sem exigir novo login.</p></div>` : ""}
    <div id="returnsMessage" class="note ${initialMessage ? "" : "hidden"}">${initialMessage}</div>
    <div class="kpi-grid returns-kpis">
      ${metricCard("Candidaturas", pipeline.actual, "Envios realmente confirmados", "blue")}
      ${metricCard("Retornos positivos", pipeline.selected, "Avanços, entrevistas ou propostas", "success")}
      ${metricCard("Retornos negativos", pipeline.rejected, "Processos encerrados", "danger")}
      ${metricCard("Sem retorno", pipeline.pending, "Monitoramento ativo", "neutral")}
      ${metricCard("Ação necessária", pipeline.actions, "Etapas que dependem de você", "warning")}
      ${metricCard("E-mails classificados", events.length, "Histórico vinculado às vagas", "violet")}
    </div>
    <div class="returns-filter-bar">
      <label>Buscar<input id="returnSearch" placeholder="vaga, empresa, assunto ou fonte"></label>
      <label>Situação<select id="returnOutcome"><option value="all">Todas</option><option value="positive">Positivas</option><option value="negative">Negativas</option><option value="waiting">Sem retorno</option><option value="action">Ação necessária</option></select></label>
      <label>Fonte<select id="returnSource">${optionList(sources, "all", "Todas")}</select></label>
      <label>Etapa<select id="returnStage"><option value="all">Todas</option><option value="1">1ª fase</option><option value="2">2ª fase</option><option value="3">3ª fase ou mais</option></select></label>
    </div>
    <section class="returns-section">
      <div class="section-head"><div><span class="eyebrow">Por vaga</span><h3>Resultado de cada candidatura</h3></div><span id="returnApplicationsCount" class="data-caption"></span></div>
      <div id="returnApplications" class="returns-grid"></div>
    </section>
    <section class="returns-section">
      <div class="section-head"><div><span class="eyebrow">Histórico completo</span><h3>Mensagens classificadas pelo Gmail</h3></div><span id="returnEventsCount" class="data-caption"></span></div>
      <div id="returnHistory" class="return-history"></div>
    </section>
  </section>`;

  const applyReturnFilters = () => {
    const query = document.querySelector("#returnSearch").value.trim().toLowerCase();
    const outcome = document.querySelector("#returnOutcome").value;
    const source = document.querySelector("#returnSource").value;
    const stage = document.querySelector("#returnStage").value;
    const matchesQuery = (row) => !query || [row.title, row.job_title, row.company, row.source, row.latest_subject, row.latest_excerpt, row.subject, row.excerpt].join(" ").toLowerCase().includes(query);
    const visibleRows = rows.filter((row) => {
      const state = applicationReturnState(row);
      if (!matchesQuery(row)) return false;
      if (source !== "all" && sourceName(row) !== source) return false;
      if (outcome === "action" && Number(row.latest_requires_action || 0) !== 1) return false;
      if (outcome !== "all" && outcome !== "action" && state.id !== outcome) return false;
      if (stage !== "all" && (stage === "3" ? Number(row.pipeline_stage || 1) < 3 : Number(row.pipeline_stage || 1) !== Number(stage))) return false;
      return true;
    });
    const visibleEvents = events.filter((row) => {
      const state = emailEventState(row);
      if (!matchesQuery(row)) return false;
      if (source !== "all" && sourceName(row) !== source) return false;
      if (outcome !== "all" && state.id !== outcome) return false;
      if (stage !== "all" && (stage === "3" ? Number(row.pipeline_stage || 1) < 3 : Number(row.pipeline_stage || 1) !== Number(stage))) return false;
      return true;
    });
    document.querySelector("#returnApplicationsCount").textContent = `${visibleRows.length} de ${rows.length}`;
    document.querySelector("#returnEventsCount").textContent = `${visibleEvents.length} de ${events.length}`;
    document.querySelector("#returnApplications").innerHTML = visibleRows.map(returnApplicationCard).join("") || `<div class="empty-state"><h3>Nenhuma candidatura neste filtro</h3><p>Ajuste os filtros ou atualize o Gmail para buscar novos retornos.</p></div>`;
    document.querySelector("#returnHistory").innerHTML = visibleEvents.map(returnHistoryRow).join("") || `<div class="empty-mini">Nenhum e-mail classificado neste filtro.</div>`;
  };

  document.querySelectorAll("#returnSearch, #returnOutcome, #returnSource, #returnStage").forEach((element) => element.addEventListener("input", applyReturnFilters));
  document.querySelector("#syncReturnsGmail").onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Lendo Gmail...";
    try {
      const result = await json("/api/gmail/sync", { method: "POST" });
      toast(`${result.matched} retorno(s) vinculado(s) e ${result.jobsImported || 0} vaga(s) importada(s).`, "success");
      await returnsPage();
    } catch (error) {
      toast(error.message, "error");
      button.disabled = false;
      button.textContent = "Atualizar Gmail";
    }
  };
  protectGmailSyncButton(document.querySelector("#syncReturnsGmail"), gmail, "Atualizar Gmail");
  applyReturnFilters();
}

function metricCard(label, value, detail, tone) {
  return `<div class="metric-card ${tone}"><span>${label}</span><strong>${value ?? 0}</strong><small>${escapeHtml(detail)}</small></div>`;
}

function pipelineStage(label, value, detail) {
  return `<div class="pipeline-stage"><strong>${value ?? 0}</strong><span>${label}</span><small>${detail}</small></div>`;
}

function sourceBar(row, total) {
  const width = Math.max(6, Math.round((Number(row.total) / Math.max(1, Number(total))) * 100));
  return `<div class="source-row"><div><strong>${escapeHtml(row.source)}</strong><span>${row.total} vaga(s)</span></div><div class="bar"><span style="width:${width}%"></span></div></div>`;
}

async function jobs(initialMessage = "") {
  const rows = await json("/api/jobs");
  const filters = getSavedFilters("jobs", { q: "", source: "all", work: "all", status: "all", minScore: 0, salary: false, assisted: "all", hideDuplicates: false });
  const sources = uniqueSources(rows);
  const workModels = uniqueValues(rows, "work_model");
  const statuses = uniqueValues(rows, "status");

  app.innerHTML = `<section class="page-panel">
    <div class="page-title-row">
      <div><span class="eyebrow">Descobrir</span><h2>Vagas alinhadas ao seu perfil</h2><p>Compare as oportunidades e aprove somente as que merecem entrar na sua fila de candidatura.</p></div>
      <div class="toolbar-actions">
        <button id="scanJobs">Buscar novas vagas</button>
        <button id="toggleJobFilters">Filtros</button>
        <button id="selectAllJobs">Selecionar todas</button>
        <button id="approveSelectedJobs" class="primary">Aprovar selecionadas</button>
      </div>
    </div>
    <div id="jobActionResult" class="note ${initialMessage ? "" : "hidden"}">${initialMessage}</div>
    ${jobGuidancePanel(rows)}
    ${realLinkImporter("jobs", () => jobs("<strong>Link real importado.</strong><p>A vaga entrou na análise e pode ser aprovada.</p>"))}
    <div id="jobFilters" class="filter-studio">
      <div class="filter-grid">
        <label>Buscar<input id="jobSearch" value="${escapeHtml(filters.q)}" placeholder="cargo, empresa, cidade, fonte"></label>
        <label>Fonte<select id="jobSource">${optionList(sources, filters.source, "Todas")}</select></label>
        <label>Tipo de trabalho<select id="jobWork">${optionList(workModels, filters.work, "Todos")}</select></label>
        <label>Status<select id="jobStatus">${optionList(statuses, filters.status, "Todos")}</select></label>
        <label>Nota mínima<input id="jobMinScore" type="number" min="0" max="100" value="${Number(filters.minScore || 0)}"></label>
        <label>Tipo de fonte<select id="jobAssisted"><option value="all">Todas</option><option value="real" ${filters.assisted === "real" ? "selected" : ""}>Vagas com fonte direta</option><option value="assisted" ${filters.assisted === "assisted" ? "selected" : ""}>Fontes de busca</option></select></label>
        <label class="check-line"><input id="jobSalary" type="checkbox" ${filters.salary ? "checked" : ""}> Somente com salário</label>
        <label class="check-line"><input id="jobHideDuplicates" type="checkbox" ${filters.hideDuplicates ? "checked" : ""}> Ocultar duplicadas</label>
        <button id="clearJobFilters">Limpar filtros</button>
      </div>
    </div>
    <div id="jobsTableMount"></div>
  </section>`;

  const mount = document.querySelector("#jobsTableMount");
  const readFilters = () => ({
    q: document.querySelector("#jobSearch").value.trim(),
    source: document.querySelector("#jobSource").value,
    work: document.querySelector("#jobWork").value,
    status: document.querySelector("#jobStatus").value,
    minScore: Number(document.querySelector("#jobMinScore").value || 0),
    salary: document.querySelector("#jobSalary").checked,
    assisted: document.querySelector("#jobAssisted").value,
    hideDuplicates: document.querySelector("#jobHideDuplicates").checked
  });
  const applyFilters = () => {
    const active = readFilters();
    saveFilters("jobs", active);
    const visibleRows = rows.filter((row) => {
      if (!includesSearch(row, active.q)) return false;
      if (active.source !== "all" && sourceName(row) !== active.source) return false;
      if (active.work !== "all" && String(row.work_model) !== active.work) return false;
      if (active.status !== "all" && String(row.status) !== active.status) return false;
      if (Number(row.fit_score || 0) < active.minScore) return false;
      if (active.salary && !moneyAwareSalary(row)) return false;
      if (active.assisted === "real" && assistedSources.has(row.source)) return false;
      if (active.assisted === "assisted" && !assistedSources.has(row.source)) return false;
      if (active.hideDuplicates && Number(row.duplicate_count || 0) > 1) return false;
      return true;
    });
    const empty = rows.length
      ? `<div class="empty-state"><h3>Nenhuma vaga bate com os filtros</h3><p>Ajuste filtros ou rode uma nova busca.</p><button id="scanJobsEmpty" class="primary">Buscar vagas</button></div>`
      : `<div class="empty-state"><h3>Nenhuma vaga nova na fila</h3><p>Clique em Buscar vagas para renovar o radar. Depois, use o filtro Tipo de fonte para ver apenas vagas com fonte direta; se aparecer uma página de busca, abra a fonte e importe o link real da vaga individual.</p><button id="scanJobsEmpty" class="primary">Buscar vagas</button></div>`;
    mount.innerHTML = `<div class="table-meta"><strong>${visibleRows.length}</strong><span>vaga(s) exibida(s)</span><span>${groupRowsBySource(visibleRows).length} fonte(s)</span></div>${visibleRows.length ? renderGroupedCards(visibleRows, jobCard, "vaga") : empty}`;
    const emptyScan = document.querySelector("#scanJobsEmpty");
    if (emptyScan) emptyScan.onclick = () => runScanAndRefresh("jobs");
  };

  document.querySelector("#scanJobs").onclick = () => runScanAndRefresh("jobs");
  bindRealLinkImporter("jobs", () => jobs("<strong>Link real importado.</strong><p>A vaga entrou na análise e pode ser aprovada.</p>"));
  document.querySelector("#toggleJobFilters").onclick = () => document.querySelector("#jobFilters").classList.toggle("collapsed");
  document.querySelector("#selectAllJobs").onclick = () => document.querySelectorAll(".job-check").forEach((input) => input.checked = true);
  document.querySelector("#clearJobFilters").onclick = () => {
    localStorage.removeItem(filterKey("jobs"));
    jobs(initialMessage);
  };
  document.querySelectorAll("#jobFilters input, #jobFilters select").forEach((element) => element.addEventListener("input", applyFilters));
  const selectedJobIds = () => [...document.querySelectorAll(".job-check:checked")].map((input) => Number(input.value));
  const approveSelectedJobs = async () => {
    const ids = selectedJobIds();
    if (!ids.length) return showInlineResult("#jobActionResult", "Selecione pelo menos uma vaga para continuar.");
    const data = await json("/api/jobs/approve-selected", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    const skipped = (data.skipped || []).map((item) => `<li>#${item.id}: ${escapeHtml(item.reason)}</li>`).join("");
    const message = `<strong>${data.approved} vaga(s) aprovada(s).</strong>${skipped ? `<ul>${skipped}</ul>` : ""}<p>Elas estão em Candidaturas aguardando sua autorização. Nenhuma inscrição foi iniciada ainda.</p>`;
    toast("Vagas aprovadas e movidas para autorização.", "success");
    currentTab = "applications";
    document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === "applications"));
    await applications(message);
  };
  document.querySelector("#approveSelectedJobs").onclick = approveSelectedJobs;
  applyFilters();
}

function showInlineResult(selector, message) {
  const result = document.querySelector(selector);
  result.classList.remove("hidden");
  result.innerHTML = message;
}

function renderAutomationResult(data) {
  const actions = data.actions || [];
  const statusTone = (status) => {
    if (["autofill_pronto", "auto_apply_pronto", "linkedin_assistido"].includes(status)) return "ready";
    if (["precisa_informacao", "precisa_canal", "precisa_vaga_real", "bloqueada", "linkedin_manual"].includes(status)) return "warning";
    return "info";
  };
  const missingBlocks = actions
    .filter((action) => Array.isArray(action.questions) && action.questions.length)
    .map((action) => `<div class="memory-capture" data-profile-id="${action.profileId}">
      <h4>Candidatura #${action.id}: faltam dados</h4>
      <p>${escapeHtml(action.message)}</p>
      <div class="form-grid">${action.questions.map((question) => `<label>${escapeHtml(question.question)}
        <input data-memory-key="${escapeHtml(question.key)}" data-memory-question="${escapeHtml(question.question)}" data-memory-category="${escapeHtml(question.category)}" data-memory-field-type="${escapeHtml(question.fieldType)}">
      </label>`).join("")}</div>
      <button data-save-memory class="primary">Salvar respostas na memória</button>
    </div>`)
    .join("");
  const fieldBlocks = actions
    .filter((action) => action.filledFields && Object.keys(action.filledFields).length)
    .map((action) => {
      const fields = Object.entries(action.filledFields || {}).filter(([, value]) => String(value || "").trim());
      const autofill = buildAutofillBookmarklet(Object.fromEntries(fields));
      return `<div class="autofill-pack">
        <div class="section-head">
          <div><strong>Preenchimento inteligente #${escapeHtml(action.id || "")}</strong><small>Dados reais do perfil, prontos para o formulário oficial.</small></div>
          <div class="card-actions">
            <button data-copy-autofill="${escapeHtml(autofill)}">Copiar comando</button>
            <a data-autofill-bookmarklet class="action primary-link" href="${escapeHtml(autofill)}" title="Arraste para a barra de favoritos">Arraste: Preencher com Ápice</a>
          </div>
        </div>
        <div class="autofill-guide"><strong>Como executar</strong><span>1. Arraste o botão para a barra de favoritos.</span><span>2. Abra a vaga oficial ou o Easy Apply.</span><span>3. Clique em “Preencher com Ápice” e revise os campos destacados.</span></div>
        <div class="field-copy-grid">${fields.map(([key, value]) => `<div class="field-copy-item">
          <span>${escapeHtml(key)}</span>
          <strong>${escapeHtml(value)}</strong>
          <button data-copy-value="${escapeHtml(value)}">Copiar</button>
        </div>`).join("")}</div>
      </div>`;
    })
    .join("");
  const lines = actions.map((action) => `<li>
    <strong>#${action.id}</strong>
    <span class="state-chip ${statusTone(action.status)}">${escapeHtml(action.status)}</span>
    ${escapeHtml(action.message)}
    <small>${escapeHtml(action.nextStep || "")}</small>
    ${action.url ? `<a href="${escapeHtml(action.url)}" target="_blank" rel="noreferrer">abrir fonte</a> <button data-accelerate-url="${escapeHtml(action.url)}" data-accelerate-title="${escapeHtml(action.title || "")}" data-accelerate-company="${escapeHtml(action.company || "")}" data-accelerate-application-id="${escapeHtml(action.id || "")}">Abrir na IA</button>` : ""}
  </li>`).join("");
  const ids = actions.map((action) => Number(action.id)).filter(Boolean);
  return `<strong>${escapeHtml(data.modeLabel || "Preparação por IA concluída")} para ${escapeHtml(data.profile?.name || "perfil ativo")}</strong><ul>${lines}</ul>${fieldBlocks}${markSentButton(ids, "Marcar selecionadas como enviadas")}${missingBlocks}`;
}

function setAiApplyPrefill(data) {
  aiApplyPrefill = {
    url: String(data?.url || "").trim(),
    title: String(data?.title || "").trim(),
    company: String(data?.company || "").trim(),
    applicationId: Number(data?.applicationId || 0),
    autoLoad: Boolean(data?.autoLoad),
    autoPrepare: Boolean(data?.autoPrepare)
  };
}

function openOfficialJob(url) {
  const value = String(url || "").trim();
  if (!value || isGoogleSearchUrl(value)) return false;
  try {
    const parsed = new URL(value);
    if (!/^https?:$/.test(parsed.protocol)) return false;
  } catch {
    return false;
  }
  window.open(value, "_blank", "noopener,noreferrer");
  return true;
}

function buildAiApplyBookmarklet() {
  const target = `${window.location.origin}/?aiUrl=`;
  return `javascript:(()=>{const u=encodeURIComponent(location.href);const t=encodeURIComponent(document.title||'');window.open('${target}'+u+'&aiTitle='+t+'&aiSource=bookmarklet','_blank','noopener');})()`;
}

function buildLegacyAutofillBookmarklet(fields) {
  const payload = encodeURIComponent(JSON.stringify(fields));
  return `javascript:(()=>{const f=JSON.parse(decodeURIComponent('${payload}'));const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');const aliases={'Nome completo':['nome','name','full name','nome completo'],'E-mail':['email','e-mail','mail'],'Telefone':['telefone','phone','celular','whatsapp','mobile'],'LinkedIn':['linkedin','linked in'],'Cidade':['cidade','city'],'Estado':['estado','uf','state'],'País':['pais','country'],'Resumo profissional':['resumo','summary','sobre','objetivo','cover','apresentacao'],'Pretensão salarial':['salario','salary','pretensao','remuneracao'],'Disponibilidade':['disponibilidade','availability','inicio','start']};const labelFor=e=>{let t=[e.name,e.id,e.placeholder,e.getAttribute('aria-label')].join(' ');const id=e.id;if(id){const l=document.querySelector('label[for=\"'+CSS.escape(id)+'\"]');if(l)t+=' '+l.innerText}const p=e.closest('label');if(p)t+=' '+p.innerText;return norm(t)};let n=0;document.querySelectorAll('input,textarea,select').forEach(e=>{const text=labelFor(e);for(const [k,v] of Object.entries(f)){if(!v)continue;const keys=[k,...(aliases[k]||[])].map(norm);if(keys.some(a=>a&&text.includes(a))){if(e.tagName==='SELECT'){[...e.options].some(o=>{if(norm(o.text).includes(norm(v))||norm(o.value).includes(norm(v))){e.value=o.value;return true}return false})}else if(['checkbox','radio','file','submit','button','hidden'].includes(e.type)){}else{e.value=v}e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));e.style.outline='3px solid #55c29a';n++;break}}});alert('Career Hunter preencheu '+n+' campo(s). Revise antes de enviar.');})()`;
}

function buildAutofillBookmarklet(fields) {
  const payload = encodeURIComponent(JSON.stringify(fields));
  const aliases = {
    "Nome completo": ["nome", "name", "full name", "nome completo"],
    "E-mail": ["email", "e-mail", "mail"],
    "Telefone": ["telefone", "phone", "celular", "whatsapp", "mobile"],
    LinkedIn: ["linkedin", "linked in"],
    Cidade: ["cidade", "city"],
    Estado: ["estado", "uf", "state"],
    País: ["pais", "country"],
    "Resumo profissional": ["resumo", "summary", "sobre", "objetivo", "cover", "apresentacao"],
    "Pretensão salarial": ["salario", "salary", "pretensao", "remuneracao"],
    Disponibilidade: ["disponibilidade", "availability", "inicio", "start"],
    "Disponibilidade de horário": ["horario", "schedule", "turno", "escala"],
    CPF: ["cpf", "documento fiscal"],
    RG: ["rg", "identidade"],
    "Data de nascimento": ["nascimento", "birth date", "birthday"],
    "Estado civil": ["estado civil", "marital status"],
    Endereço: ["endereco", "address", "logradouro", "rua"],
    Número: ["numero", "number"],
    Complemento: ["complemento", "complement", "apto", "apartamento"],
    Bairro: ["bairro", "district", "neighborhood"],
    CEP: ["cep", "postal code", "zip code"],
    "Meio de transporte": ["transporte", "transport", "locomocao"],
    Inglês: ["ingles", "english"]
  };
  const aliasesPayload = encodeURIComponent(JSON.stringify(aliases));
  return `javascript:(()=>{const f=JSON.parse(decodeURIComponent('${payload}'));const a=JSON.parse(decodeURIComponent('${aliasesPayload}'));const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');const labelFor=e=>{let t=[e.name,e.id,e.placeholder,e.getAttribute('aria-label')].join(' ');if(e.id){const l=document.querySelector('label[for="'+CSS.escape(e.id)+'"]');if(l)t+=' '+l.innerText}const p=e.closest('label');if(p)t+=' '+p.innerText;return norm(t)};const setValue=(e,v)=>{if(e.tagName==='SELECT'){const o=[...e.options].find(x=>norm(x.text).includes(norm(v))||norm(x.value).includes(norm(v)));if(o)e.value=o.value;return Boolean(o)}if(['checkbox','radio','file','submit','button','hidden'].includes(e.type))return false;const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;if(setter)setter.call(e,v);else e.value=v;return true};let n=0;document.querySelectorAll('input,textarea,select').forEach(e=>{const text=labelFor(e);for(const [k,v] of Object.entries(f)){if(!v)continue;const keys=[k,...(a[k]||[])].map(norm);if(keys.some(x=>x&&text.includes(x))&&setValue(e,v)){e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));e.style.outline='3px solid #55c29a';n++;break}}});alert('Ápice preencheu '+n+' campo(s). Revise os campos destacados antes de enviar.');})()`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

function markSentButton(ids, label = "Já me candidatei") {
  const clean = (Array.isArray(ids) ? ids : [ids]).map(Number).filter(Boolean);
  return clean.length ? `<button class="primary" data-mark-sent="${clean.join(",")}">${escapeHtml(label)}</button>` : "";
}

function applicationGuidance(row) {
  if (row.source === "google-assisted-search" || isGoogleSearchUrl(row.url)) return "Esta entrada veio de uma pesquisa do Google. Use apenas o link final da vaga encontrada no resultado, não a página de pesquisa.";
  if (row.source === "linkedin-search") return "Este link abre a busca direta no LinkedIn Jobs. Abra a vaga individual no LinkedIn e candidate-se pela sua conta; para o agente acompanhar, importe o link específico da vaga.";
  if (assistedSources.has(row.source)) return "Esta entrada é uma fonte de busca, não uma candidatura real. Abra o link, escolha uma vaga específica e importe o link oficial pelo painel.";
  if (hasDirectJobUrl(row)) return `Abra o link oficial da fonte (${row.source}) e revise os dados antes do envio.`;
  if (row.source === "companyHunter") return "Prospecção ativa sem link. Pesquise a página Trabalhe Conosco, contato de RH ou e-mail oficial da empresa.";
  if (String(row.source).includes("whatsapp")) return "Sem link no WhatsApp. Peça empresa, local, horário, remuneração, responsável e forma oficial de candidatura.";
  return "Sem link encontrado. Confirme a fonte original antes de enviar dados pessoais.";
}

async function jobDetail(id, returnTab = currentTab || "jobs") {
  const row = await json(`/api/jobs/${id}`);
  app.innerHTML = `<section class="detail-page">
    <div class="page-title-row">
      <div><button data-tab="${escapeHtml(returnTab)}">Voltar</button><span class="eyebrow">Detalhe da vaga</span><h2>${escapeHtml(row.title)}</h2><p>${escapeHtml(row.company || "Empresa a confirmar")}</p></div>
      <div class="toolbar-actions">
        ${hasDirectJobUrl(row) ? `<a class="action primary-link" href="${escapeHtml(row.url)}" target="_blank" rel="noreferrer">Abrir fonte</a>${aiAccelerateButton(row)}` : isAssistedSource(row.source) && hasUsableJobUrl(row) ? `<a class="action" href="${escapeHtml(row.url)}" target="_blank" rel="noreferrer">Buscar no ${escapeHtml(sourceName(row))}</a>` : ""}
      </div>
    </div>
    <div class="kpi-grid compact">
      ${metricCard("Fit", row.fit_score, row.fit_reason || "A confirmar", "accent")}
      ${metricCard("Chance", row.hire_chance_score, row.hire_chance_reason || "A confirmar", "blue")}
      ${metricCard("Qualidade", row.job_quality_score, row.status || "Sem status", "gold")}
      ${metricCard("Risco", row.risk_score, row.risk_flags || "Sem alerta", Number(row.risk_score) >= 60 ? "warning" : "ready")}
    </div>
    <div class="two-column">
      <section>
        <h3>Informações principais</h3>
        <div class="profile-grid">
          <div><span>Salário</span><strong>${escapeHtml(row.salary || "Não informado")}</strong></div>
          <div><span>Local</span><strong>${escapeHtml(row.location || "A confirmar")}</strong></div>
          <div><span>Modelo</span><strong>${escapeHtml(row.work_model || "A confirmar")}</strong></div>
          <div><span>Fonte</span><strong>${escapeHtml(sourceName(row))}</strong></div>
          <div><span>Nível</span><strong>${escapeHtml(row.seniority_level || "A confirmar")}</strong></div>
          <div><span>Escolaridade</span><strong>${escapeHtml(row.education_required || "Não informada")}</strong></div>
        </div>
        <h3>Como saber mais ou se candidatar</h3>
        <p>${applicationGuidance(row)}</p>
      </section>
      <section>
        <h3>Descrição</h3>
        <pre>${escapeHtml(row.description || "Sem descrição.")}</pre>
      </section>
    </div>
  </section>`;
}

async function approved(initialMessage = "") {
  const allRows = await json("/api/applications");
  const rows = allRows.filter(isApprovedApplication);
  const filters = getSavedFilters("approved", { q: "", source: "all", work: "all", minScore: 0, channel: "all" });
  const sources = uniqueSources(rows);
  const workModels = uniqueValues(rows, "work_model");
  const labels = {
    all: "Todas",
    ia: "Candidatura por IA",
    manual: "Eu faço sozinho",
    email: "E-mail",
    whatsapp: "WhatsApp",
    telefone: "Telefone",
    precisa_link: "Precisa link real",
    dados: "Faltam dados"
  };

  app.innerHTML = `<section class="page-panel">
    <div class="page-title-row">
      <div><span class="eyebrow">Aprovadas</span><h2>Candidatar-se</h2><p>Vagas que você aprovou. Separe o que você faz sozinho do que a IA pode preparar por você.</p></div>
      <div class="toolbar-actions">
        <button id="toggleApprovedFilters">Filtros</button>
        <button id="selectAllApproved">Selecionar todas</button>
        <button id="clearApproved">Limpar</button>
        <button id="aiApplyApproved" class="primary">Candidatar com IA</button>
        <button id="markApprovedSent">Marcar enviada</button>
      </div>
    </div>
    <div id="approvedActionResult" class="note ${initialMessage ? "" : "hidden"}">${initialMessage}</div>
    <div class="stage-tabs" id="approvedStageTabs">
      ${Object.entries(labels).map(([id, label]) => `<button data-approved-channel="${id}" class="${filters.channel === id ? "active" : ""}">${escapeHtml(label)}</button>`).join("")}
    </div>
    <div id="approvedFilters" class="filter-studio collapsed">
      <div class="filter-grid">
        <label>Buscar<input id="approvedSearch" value="${escapeHtml(filters.q)}" placeholder="vaga, empresa, fonte, local"></label>
        <label>Fonte<select id="approvedSource">${optionList(sources, filters.source, "Todas")}</select></label>
        <label>Tipo de trabalho<select id="approvedWork">${optionList(workModels, filters.work, "Todos")}</select></label>
        <label>Nota mínima<input id="approvedMinScore" type="number" min="0" max="100" value="${Number(filters.minScore || 0)}"></label>
        <button id="clearApprovedFilters">Limpar filtros</button>
      </div>
    </div>
    <div id="approvedMount"></div>
  </section>`;

  const mount = document.querySelector("#approvedMount");
  const readFilters = () => ({
    q: document.querySelector("#approvedSearch").value.trim(),
    source: document.querySelector("#approvedSource").value,
    work: document.querySelector("#approvedWork").value,
    minScore: Number(document.querySelector("#approvedMinScore").value || 0),
    channel: document.querySelector("#approvedStageTabs button.active")?.dataset.approvedChannel || "all"
  });
  const applyFilters = () => {
    const active = readFilters();
    saveFilters("approved", active);
    const visibleRows = rows.filter((row) => {
      const channel = applicationChannel(row).id;
      if (!includesSearch(row, active.q)) return false;
      if (active.source !== "all" && sourceName(row) !== active.source) return false;
      if (active.work !== "all" && String(row.work_model) !== active.work) return false;
      if (Number(row.fit_score || 0) < active.minScore) return false;
      if (active.channel !== "all" && channel !== active.channel) return false;
      return true;
    });
    const counters = rows.reduce((acc, row) => {
      const id = applicationChannel(row).id;
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {});
    const empty = `<div class="empty-state"><h3>Nenhuma vaga aprovada nesta etapa</h3><p>Volte em Vagas, selecione as oportunidades que fazem sentido e clique em Aprovar selecionadas.</p><button data-tab="jobs" class="primary">Ver vagas</button></div>`;
    mount.innerHTML = `<div class="table-meta"><strong>${visibleRows.length}</strong><span>aprovada(s) exibida(s)</span><span>${groupRowsBySource(visibleRows).length} fonte(s)</span><span>IA: ${counters.ia || 0}</span><span>Você faz: ${counters.manual || 0}</span><span>E-mail/WhatsApp/Telefone: ${(counters.email || 0) + (counters.whatsapp || 0) + (counters.telefone || 0)}</span></div>${visibleRows.length ? renderGroupedCards(visibleRows, (row) => applicationCard(row, "approved"), "vaga aprovada") : empty}`;
  };

  const selectedIds = () => [...document.querySelectorAll(".application-check:checked")].map((input) => Number(input.value));
  const postSelection = async (url, successBuilder) => {
    const ids = selectedIds();
    if (!ids.length) return showInlineResult("#approvedActionResult", "Selecione pelo menos uma vaga aprovada.");
    const data = await json(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    const message = successBuilder(data);
    showInlineResult("#approvedActionResult", message);
    toast("Ação registrada.", "success");
    await approved(message);
  };

  document.querySelector("#toggleApprovedFilters").onclick = () => document.querySelector("#approvedFilters").classList.toggle("collapsed");
  document.querySelector("#selectAllApproved").onclick = () => document.querySelectorAll(".application-check").forEach((input) => input.checked = true);
  document.querySelector("#clearApproved").onclick = () => document.querySelectorAll(".application-check").forEach((input) => input.checked = false);
  document.querySelector("#clearApprovedFilters").onclick = () => {
    localStorage.removeItem(filterKey("approved"));
    approved(initialMessage);
  };
  document.querySelectorAll("#approvedFilters input, #approvedFilters select").forEach((element) => element.addEventListener("input", applyFilters));
  document.querySelectorAll("[data-approved-channel]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-approved-channel]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    applyFilters();
  }));
  document.querySelector("#aiApplyApproved").onclick = () => postSelection("/api/applications/ai-apply", renderAutomationResult);
  document.querySelector("#markApprovedSent").onclick = () => postSelection("/api/applications/mark-sent", (data) => `<strong>${data.sent} candidatura(s) marcada(s) como enviadas.</strong><p>Elas foram para a aba Candidaturas.</p>`);
  applyFilters();
}

async function applications(initialMessage = "") {
  const allRows = await json("/api/applications");
  const rows = allRows;
  const filters = getSavedFilters("applications", { q: "", source: "all", work: "all", availability: "all", minScore: 0, stage: "authorization" });
  const sources = uniqueSources(rows);
  const workModels = uniqueValues(rows, "work_model");
  const stages = {
    all: "Todas",
    authorization: "Aguardando autorização",
    processing: "IA em preparação",
    sent: "Candidatadas",
    attention: "Precisam de atenção"
  };

  app.innerHTML = `<section class="page-panel">
    <div class="page-title-row">
      <div><span class="eyebrow">Executar e acompanhar</span><h2>Suas candidaturas em uma única fila</h2><p>Aprovação escolhe a vaga. Autorização libera a IA. Somente um envio confirmado entra no histórico.</p></div>
      <div class="toolbar-actions">
        <button id="toggleApplicationFilters">Filtros</button>
        <button id="selectAllApplications">Selecionar todas</button>
        <button id="authorizeApplications" class="primary">Autorizar selecionadas</button>
        <button id="checkAvailability">Verificar disponibilidade</button>
      </div>
    </div>
    <div id="applicationActionResult" class="note ${initialMessage ? "" : "hidden"}">${initialMessage}</div>
    <div class="authorization-note"><strong>Você mantém o controle.</strong><span>A IA não inicia uma vaga aprovada até você clicar em Autorizar. CAPTCHA, login e confirmação exigidos pelo site continuam visíveis para você.</span></div>
    <div class="stage-tabs" id="applicationStageTabs">
      ${Object.entries(stages).map(([id, label]) => `<button data-application-stage="${id}" class="${filters.stage === id ? "active" : ""}">${escapeHtml(label)}</button>`).join("")}
    </div>
    <div id="applicationFilters" class="filter-studio collapsed">
      <div class="filter-grid">
        <label>Buscar<input id="applicationSearch" value="${escapeHtml(filters.q)}" placeholder="vaga, empresa, fonte, status"></label>
        <label>Fonte<select id="applicationSource">${optionList(sources, filters.source, "Todas")}</select></label>
        <label>Tipo de trabalho<select id="applicationWork">${optionList(workModels, filters.work, "Todos")}</select></label>
        <label>Disponibilidade<select id="applicationAvailability"><option value="all">Todas</option><option value="aberta" ${filters.availability === "aberta" ? "selected" : ""}>Aberta</option><option value="fechada" ${filters.availability === "fechada" ? "selected" : ""}>Fechada</option><option value="indefinida" ${filters.availability === "indefinida" ? "selected" : ""}>Indefinida</option><option value="nao_verificado" ${filters.availability === "nao_verificado" ? "selected" : ""}>Não verificada</option></select></label>
        <label>Nota mínima<input id="applicationMinScore" type="number" min="0" max="100" value="${Number(filters.minScore || 0)}"></label>
        <button id="clearApplicationFilters">Limpar filtros</button>
      </div>
    </div>
    <div id="applicationsTableMount"></div>
  </section>`;

  const mount = document.querySelector("#applicationsTableMount");
  const readFilters = () => ({
    q: document.querySelector("#applicationSearch").value.trim(),
    source: document.querySelector("#applicationSource").value,
    work: document.querySelector("#applicationWork").value,
    availability: document.querySelector("#applicationAvailability").value,
    minScore: Number(document.querySelector("#applicationMinScore").value || 0),
    stage: document.querySelector("#applicationStageTabs button.active")?.dataset.applicationStage || "all"
  });
  const applyFilters = () => {
    const active = readFilters();
    saveFilters("applications", active);
    document.querySelector("#authorizeApplications").disabled = !["all", "authorization"].includes(active.stage);
    const visibleRows = rows.filter((row) => {
      const availability = String(row.availability_status || "nao_verificado");
      const sent = isSentApplication(row);
      if (!includesSearch(row, active.q)) return false;
      if (active.source !== "all" && sourceName(row) !== active.source) return false;
      if (active.work !== "all" && String(row.work_model) !== active.work) return false;
      if (active.availability !== "all" && availability !== active.availability) return false;
      if (Number(row.fit_score || 0) < active.minScore) return false;
      const outcome = String(row.pipeline_outcome || "sem_retorno");
      const pipelineStage = Number(row.pipeline_stage || 1);
      const authorized = isAuthorizedApplication(row);
      const needsAttention = Boolean(String(row.next_action || "").trim()) || row.application_status === "Aguardando resposta do usuário" || String(row.authorization_status || "") === "requer_canal";
      if (active.stage === "authorization" && !isAwaitingAuthorization(row)) return false;
      if (active.stage === "processing" && (sent || !authorized)) return false;
      if (active.stage === "sent" && !sent) return false;
      if (active.stage === "attention" && !needsAttention) return false;
      return true;
    });
    const counters = rows.reduce((acc, row) => {
      const sent = isSentApplication(row);
      const outcome = String(row.pipeline_outcome || "sem_retorno");
      const pipelineStage = Number(row.pipeline_stage || 1);
      if (!sent) {
        const needsAttention = Boolean(String(row.next_action || "").trim()) || row.application_status === "Aguardando resposta do usuário" || String(row.authorization_status || "") === "requer_canal";
        if (needsAttention) acc.attention = (acc.attention || 0) + 1;
        else if (isAwaitingAuthorization(row) || isAuthorizedApplication(row)) {
          const key = isAuthorizedApplication(row) ? "processing" : "authorization";
          acc[key] = (acc[key] || 0) + 1;
        }
        return acc;
      }
      acc.sent = (acc.sent || 0) + 1;
      const key = outcome === "negativa" ? "rejected" : pipelineStage >= 2 ? "selected" : "waiting";
      acc[key] = (acc[key] || 0) + 1;
      if (String(row.next_action || "").trim()) acc.action = (acc.action || 0) + 1;
      return acc;
    }, {});
    const empty = `<div class="empty-state"><h3>Nenhuma candidatura nesta etapa</h3><p>Volte a Vagas, selecione oportunidades e escolha como deseja se candidatar.</p><button data-tab="jobs" class="primary">Ver vagas</button></div>`;
    mount.innerHTML = `<div class="table-meta"><strong>${visibleRows.length}</strong><span>exibida(s)</span><span>${counters.authorization || 0} aguardando autorização</span><span>${counters.processing || 0} com IA liberada</span><span>${counters.sent || 0} candidatadas</span><span>${counters.attention || 0} precisam de atenção</span></div>${visibleRows.length ? renderGroupedCards(visibleRows, (row) => applicationCard(row, isSentApplication(row) ? "sent" : "approved"), "candidatura") : empty}`;
  };

  const selectedIds = () => [...document.querySelectorAll(".application-check:checked")].map((input) => Number(input.value));
  const postApplications = async (url, successBuilder) => {
    const ids = selectedIds();
    if (!ids.length) return showInlineResult("#applicationActionResult", "Selecione pelo menos uma candidatura para continuar.");
    const data = await json(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    const message = successBuilder(data);
    toast("Ação registrada.", "success");
    await applications(message);
  };
  document.querySelector("#toggleApplicationFilters").onclick = () => document.querySelector("#applicationFilters").classList.toggle("collapsed");
  document.querySelector("#selectAllApplications").onclick = () => document.querySelectorAll(".application-check").forEach((input) => input.checked = true);
  document.querySelector("#clearApplicationFilters").onclick = () => {
    localStorage.removeItem(filterKey("applications"));
    applications(initialMessage);
  };
  document.querySelectorAll("#applicationFilters input, #applicationFilters select").forEach((element) => element.addEventListener("input", applyFilters));
  document.querySelectorAll("[data-application-stage]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-application-stage]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    applyFilters();
  }));
  document.querySelector("#authorizeApplications").onclick = () => postApplications("/api/applications/authorize", (data) => `<strong>${data.authorized} candidatura(s) autorizada(s).</strong><p>A IA preparou o próximo passo permitido para cada fonte.</p>${renderAutomationResult(data)}`);
  document.querySelector("#checkAvailability").onclick = async () => {
    const ids = selectedIds();
    const data = await json("/api/applications/check-availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
    const message = `<strong>${data.checked} vaga(s) verificadas.</strong><p>Abertas: ${data.open}. Fechadas: ${data.closed}. Indefinidas: ${data.unknown}.</p>`;
    toast("Disponibilidade verificada.", "success");
    await applications(message);
  };
  applyFilters();
}

async function actionsPage() {
  const data = await json("/api/actions");
  const filters = getSavedFilters("actions", { q: "", type: "all" });
  const types = [...new Set(data.actions.map((item) => item.label).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  app.innerHTML = `<section class="page-panel">
    <div class="page-title-row">
      <div><span class="eyebrow">Próximas ações</span><h2>O que preciso fazer agora</h2><p>Cada card mostra uma pendência objetiva: dados faltantes, candidatura manual, e-mail, WhatsApp ou acompanhamento.</p></div>
      <div class="toolbar-actions">
        <button data-tab="jobs">Vagas</button>
        <button data-tab="applications" class="primary">Candidaturas</button>
      </div>
    </div>
    <div class="filter-studio">
      <div class="filter-grid">
        <label>Buscar<input id="actionSearch" value="${escapeHtml(filters.q)}" placeholder="vaga, empresa ou próxima etapa"></label>
        <label>Tipo<select id="actionType">${optionList(types, filters.type, "Todos")}</select></label>
        <button id="clearActionFilters">Limpar filtros</button>
      </div>
    </div>
    <div class="kpi-grid compact">
      ${metricCard("Ações", data.actions.length, "pendências e próximos passos", "blue")}
      ${metricCard("Alta prioridade", data.actions.filter((item) => item.priority === "alta").length, "precisam de decisão", "warning")}
      ${metricCard("Candidatura por IA", data.actions.filter((item) => item.type === "ia").length, "podem ser preparadas", "success")}
      ${metricCard("Manual", data.actions.filter((item) => item.type === "manual").length, "você conclui no site", "gold")}
    </div>
    <div id="actionMount"></div>
  </section>`;

  const renderActions = () => {
    const active = { q: document.querySelector("#actionSearch").value.trim(), type: document.querySelector("#actionType").value };
    saveFilters("actions", active);
    const visible = data.actions.filter((item) => {
      const text = [item.title, item.message, item.nextStep, item.label].join(" ").toLowerCase();
      return (!active.q || text.includes(active.q.toLowerCase())) && (active.type === "all" || item.label === active.type);
    });
    document.querySelector("#actionMount").innerHTML = visible.length
      ? `<div class="table-meta"><strong>${visible.length}</strong><span>ação(ões) exibida(s)</span></div><div class="action-grid">${visible.map(actionCard).join("")}</div>`
      : `<div class="empty-state"><h3>Nenhuma ação encontrada</h3><p>Ajuste os filtros ou busque novas vagas.</p><button data-tab="jobs" class="primary">Ver vagas</button></div>`;
  };
  document.querySelector("#actionSearch").addEventListener("input", renderActions);
  document.querySelector("#actionType").addEventListener("change", renderActions);
  document.querySelector("#clearActionFilters").onclick = () => {
    localStorage.removeItem(filterKey("actions"));
    actionsPage();
  };
  renderActions();
}

function accountPresets() {
  return [
    ["infojobs", "InfoJobs", "https://www.infojobs.com.br/"],
    ["vagascom", "Vagas.com", "https://www.vagas.com.br/"],
    ["gupy", "Gupy", "https://login.gupy.io/"],
    ["catho", "Catho", "https://www.catho.com.br/"],
    ["sine", "SINE", "https://www.sine.com.br/"],
    ["linkedin", "LinkedIn", "https://www.linkedin.com/jobs/"],
    ["indeed", "Indeed", "https://br.indeed.com/"],
    ["netvagas", "NetVagas", "https://www.netvagas.com.br/"],
    ["bne", "BNE", "https://www.bne.com.br/"],
    ["custom", "Outro site", ""]
  ];
}

async function accountsPage() {
  const data = await json("/api/connected-accounts");
  const presets = accountPresets();
  const existingPlatforms = new Set((data.accounts || []).map((account) => account.platform));
  app.innerHTML = `<section class="page-panel">
    <div class="page-title-row">
      <div><span class="eyebrow">Agências Conectadas</span><h2>Portais, RHs e sites de vagas</h2><p>Guarde acesso aos portais que você usa. O agente usa isso como central segura de login assistido e busca, sem expor sua senha na tela.</p></div>
      <div class="toolbar-actions">
        <button data-tab="aiApply" class="primary">IA Candidatura</button>
        <button data-tab="profile">Meu Perfil</button>
      </div>
    </div>
    <div class="note">
      <strong>${data.vaultReady ? "Cofre ativo" : "Cofre pendente"}</strong>
      <p>${data.vaultReady ? "Senhas novas serão criptografadas antes de salvar." : "Configure ACCOUNT_VAULT_KEY no Render para salvar senhas em produção."} O agente não envia login nem senha para sites externos sem sua ação.</p>
    </div>
    <div class="two-column">
      <section>
        <div class="section-head"><div><span class="eyebrow">Cadastrar agência</span><h3>Portal de vagas</h3></div></div>
        <div class="form-grid single">
          <label>Site<select id="accountPlatform">${presets.map(([id, label]) => `<option value="${id}">${label}${existingPlatforms.has(id) ? " · atualizar" : ""}</option>`).join("")}</select></label>
          <label>Nome visível<input id="accountDisplayName" placeholder="InfoJobs principal"></label>
          <label>URL de login<input id="accountLoginUrl" placeholder="https://site.com/login"></label>
          <label>Usuário/e-mail<input id="accountUsername" autocomplete="username"></label>
          <label>Senha<input id="accountPassword" type="password" autocomplete="new-password" placeholder="Deixe vazio para manter a senha atual"></label>
          <label class="field-wide">Observações<textarea id="accountNotes" rows="4" placeholder="Ex.: usar currículo comercial, telefone confirmado, preferência por Curitiba"></textarea></label>
          <button id="saveAccount" class="primary">Salvar conta</button>
        </div>
      </section>
      <section>
        <div class="section-head"><div><span class="eyebrow">Conectadas</span><h3>${(data.accounts || []).length} agência(s)</h3></div></div>
        <div class="profile-card-grid">${(data.accounts || []).map((account) => `<article class="profile-card account-card">
          <div class="section-head">
            <div><strong>${escapeHtml(account.display_name || sourceName(account.platform))}</strong><small>${escapeHtml(account.username || "usuário não informado")}</small></div>
            <span class="state-chip ${Number(account.has_secret) ? "success" : "warning"}">${Number(account.has_secret) ? "Senha salva" : "Sem senha"}</span>
          </div>
          <div class="profile-grid compact">
            <div><span>Site</span><strong>${escapeHtml(sourceName(account.platform))}</strong></div>
            <div><span>Status</span><strong>${escapeHtml(account.status || "pendente")}</strong></div>
            <div><span>Último login</span><strong>${escapeHtml(formatDate(account.last_login_at))}</strong></div>
            <div><span>Última atualização</span><strong>${escapeHtml(formatDate(account.updated_at))}</strong></div>
          </div>
          <p class="tight">${escapeHtml(account.notes || "Sem observações.")}</p>
          <div class="profile-actions">
            ${account.login_url ? `<a class="action primary-link" href="${escapeHtml(account.login_url)}" target="_blank" rel="noreferrer">Abrir login</a>` : ""}
            <button data-account-login="${account.id}">Já conectei</button>
            <button data-delete-account="${account.id}">Excluir</button>
          </div>
        </article>`).join("") || `<div class="empty-state"><h3>Nenhuma conta conectada</h3><p>Cadastre InfoJobs, Vagas.com, Gupy, Catho ou outro portal para centralizar logins e buscas.</p></div>`}</div>
      </section>
    </div>
  </section>`;

  const platform = document.querySelector("#accountPlatform");
  const fillPreset = () => {
    const preset = presets.find(([id]) => id === platform.value);
    document.querySelector("#accountDisplayName").value = preset?.[1] || "";
    document.querySelector("#accountLoginUrl").value = preset?.[2] || "";
  };
  platform.addEventListener("change", fillPreset);
  fillPreset();
  document.querySelector("#saveAccount").onclick = async () => {
    const payload = {
      platform: document.querySelector("#accountPlatform").value,
      display_name: document.querySelector("#accountDisplayName").value,
      login_url: document.querySelector("#accountLoginUrl").value,
      username: document.querySelector("#accountUsername").value,
      password: document.querySelector("#accountPassword").value,
      notes: document.querySelector("#accountNotes").value,
      status: "conectada"
    };
    await json("/api/connected-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    toast("Conta salva no cofre.", "success");
    await accountsPage();
  };
  document.querySelectorAll("[data-account-login]").forEach((button) => button.addEventListener("click", async () => {
    await json(`/api/connected-accounts/${button.dataset.accountLogin}/mark-login`, { method: "POST" });
    toast("Login registrado para acompanhamento.", "success");
    await accountsPage();
  }));
  document.querySelectorAll("[data-delete-account]").forEach((button) => button.addEventListener("click", async () => {
    if (!confirm("Excluir esta conta conectada do cofre?")) return;
    await json(`/api/connected-accounts/${button.dataset.deleteAccount}`, { method: "DELETE" });
    toast("Conta removida.", "success");
    await accountsPage();
  }));
}

async function aiApplyPage(initialMessage = "", prefill = null) {
  const initial = prefill || aiApplyPrefill;
  aiApplyPrefill = null;
  const bookmarklet = buildAiApplyBookmarklet();
  app.innerHTML = `<section class="page-panel">
    <div class="page-title-row">
      <div><span class="eyebrow">IA Candidatura</span><h2>Assistente de candidatura</h2><p>A vaga abre no site oficial. O Ápice prepara seus dados, currículo e respostas sem quebrar a navegação.</p></div>
      <div class="toolbar-actions">
        <button id="backFromAiApply">Voltar</button>
      </div>
    </div>
    <div id="aiApplyResult" class="note ${initialMessage ? "" : "hidden"}">${initialMessage}</div>
    <div class="ai-apply-workbench">
      <section class="ai-apply-control">
        <span class="eyebrow">Link real</span>
        <h3>Preparar candidatura</h3>
        <p>Cole uma vaga individual. Páginas de pesquisa não entram: use sempre o anúncio oficial da empresa ou do portal.</p>
        <label>Link da vaga<input id="aiApplyUrl" placeholder="https://empresa.com/vaga/oficial" value="${escapeHtml(initial?.url || "")}"></label>
        <div class="form-grid">
          <label>Cargo opcional<input id="aiApplyTitle" placeholder="Ex.: Atendente, Bartender, Comercial" value="${escapeHtml(initial?.title || "")}"></label>
          <label>Empresa opcional<input id="aiApplyCompany" placeholder="Nome da empresa" value="${escapeHtml(initial?.company || "")}"></label>
        </div>
        <div class="card-actions">
          <a id="openAiApplyExternal" class="action primary-link hidden" target="_blank" rel="noreferrer">Abrir vaga no site oficial</a>
          <button id="vaiIa" class="primary">Preparar com IA</button>
        </div>
        <div class="ai-capability-list">
          <div><span>1</span><p><strong>Lê a vaga</strong><small>Compara requisitos, currículo e respostas já memorizadas.</small></p></div>
          <div><span>2</span><p><strong>Monta o pacote</strong><small>Organiza dados pessoais, pretensão, disponibilidade, currículo e apresentação.</small></p></div>
          <div><span>3</span><p><strong>Preenche no portal</strong><small>O favorito “Preencher com Ápice” funciona em formulários comuns e no LinkedIn Easy Apply.</small></p></div>
          <div><span>4</span><p><strong>Aprende sem inventar</strong><small>Perguntas desconhecidas voltam ao painel e, depois da sua resposta, entram na memória.</small></p></div>
        </div>
        <div class="bookmarklet-box">
          <strong>Trazer vaga para o Ápice</strong>
          <small>Arraste o botão para a barra de favoritos. Ao encontrar uma vaga real, use-o para importar o link direto para este assistente.</small>
          <div class="card-actions">
            <a id="aiBookmarkletLink" class="action primary-link" href="${escapeHtml(bookmarklet)}">Importar vaga atual</a>
            <button id="copyAiBookmarklet" type="button">Copiar favorito</button>
          </div>
          <textarea id="aiBookmarkletCode" readonly rows="3">${escapeHtml(bookmarklet)}</textarea>
        </div>
        <div class="notice-mini">
          <strong>Proteção da sua conta</strong>
          <small>A IA não tenta contornar CAPTCHA, login, bloqueios ou regras do portal. Campos desconhecidos aparecem como perguntas e podem ser memorizados para a próxima candidatura.</small>
        </div>
      </section>
      <section class="application-launchpad">
        <div class="launchpad-head">
          <div><span class="eyebrow">Fluxo seguro</span><h3>Site oficial + assistência do Ápice</h3></div>
          <span id="officialLinkState" class="state-chip">Aguardando link</span>
        </div>
        <div class="official-job-summary">
          <small id="officialDomain">Nenhuma fonte selecionada</small>
          <h3 id="officialJobTitle">Cole ou escolha uma vaga</h3>
          <p id="officialJobCompany">O anúncio será aberto fora do painel para funcionar corretamente.</p>
          <small id="officialJobUrl">O Ápice continuará aberto para preparar e acompanhar a inscrição.</small>
        </div>
        <ol class="assistant-step-list">
          <li id="assistantStepOpen"><span>1</span><div><strong>Abrir o anúncio oficial</strong><small>Login, anexos e formulários funcionam na página original.</small></div></li>
          <li id="assistantStepPrepare"><span>2</span><div><strong>Preparar com IA</strong><small>O agente cruza o anúncio com seu currículo e gera o comando de preenchimento.</small></div></li>
          <li><span>3</span><div><strong>Preencher na vaga</strong><small>No site oficial, execute “Preencher com Ápice” e confira os campos destacados.</small></div></li>
          <li><span>4</span><div><strong>Confirmar e acompanhar</strong><small>Depois do envio, registre a candidatura para monitorar retornos pelo Gmail.</small></div></li>
        </ol>
        <div class="launchpad-actions">
          <a id="openAiApplyOfficial" class="action primary-link hidden" target="_blank" rel="noreferrer">Abrir vaga no site oficial</a>
          <button id="copyOfficialUrl" type="button" disabled>Copiar link</button>
        </div>
        <div class="notice-mini">
          <strong>Por que abre em outra aba?</strong>
          <small>Portais de emprego bloqueiam janelas incorporadas por segurança. Na aba oficial, login e Easy Apply continuam funcionando; o Ápice auxilia o preenchimento sem tentar ultrapassar CAPTCHA ou enviar informação falsa.</small>
        </div>
      </section>
    </div>
  </section>`;

  const urlInput = document.querySelector("#aiApplyUrl");
  const titleInput = document.querySelector("#aiApplyTitle");
  const companyInput = document.querySelector("#aiApplyCompany");
  const state = document.querySelector("#officialLinkState");
  const externalLinks = [document.querySelector("#openAiApplyExternal"), document.querySelector("#openAiApplyOfficial")];
  const copyUrl = document.querySelector("#copyOfficialUrl");
  const normalizeUrl = () => urlInput.value.trim();
  const applicationId = Number(initial?.applicationId || 0);
  const activateOfficialLink = () => {
    const url = normalizeUrl();
    if (!url) {
      showInlineResult("#aiApplyResult", "Cole o link real da vaga primeiro.");
      return false;
    }
    if (isGoogleSearchUrl(url)) {
      showInlineResult("#aiApplyResult", "<strong>Use o link final da vaga.</strong><p>Abra um resultado da empresa ou do portal e importe a URL do anúncio individual.</p>");
      return false;
    }
    let parsed;
    try {
      parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("protocol");
    } catch {
      showInlineResult("#aiApplyResult", "Informe um link completo começando com http:// ou https://.");
      return false;
    }
    externalLinks.forEach((link) => {
      link.href = url;
      link.classList.remove("hidden");
    });
    copyUrl.disabled = false;
    state.textContent = "Fonte pronta";
    state.className = "state-chip success";
    document.querySelector("#officialDomain").textContent = parsed.hostname.replace(/^www\./, "");
    document.querySelector("#officialJobTitle").textContent = titleInput.value.trim() || "Vaga oficial";
    document.querySelector("#officialJobCompany").textContent = companyInput.value.trim() || "Empresa a confirmar";
    document.querySelector("#officialJobUrl").textContent = url;
    document.querySelector("#assistantStepOpen").classList.add("completed");
    return true;
  };

  urlInput.addEventListener("input", () => {
    state.textContent = "Link alterado";
    state.className = "state-chip warning";
  });
  document.querySelector("#copyOfficialUrl").onclick = async () => {
    if (!activateOfficialLink()) return;
    try {
      await navigator.clipboard.writeText(normalizeUrl());
      toast("Link oficial copiado.", "success");
    } catch {
      toast("Não consegui copiar automaticamente.", "error");
    }
  };
  document.querySelector("#aiBookmarkletLink").addEventListener("click", (event) => {
    event.preventDefault();
    toast("Arraste este botão para a barra de favoritos ou use Copiar favorito.", "info");
  });
  document.querySelector("#copyAiBookmarklet").onclick = async () => {
    try {
      await navigator.clipboard.writeText(bookmarklet);
      toast("Favorito inteligente copiado.", "success");
    } catch {
      const code = document.querySelector("#aiBookmarkletCode");
      code.focus();
      code.select();
      toast("Selecione o código do favorito e copie manualmente.", "info");
    }
  };
  const prepareWithAi = async () => {
    if (!activateOfficialLink()) return;
    const url = normalizeUrl();
    let result;
    let preparedIds = applicationId ? [applicationId] : [];
    if (applicationId) {
      result = await json("/api/applications/ai-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [applicationId] })
      });
    } else {
      const imported = await json("/api/manual-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          title: titleInput.value.trim() || undefined,
          company: companyInput.value.trim() || undefined
        })
      });
      const approvedResult = await json("/api/jobs/approve-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [Number(imported.job?.id)].filter(Boolean) })
      });
      const appIds = approvedResult.applicationIds || [];
      preparedIds = appIds;
      result = appIds.length
        ? await json("/api/applications/ai-apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: appIds }) })
        : { modeLabel: "Link importado", actions: [] };
    }
    document.querySelector("#assistantStepPrepare").classList.add("completed");
    state.textContent = "Pacote pronto";
    state.className = "state-chip success";
    showInlineResult("#aiApplyResult", `${renderAutomationResult(result)}<p>Abra a fonte oficial, revise o preenchimento e registre o envio para acompanhar os retornos.</p>${markSentButton(preparedIds, "Registrei minha candidatura")}`);
    toast("IA preparou a candidatura para o link informado.", "success");
  };
  document.querySelector("#vaiIa").onclick = prepareWithAi;
  document.querySelector("#backFromAiApply").onclick = () => load(aiApplyReturnTab || "applications");
  if (initial?.url) {
    activateOfficialLink();
    if (initial.autoLoad && !initial.autoPrepare) {
      showInlineResult("#aiApplyResult", "<strong>Vaga pronta para abrir.</strong><p>Use Abrir vaga no site oficial e depois Prepare com IA.</p>");
    }
  }
  if (initial?.url && initial.autoPrepare) await prepareWithAi();
}

async function profilesPage() {
  const data = await json("/api/profiles");
  const memory = await json(`/api/answer-memory?profileId=${data.active?.id || 1}`);
  app.innerHTML = `<div class="command-hero resume-hero">
    <div class="hero-copy">
      <span class="eyebrow">Perfis de candidatura</span>
      <h2>Pessoas, respostas e currículos separados</h2>
      <p>Use perfis distintos para cada pessoa. A memória de respostas fica vinculada ao perfil ativo.</p>
    </div>
    <div class="hero-actions">
      <button data-tab="applications" class="primary">Usar nas candidaturas</button>
      <button data-tab="profile">Configurar busca</button>
    </div>
  </div>

  <div class="two-column">
    <section>
      <div class="section-head"><div><span class="eyebrow">Usuários</span><h3>Perfis existentes</h3></div></div>
      <div class="profile-card-grid">${(data.profiles || []).map((profile) => `<div class="profile-card ${Number(profile.is_active) === 1 ? "active-profile" : ""}">
        <div class="section-head">
          <div><strong>${escapeHtml(profile.label || profile.name)}</strong><small>${escapeHtml(profile.name)} · ${escapeHtml(profile.email || "sem e-mail")}</small></div>
          <span class="state-chip ${Number(profile.is_active) === 1 ? "success" : "info"}">${Number(profile.is_active) === 1 ? "Ativo" : "Disponível"}</span>
        </div>
        <div class="profile-grid compact">
          <div><span>Telefone</span><strong>${escapeHtml(profile.phone || "Falta")}</strong></div>
          <div><span>Cidade</span><strong>${escapeHtml(profile.city || "Falta")}/${escapeHtml(profile.state || "")}</strong></div>
          <div><span>Memória</span><strong>${profile.memory_count || 0}</strong></div>
          <div><span>Candidaturas</span><strong>${profile.applications_count || 0}</strong></div>
        </div>
        <div class="profile-actions">
          ${Number(profile.is_active) === 1 ? "" : `<button data-activate-profile="${profile.id}">Ativar perfil</button>`}
          ${(data.profiles || []).length > 1 ? `<button data-delete-profile="${profile.id}">Excluir perfil</button>` : ""}
        </div>
      </div>`).join("")}</div>
    </section>

    <section>
      <div class="section-head"><div><span class="eyebrow">Novo perfil</span><h3>Criar perfil em branco</h3></div></div>
      <div class="form-grid single">
        <label>Nome do perfil<input id="profileLabel" placeholder="Ex: Perfil principal"></label>
        <label>Nome completo<input id="profileName" placeholder="Preencha quando for usar este perfil"></label>
        <label>E-mail<input id="profileEmail"></label>
        <label>Telefone<input id="profilePhone"></label>
        <label>LinkedIn<input id="profileLinkedin"></label>
        <label>Cidade<input id="profileCity" value="Curitiba"></label>
        <label>Estado<input id="profileState" value="PR"></label>
        <label>Currículo base<input id="profileResume" placeholder="CV-Hospitalidade.pdf"></label>
        <label class="field-wide">Resumo<textarea id="profileSummary" rows="5"></textarea></label>
        <label class="check-line"><input id="profileActive" type="checkbox" checked> Tornar ativo agora</label>
        <button id="createProfile" class="primary">Criar perfil</button>
      </div>
    </section>
  </div>

  <section>
    <div class="section-head"><div><span class="eyebrow">Currículo do perfil ativo</span><h3>Enviar ou colar currículo</h3></div><span class="state-chip ready">${escapeHtml(data.active?.resume_file ? fileName(data.active.resume_file) : "Currículo pendente")}</span></div>
    <div class="two-column">
      <div class="profile-card">
        <strong>Arquivo do currículo</strong>
        <p class="tight">Envie PDF, DOC, DOCX, TXT ou MD. O arquivo fica vinculado ao perfil ativo para as próximas candidaturas.</p>
        <input id="profileResumeFileUpload" type="file" accept=".pdf,.doc,.docx,.txt,.md">
        <button id="uploadProfileResume" class="primary">Enviar currículo</button>
      </div>
      <div class="profile-card">
        <strong>Texto para a IA entender melhor</strong>
        <p class="tight">Se o arquivo for PDF/DOCX, cole também o texto principal do currículo para a IA organizar suas forças sem depender de leitura externa.</p>
        <textarea id="profileResumeText" rows="6" placeholder="Cole aqui o conteúdo do currículo, experiências, cursos e resultados importantes."></textarea>
      </div>
    </div>
  </section>

  <section>
    <div class="section-head"><div><span class="eyebrow">Memória do perfil ativo</span><h3>Respostas salvas</h3></div><span class="state-chip ready">${escapeHtml(data.active?.name || "Perfil")}</span></div>
    <div class="stack-list">${(memory.answers || []).map((answer) => `<div class="stack-item">
      <div><strong>${escapeHtml(answer.question_key)}</strong><small>${escapeHtml(answer.question_text || answer.category || "Resposta memorizada")}</small></div>
      <span>${escapeHtml(answer.answer_text)}</span>
    </div>`).join("") || `<div class="empty-mini">Nenhuma resposta memorizada ainda. Quando uma candidatura pedir algo novo, o agente pergunta e salva aqui.</div>`}</div>
  </section>`;

  document.querySelectorAll("[data-activate-profile]").forEach((button) => button.addEventListener("click", async () => {
    await json(`/api/profiles/${button.dataset.activateProfile}/activate`, { method: "POST" });
    toast("Perfil ativado.", "success");
    await profilesPage();
  }));
  document.querySelectorAll("[data-delete-profile]").forEach((button) => button.addEventListener("click", async () => {
    const ok = confirm("Excluir este perfil e as respostas memorizadas dele? O histórico das candidaturas será preservado.");
    if (!ok) return;
    await json(`/api/profiles/${button.dataset.deleteProfile}`, { method: "DELETE" });
    toast("Perfil excluido.", "success");
    await profilesPage();
  }));
  document.querySelector("#createProfile").onclick = async () => {
    const name = document.querySelector("#profileName").value.trim() || "Novo perfil";
    const payload = {
      label: document.querySelector("#profileLabel").value,
      name,
      email: document.querySelector("#profileEmail").value,
      phone: document.querySelector("#profilePhone").value,
      linkedin: document.querySelector("#profileLinkedin").value,
      city: document.querySelector("#profileCity").value,
      state: document.querySelector("#profileState").value,
      country: "Brasil",
      resume_file: document.querySelector("#profileResume").value,
      summary: document.querySelector("#profileSummary").value,
      is_active: document.querySelector("#profileActive").checked
    };
    await json("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    toast("Perfil criado.", "success");
    await profilesPage();
  };
  document.querySelector("#uploadProfileResume").onclick = async () => {
    const activeId = Number(data.active?.id || 0);
    if (!activeId) return toast("Ative ou crie um perfil antes de enviar currículo.", "error");
    const file = document.querySelector("#profileResumeFileUpload").files?.[0];
    const text = document.querySelector("#profileResumeText").value.trim();
    if (!file && !text) return toast("Envie um arquivo ou cole o texto do currículo.", "error");
    const payload = {
      fileName: file?.name || "curriculo.md",
      base64: file ? await fileToBase64(file) : "",
      text
    };
    await json(`/api/profiles/${activeId}/resume`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    toast("Currículo vinculado ao perfil ativo.", "success");
    await profilesPage();
  };
}

async function resumePage() {
  const data = await json("/api/career-profile");
  const profile = data.profile;
  const trackEntries = Object.entries(data.careerTracks || {}).filter(([, active]) => active);
  app.innerHTML = `<div class="command-hero resume-hero">
    <div class="hero-copy">
      <span class="eyebrow">Meu currículo</span>
      <h2>${escapeHtml(profile.name)}</h2>
      <p>${escapeHtml(data.applicationPositioning.headline)}</p>
    </div>
    <div class="hero-actions">
      <button data-tab="profile" class="primary">Editar perfil</button>
      <button data-tab="applications">Candidaturas</button>
    </div>
  </div>

  <div class="command-grid">
    <section>
      <div class="section-head"><div><span class="eyebrow">Base real</span><h3>Dados principais</h3></div></div>
      <div class="profile-grid">
        <div><span>Local</span><strong>${escapeHtml(profile.city)}/${escapeHtml(profile.state)}</strong></div>
        <div><span>E-mail</span><strong>${escapeHtml(profile.email)}</strong></div>
        <div><span>Telefone</span><strong>${escapeHtml(profile.phone || "Não informado")}</strong></div>
        <div><span>LinkedIn</span><strong>${escapeHtml(profile.linkedin || "Não informado")}</strong></div>
      </div>
      <p>${escapeHtml(profile.summary)}</p>
      <h3>Formacao</h3>
      <ul>${(profile.education?.degrees || []).map((degree) => `<li>${escapeHtml(degree)}</li>`).join("")}</ul>
    </section>
    <section>
      <div class="section-head"><div><span class="eyebrow">IA</span><h3>Status e materiais</h3></div><span class="state-chip ${data.ai.openaiConfigured ? "success" : "warning"}">${data.ai.openaiConfigured ? "Ativa" : "Configurar .env"}</span></div>
      <div class="resume-snapshot">
        <div><strong>${data.resumes.length}</strong><span>currículos base</span></div>
        <div><strong>${data.generatedResumes.length}</strong><span>CVs gerados</span></div>
        <div><strong>${data.generatedCoverLetters.length}</strong><span>cartas geradas</span></div>
      </div>
      <div class="stack-list">${(data.resumes || []).map((file) => `<div class="stack-item"><strong>${escapeHtml(file)}</strong><span class="state-chip success">Detectado</span></div>`).join("") || "<div class=\"empty-mini\">Nenhum currículo detectado na pasta resumes.</div>"}</div>
      <small>Modelo configurado: ${escapeHtml(data.ai.model)}</small>
    </section>
  </div>

  <div class="three-column">
    <section>
      <div class="section-head"><div><span class="eyebrow">Forças</span><h3>O que destacar</h3></div></div>
      <div class="stack-list">${(data.strengths || []).map((item) => `<div class="stack-item"><span>${escapeHtml(item)}</span></div>`).join("")}</div>
    </section>
    <section>
      <div class="section-head"><div><span class="eyebrow">Regras</span><h3>Limites seguros</h3></div></div>
      <div class="stack-list">${(data.applicationPositioning.safeClaims || []).map((item) => `<div class="stack-item"><span>${escapeHtml(item)}</span></div>`).join("")}</div>
    </section>
    <section>
      <div class="section-head"><div><span class="eyebrow">Cargos alvo</span><h3>Trilhas ativas</h3></div></div>
      <div class="pill-cloud">${trackEntries.map(([track]) => `<span>${labelize(track)}</span>`).join("")}</div>
    </section>
  </div>

  <section>
    <div class="section-head"><div><span class="eyebrow">Palavras-chave</span><h3>Cargos usados nas buscas</h3></div></div>
    <div class="pill-cloud">${(data.targetRoles || []).map((role) => `<span>${escapeHtml(role)}</span>`).join("")}</div>
  </section>`;
}

async function informal() {
  const rows = await json("/api/informal");
  const columns = [
    { id: "score", label: "Score", render: (row) => escapeHtml(row.freela_score ?? "-") },
    { id: "title", label: "Tipo", render: (row) => escapeHtml(row.title || "-") },
    { id: "contractor", label: "Contratante", render: (row) => escapeHtml(row.contractor_name || "-") },
    { id: "location", label: "Local", render: (row) => escapeHtml(row.location || "-") },
    { id: "schedule", label: "Horário", render: (row) => `${escapeHtml(row.start_time || "-")} - ${escapeHtml(row.end_time || "-")}` },
    { id: "pay", label: "Taxa", render: (row) => `R$ ${escapeHtml(row.total_pay || 0)}` },
    { id: "hourly", label: "Hora", render: (row) => `R$ ${escapeHtml(row.hourly_rate || 0)}` },
    { id: "risk", label: "Risco", render: (row) => `<strong class="${riskClass(row.risk_score)}">${escapeHtml(row.risk_score ?? "-")}</strong><small>${escapeHtml(row.risk_flags || "")}</small>` },
    { id: "status", label: "Status", render: (row) => escapeHtml(row.status || "-") }
  ];
  const empty = `<div class="empty-state"><h3>Nenhum freela encontrado</h3><p>Quando o radar encontrar taxas, eventos ou bicos, eles aparecem aqui separados das vagas CLT/PJ.</p></div>`;
  app.innerHTML = `<section class="page-panel">
    <div class="page-title-row"><div><span class="eyebrow">Freelas</span><h2>Taxas, eventos e bicos</h2><p>Avalia valor por hora, risco e clareza da proposta.</p></div></div>
    ${renderTable("informal", rows, columns, empty)}
  </section>`;
}

async function settings() {
  const [data, resumes, env, profileData, portableExport] = await Promise.all([
    json("/api/settings"),
    json("/api/resumes"),
    json("/api/environment"),
    json("/api/profiles"),
    json("/api/settings/export?scope=github")
  ]);
  const activeProfile = profileData.active || {};
  const envLocked = Boolean(env.managedExternally || currentUser?.role !== "admin");
  const careerLevels = getPath(data, "jobSearchPreferences.careerLevels", {});
  const workStyles = getPath(data, "jobSearchPreferences.workStyles", {});
  const schedules = getPath(data, "jobSearchPreferences.schedulePreferences", {});
  const contracts = getPath(data, "jobSearchPreferences.contractTypes", {});
  const education = getPath(data, "jobSearchPreferences.educationFilters", {});
  const license = getPath(data, "jobSearchPreferences.driverLicenseFilters", {});
  const sources = getPath(data, "sources", {});
  const tracks = getPath(data, "careerTracks", {});
  const informalWork = getPath(data, "informalWork", {});
  const automationEnabled = Boolean(data.agent.enabled)
    && !Boolean(data.agent.paused)
    && !Boolean(data.agent.dryRun)
    && Boolean(getPath(data, "applications.autoApply"));

  app.innerHTML = `<div class="settings-shell">
    <aside class="settings-nav">
      <button data-jump="perfil">Meu perfil</button>
      <button data-jump="curriculo">Currículo</button>
      <button data-jump="ia">IA e online</button>
      <button data-jump="busca">Busca</button>
      <button data-jump="local">Local e modelo</button>
      <button data-jump="salario">Salário</button>
      <button data-jump="freelas">Freelas</button>
      <button data-jump="fontes">Fontes</button>
      <button data-jump="automacao">Automação</button>
      <button data-jump="seguranca">Proteções</button>
      <button data-jump="codigo">Sincronizar</button>
    </aside>

    <section class="settings-panel">
      <div class="settings-head">
        <div><span class="eyebrow">Configurações do Ápice</span><h2>Perfil, busca e automação em um só lugar</h2><p>Suas escolhas ficam organizadas por objetivo e são refletidas no código de configuração.</p></div>
        <div class="save-box"><button id="saveVisualSettings" class="primary">Salvar configurações</button><span id="saveStatus"></span></div>
      </div>

      <div class="config-section" id="perfil">
        <h3>Dados do perfil</h3>
        <div class="form-grid">
          ${input("Nome", "profile.name", data.profile.name)}
          ${input("E-mail", "profile.email", data.profile.email)}
          ${input("Telefone", "profile.phone", data.profile.phone)}
          ${input("LinkedIn", "profile.linkedin", data.profile.linkedin)}
          ${input("Estado civil", "profile.maritalStatus", data.profile.maritalStatus || "Solteiro")}
          ${input("Cidade", "profile.city", data.profile.city)}
          ${input("Estado", "profile.state", data.profile.state)}
          ${textareaField("Resumo profissional", "profile.summary", data.profile.summary)}
          ${textareaField("Formações, uma por linha", "profile.education.degrees", data.profile.education.degrees)}
        </div>
        <div class="resume-list"><strong>Currículos encontrados:</strong> ${resumes.files.length ? resumes.files.map((file) => `<span>${escapeHtml(file)}</span>`).join("") : "<em>Nenhum currículo detectado.</em>"}</div>
      </div>

      <div class="config-section" id="curriculo">
        <h3>Currículo para candidaturas</h3>
        <div class="two-column">
          <div class="profile-card">
            <strong>Perfil ativo</strong>
            <p class="tight">${escapeHtml(activeProfile.name || "Novo perfil")} · ${escapeHtml(activeProfile.email || "e-mail pendente")}</p>
            <div class="profile-grid compact">
              <div><span>Arquivo usado</span><strong>${escapeHtml(fileName(activeProfile.resume_file || ""))}</strong></div>
              <div><span>Memória</span><strong>${activeProfile.memory_count || 0}</strong></div>
            </div>
            <input id="profileResumeFileUpload" type="file" accept=".pdf,.doc,.docx,.txt,.md">
            <button id="uploadProfileResume" class="primary">Enviar currículo</button>
          </div>
          <div class="profile-card">
            <strong>Complemento para a IA</strong>
            <p class="tight">Cole experiências, cursos, resultados ou detalhes que precisam aparecer nas candidaturas futuras.</p>
            <textarea id="profileResumeText" rows="8" placeholder="Cole o texto do currículo ou informações importantes para a IA organizar seu perfil."></textarea>
          </div>
        </div>
      </div>

      <div class="config-section" id="ia">
        <h3>IA, Google e sincronização online</h3>
        ${env.managedExternally ? `<div class="note"><strong>Ambiente online protegido</strong><p>Esta página é a mesma da instalação local. No Render, as chaves ficam nas <em>Environment Variables</em> do serviço e nunca são gravadas ou exibidas pelo painel.</p></div>` : ""}
        <div class="form-grid">
          <div class="field"><label>Chave OpenAI</label><input id="envOpenaiKey" type="password" ${envLocked ? "disabled" : ""} placeholder="${env.openaiConfigured ? "Chave configurada. Digite outra para trocar." : "Cole sua OPENAI_API_KEY"}"><small>Não vai para o GitHub. Fica no .env local ou nos segredos do servidor online.</small></div>
          <div class="field"><label>Modelo OpenAI</label><input id="envOpenaiModel" ${envLocked ? "disabled" : ""} value="${escapeHtml(env.openaiModel || "gpt-4o-mini")}"></div>
          <div class="field"><label>Chave Gemini</label><input id="envGeminiKey" type="password" ${envLocked ? "disabled" : ""} placeholder="${env.geminiConfigured ? "Chave configurada. Digite outra para trocar." : "Cole sua GEMINI_API_KEY"}"><small>Usada como apoio para análise e respostas quando o módulo estiver habilitado.</small></div>
          <div class="field"><label>Modelo Gemini</label><input id="envGeminiModel" ${envLocked ? "disabled" : ""} value="${escapeHtml(env.geminiModel || "gemini-1.5-flash")}"></div>
          <div class="field"><label>Google Search API Key</label><input id="envGoogleKey" type="password" ${envLocked ? "disabled" : ""} placeholder="${env.googleSearchConfigured ? "Configurada. Digite outra para trocar." : "Opcional"}"></div>
          <div class="field"><label>Google Search Engine ID</label><input id="envGoogleCx" ${envLocked ? "disabled" : ""} value=""></div>
          <div class="field"><label>Banco online DATABASE_URL</label><input id="envDatabaseUrl" ${envLocked ? "disabled" : ""} value="${escapeHtml(env.databaseUrl || "file:./data/jobs.sqlite")}"><small>No Render, use um caminho persistente como <code>file:/var/data/jobs.sqlite</code>.</small></div>
          <div class="field"><label>Porta do painel</label><input id="envPort" ${envLocked ? "disabled" : ""} value="${escapeHtml(env.port || "8788")}"></div>
        </div>
        <div class="env-status">
          <span class="state-chip ${env.openaiConfigured ? "success" : "warning"}">OpenAI ${env.openaiConfigured ? "ativa" : "pendente"}</span>
          <span class="state-chip ${env.geminiConfigured ? "success" : "info"}">Gemini ${env.geminiConfigured ? "ativa" : "opcional"}</span>
          <span class="state-chip ${env.googleSearchConfigured ? "success" : "info"}">Google Search ${env.googleSearchConfigured ? "ativo" : "opcional"}</span>
          <span class="state-chip ${env.managedExternally || env.envExists ? "success" : "warning"}">${env.managedExternally ? "Render protegido" : `.env ${env.envExists ? "criado" : "não criado"}`}</span>
        </div>
        <button id="saveEnvConfig" class="primary" ${envLocked ? "disabled" : ""}>${env.managedExternally ? "Gerenciado no Render" : "Salvar IA no .env"}</button><span id="envSaveStatus"></span>
      </div>

      <div class="config-section" id="busca">
        <h3>O que buscar</h3>
        ${textareaField("Cargos e palavras-chave, um por linha", "jobSearchPreferences.targetRoles", getPath(data, "jobSearchPreferences.targetRoles", []))}
        ${checkboxGrid("Trilhas de carreira", "careerTracks", tracks)}
        ${checkboxGrid("Níveis aceitos", "jobSearchPreferences.careerLevels", careerLevels)}
        ${checkboxGrid("Tipos de contrato", "jobSearchPreferences.contractTypes", contracts)}
      </div>

      <div class="config-section" id="local">
        <h3>Local, modelo e rotina</h3>
        <div class="form-grid">
          ${textareaField("Locais preferidos, um por linha", "jobSearchPreferences.locations.preferred", getPath(data, "jobSearchPreferences.locations.preferred", []))}
          ${textareaField("Estados aceitos, um por linha", "jobSearchPreferences.locations.acceptedStates", getPath(data, "jobSearchPreferences.locations.acceptedStates", []))}
        </div>
        ${checkboxGrid("Modelos de trabalho", "jobSearchPreferences.workStyles", workStyles)}
        ${checkboxGrid("Horários e escalas", "jobSearchPreferences.schedulePreferences", schedules)}
        ${checkboxGrid("Escolaridade aceita", "jobSearchPreferences.educationFilters", education)}
        ${checkboxGrid("CNH e veículo", "jobSearchPreferences.driverLicenseFilters", license)}
        <div class="form-grid">
          <label class="check-line"><input type="checkbox" data-path="profile.driverLicense.hasLicense" ${data.profile.driverLicense.hasLicense ? "checked" : ""}> Tenho CNH</label>
          <label class="check-line"><input type="checkbox" data-path="profile.driverLicense.hasOwnVehicle" ${data.profile.driverLicense.hasOwnVehicle ? "checked" : ""}> Tenho veículo próprio</label>
          ${textareaField("Categorias da sua CNH, uma por linha", "profile.driverLicense.categories", data.profile.driverLicense.categories)}
        </div>
      </div>

      <div class="config-section" id="salario">
        <h3>Salário e pretensão</h3>
        <div class="form-grid">
          ${numberInput("CLT mínimo mensal", "salaryPreferences.salaryByContractType.clt.minimumMonthly", getPath(data, "salaryPreferences.salaryByContractType.clt.minimumMonthly", 0))}
          ${numberInput("CLT desejado mensal", "salaryPreferences.salaryByContractType.clt.desiredMonthly", getPath(data, "salaryPreferences.salaryByContractType.clt.desiredMonthly", 0))}
          ${numberInput("PJ mínimo mensal", "salaryPreferences.salaryByContractType.pj.minimumMonthly", getPath(data, "salaryPreferences.salaryByContractType.pj.minimumMonthly", 0))}
          ${numberInput("PJ desejado mensal", "salaryPreferences.salaryByContractType.pj.desiredMonthly", getPath(data, "salaryPreferences.salaryByContractType.pj.desiredMonthly", 0))}
          ${numberInput("Diária mínima", "salaryPreferences.salaryByContractType.freelancer.minimumDaily", getPath(data, "salaryPreferences.salaryByContractType.freelancer.minimumDaily", 0))}
          ${numberInput("Valor/hora mínimo", "salaryPreferences.salaryByContractType.hourly.minimumHourly", getPath(data, "salaryPreferences.salaryByContractType.hourly.minimumHourly", 0))}
        </div>
        <div class="choice-grid">
          <label class="check-pill"><input type="checkbox" data-path="salaryPreferences.rejectWithoutSalary" ${getPath(data, "salaryPreferences.rejectWithoutSalary") ? "checked" : ""}> Rejeitar vaga sem salário</label>
          <label class="check-pill"><input type="checkbox" data-path="salaryPreferences.penalizeWithoutSalary" ${getPath(data, "salaryPreferences.penalizeWithoutSalary") ? "checked" : ""}> Penalizar vaga sem salário</label>
          <label class="check-pill"><input type="checkbox" data-path="salaryPreferences.askSalaryInDraft" ${getPath(data, "salaryPreferences.askSalaryInDraft") ? "checked" : ""}> Perguntar salário no rascunho</label>
        </div>
      </div>

      <div class="config-section" id="freelas">
        <h3>Freelas, bicos, taxas e eventos</h3>
        ${checkboxGrid("Tipos aceitos", "informalWork", Object.fromEntries(Object.entries(informalWork).filter(([, value]) => typeof value === "boolean")))}
        <div class="form-grid">
          ${numberInput("Valor/hora mínimo", "informalWork.minimumHourlyRate", informalWork.minimumHourlyRate)}
          ${numberInput("Diária mínima", "informalWork.minimumDailyRate", informalWork.minimumDailyRate)}
          ${numberInput("Diária desejada", "informalWork.desiredDailyRate", informalWork.desiredDailyRate)}
          ${numberInput("Taxa mínima de evento", "informalWork.minimumEventRate", informalWork.minimumEventRate)}
          ${numberInput("Distância máxima em km", "informalWork.maxDistanceKm", informalWork.maxDistanceKm)}
          ${numberInput("Prazo máximo para pagamento", "informalWork.maximumPaymentDelayDays", informalWork.maximumPaymentDelayDays)}
        </div>
      </div>

      <div class="config-section" id="fontes">
        <h3>Fontes de busca</h3>
        ${checkboxGrid("Fontes ativas", "sources", sources)}
        <div class="note"><strong>WhatsApp:</strong> monitoramento em tempo real exige API oficial ou encaminhamento seguro. O caminho seguro é colar/exportar mensagens em <code>data/whatsapp-vagas.txt</code> e rodar Buscar vagas.</div>
      </div>

      <div class="config-section" id="automacao">
        <div class="automation-overview">
          <div>
            <span class="eyebrow">Operação</span>
            <h3>Automação de candidaturas</h3>
            <p>O Ápice prepara e envia somente por canais compatíveis. Login, CAPTCHA, SMS e declarações sensíveis continuam sob seu controle.</p>
          </div>
          <div class="automation-control">
            <span class="automation-state ${automationEnabled ? "active" : "assisted"}">${automationEnabled ? "Automação permitida ativa" : "Modo assistido"}</span>
            <button id="enableAllowedAutomation" class="primary">${automationEnabled ? "Automação configurada" : "Ativar automação permitida"}</button>
          </div>
        </div>
        <div class="form-grid">
          ${numberInput("Máximo de vagas por rodada", "agent.maxJobsPerRun", data.agent.maxJobsPerRun)}
          ${numberInput("Máximo de candidaturas por dia", "strategy.maxApplicationsPerDay", data.strategy.maxApplicationsPerDay)}
          ${numberInput("Preparar só acima da nota", "strategy.onlyPrepareAboveScore", data.strategy.onlyPrepareAboveScore)}
          ${numberInput("Aplicar só acima da nota", "strategy.onlyApplyAboveScore", data.strategy.onlyApplyAboveScore)}
        </div>
        <div class="choice-grid">
          ${settingToggle("Agente ativo", "agent.enabled", data.agent.enabled, "Permite que o agente rode buscas, prepare candidaturas e atualize o painel.")}
          ${settingToggle("Pausar agente", "agent.paused", data.agent.paused, "Interrompe rotinas automáticas sem apagar suas configurações.")}
          ${settingToggle("Simular antes de enviar", "agent.dryRun", data.agent.dryRun, "Registra decisões e prepara tudo antes de qualquer envio real.")}
          ${settingToggle("Preparar candidaturas", "applications.prepareApplications", getPath(data, "applications.prepareApplications"), "Gera currículo, carta e pacote de candidatura para vagas aprovadas.")}
          ${settingToggle("Candidatura automática permitida", "applications.autoApply", getPath(data, "applications.autoApply"), "Só tenta enviar quando a plataforma permitir, sem CAPTCHA e com dados completos.")}
          ${settingToggle("Enviar quando for permitido", "applications.autoApplyWhenAllowed", getPath(data, "applications.autoApplyWhenAllowed"), "Enviar apenas onde houver canal seguro e permitido pela plataforma.")}
          ${settingToggle("Preencher formulários", "applications.autoFillFormsWhenAllowed", getPath(data, "applications.autoFillFormsWhenAllowed"), "Monta respostas e campos para formulário oficial da vaga.")}
          ${settingToggle("Perguntar e memorizar", "applications.askAndRememberMissingFields", getPath(data, "applications.askAndRememberMissingFields"), "Quando faltar informação, pergunta uma vez e salva para futuras vagas.")}
          ${settingToggle("Pedir aprovação antes de enviar", "applications.requireApprovalBeforeApply", getPath(data, "applications.requireApprovalBeforeApply"), "Quando ativo, a candidatura fica pronta e aguarda sua confirmação final.")}
          ${settingToggle("Pedir confirmação para e-mail", "applications.requireApprovalBeforeSendingEmail", getPath(data, "applications.requireApprovalBeforeSendingEmail"), "Quando ativo, o Ápice cria o e-mail, mas só envia depois da sua confirmação.")}
          ${settingToggle("LinkedIn só busca", "applications.allowLinkedInSearchOnly", getPath(data, "applications.allowLinkedInSearchOnly"), "Encontra vagas no LinkedIn, mas você abre e se candidata manualmente.")}
          ${settingToggle("APIs oficiais", "applications.allowQuickApplyAPIs", getPath(data, "applications.allowQuickApplyAPIs"), "Use apenas com integração oficial/permitida pela plataforma.")}
          ${settingToggle("Autofill no navegador", "applications.allowBrowserAutofill", getPath(data, "applications.allowBrowserAutofill"), "Ajuda a preencher, mas não burla login, CAPTCHA ou regras de site.")}
        </div>
      </div>

      <div class="config-section" id="seguranca">
        <h3>Proteções permanentes</h3>
        <div class="safety-guard-grid">
          <div><strong>Dados verdadeiros</strong><small>Experiência, formação, documentos e competências nunca são inventados.</small></div>
          <div><strong>Contas protegidas</strong><small>Nenhuma rotina tenta contornar CAPTCHA, SMS, login ou bloqueios da plataforma.</small></div>
          <div><strong>Rastreabilidade</strong><small>Só entra no total do dashboard o envio que tiver confirmação real.</small></div>
          <div><strong>Pendências objetivas</strong><small>Uma ação sua só aparece quando o recrutador ou a plataforma solicitar algo.</small></div>
        </div>
      </div>

      <div class="config-section" id="codigo">
        <h3>Sincronizar local, online e GitHub</h3>
        <p>A instalação local e a online usam exatamente esta mesma página. Exporte aqui e importe no outro ambiente para repetir suas escolhas.</p>
        <div class="sync-grid">
          <div class="sync-panel">
            <strong>Preferências seguras para GitHub</strong>
            <p>Leva cargos, locais, salários, fontes e regras. Nome, e-mail, telefone, documentos e credenciais são removidos automaticamente.</p>
            <div class="portable-actions">
              <button id="copyPortableSettings" class="primary">Copiar JSON seguro</button>
              <button id="downloadPortableSettings">Baixar para GitHub</button>
            </div>
          </div>
          <div class="sync-panel private-backup">
            <strong>Backup privado do perfil</strong>
            <p>Inclui seus dados pessoais e escolhas. O arquivo PDF do currículo deve ser enviado separadamente. Não publique este JSON no GitHub.</p>
            <button id="downloadPrivateSettings">Baixar backup privado</button>
          </div>
        </div>
        <textarea id="portableSettingsCode" class="code-output portable-code" spellcheck="false">${escapeHtml(JSON.stringify(portableExport, null, 2))}</textarea>
        <div class="import-row">
          <input id="settingsImportFile" type="file" accept="application/json,.json">
          <button id="importPortableSettings" class="primary">Importar configuração</button>
          <span id="importStatus"></span>
        </div>
        <details class="advanced-code">
          <summary>Ver e editar a configuração completa desta conta</summary>
          <div class="note"><strong>Conteúdo privado:</strong> este JSON pode conter dados do seu perfil. Use o arquivo seguro acima para GitHub.</div>
          <textarea id="settingsCode" class="code-output" spellcheck="false"></textarea>
        </details>
      </div>
    </section>
  </div>`;

  let currentSettings = structuredClone(data);
  const code = document.querySelector("#settingsCode");
  const portableCode = document.querySelector("#portableSettingsCode");
  const readValue = (element) => {
    if (element.type === "checkbox") return element.checked;
    if (element.type === "number") return Number(element.value || 0);
    if (element.tagName === "TEXTAREA") {
      const value = element.value;
      const original = getPath(currentSettings, element.dataset.path);
      return Array.isArray(original) ? value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : value;
    }
    return element.value;
  };
  function syncCode() {
    document.querySelectorAll("[data-path]").forEach((element) => setPath(currentSettings, element.dataset.path, readValue(element)));
    code.value = JSON.stringify(currentSettings, null, 2);
  }

  document.querySelectorAll("[data-path]").forEach((element) => element.addEventListener("input", syncCode));
  document.querySelectorAll("[data-jump]").forEach((button) => button.addEventListener("click", () => document.querySelector(`#${button.dataset.jump}`).scrollIntoView({ behavior: "smooth", block: "start" })));
  code.addEventListener("input", () => {
    try {
      currentSettings = JSON.parse(code.value);
      document.querySelector("#saveStatus").textContent = "Código válido.";
    } catch {
      document.querySelector("#saveStatus").textContent = "O código ainda não é um JSON válido.";
    }
  });
  async function saveCurrentSettings(showFeedback = true) {
    syncCode();
    await json("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: code.value });
    if (showFeedback) {
      document.querySelector("#saveStatus").textContent = "Configurações salvas.";
      toast("Perfil, preferências e automação foram salvos.", "success");
    }
  }
  document.querySelector("#saveVisualSettings").onclick = () => saveCurrentSettings(true);
  document.querySelector("#enableAllowedAutomation").onclick = async () => {
    setPath(currentSettings, "agent.enabled", true);
    setPath(currentSettings, "agent.paused", false);
    setPath(currentSettings, "agent.dryRun", false);
    setPath(currentSettings, "applications.prepareApplications", true);
    setPath(currentSettings, "applications.autoApply", true);
    setPath(currentSettings, "applications.autoApplyWhenAllowed", true);
    setPath(currentSettings, "applications.autoFillFormsWhenAllowed", true);
    setPath(currentSettings, "applications.askAndRememberMissingFields", true);
    setPath(currentSettings, "applications.requireApprovalBeforeApply", false);
    setPath(currentSettings, "applications.neverMassApplyWithoutApproval", false);
    setPath(currentSettings, "applications.requireApprovalBeforeSendingEmail", false);
    setPath(currentSettings, "applications.allowBrowserAutofill", true);
    code.value = JSON.stringify(currentSettings, null, 2);
    await json("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: code.value });
    toast("Automação permitida ativada. Proteções de conta e veracidade continuam ligadas.", "success");
    await settings();
  };

  async function refreshPortableExport() {
    await saveCurrentSettings(false);
    const exported = await json("/api/settings/export?scope=github");
    portableCode.value = JSON.stringify(exported, null, 2);
    return exported;
  }

  function downloadJson(value, fileName) {
    const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  document.querySelector("#copyPortableSettings").onclick = async () => {
    const exported = await refreshPortableExport();
    try {
      await navigator.clipboard.writeText(JSON.stringify(exported, null, 2));
    } catch {
      portableCode.select();
      document.execCommand("copy");
    }
    toast("Configuração segura copiada. Ela pode ser versionada no GitHub.", "success");
  };

  document.querySelector("#downloadPortableSettings").onclick = async () => {
    downloadJson(await refreshPortableExport(), "apice-preferencias-github.json");
    toast("Arquivo seguro para GitHub gerado.", "success");
  };

  document.querySelector("#downloadPrivateSettings").onclick = async () => {
    await saveCurrentSettings(false);
    downloadJson(await json("/api/settings/export?scope=private"), "apice-backup-privado.json");
    toast("Backup privado gerado. Guarde fora de repositórios públicos.", "success");
  };

  document.querySelector("#importPortableSettings").onclick = async () => {
    const file = document.querySelector("#settingsImportFile").files?.[0];
    const raw = file ? await file.text() : portableCode.value;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return toast("O arquivo ou texto informado não é um JSON válido.", "error");
    }
    await json("/api/settings/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
    toast("Configuração importada e aplicada nesta conta.", "success");
    await settings();
  };
  document.querySelector("#saveEnvConfig").onclick = async () => {
    if (envLocked) return toast("No ambiente online, altere as chaves nas Environment Variables do Render.", "info");
    const payload = {
          openaiApiKey: document.querySelector("#envOpenaiKey").value,
          openaiModel: document.querySelector("#envOpenaiModel").value,
          geminiApiKey: document.querySelector("#envGeminiKey").value,
          geminiModel: document.querySelector("#envGeminiModel").value,
          googleSearchApiKey: document.querySelector("#envGoogleKey").value,
      googleSearchEngineId: document.querySelector("#envGoogleCx").value,
      databaseUrl: document.querySelector("#envDatabaseUrl").value,
      port: document.querySelector("#envPort").value
    };
    const result = await json("/api/environment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    document.querySelector("#envSaveStatus").textContent = result.environment.openaiConfigured ? "IA salva e ativa nesta sessão." : "Arquivo .env salvo. Falta preencher OPENAI_API_KEY.";
    toast("Configuração de IA/ambiente salva no .env.", "success");
  };
  document.querySelector("#uploadProfileResume").onclick = async () => {
    const activeId = Number(activeProfile.id || 0);
    if (!activeId) return toast("Crie ou ative um perfil antes de enviar currículo.", "error");
    const file = document.querySelector("#profileResumeFileUpload").files?.[0];
    const text = document.querySelector("#profileResumeText").value.trim();
    if (!file && !text) return toast("Envie um arquivo ou cole informações do currículo.", "error");
    const payload = {
      fileName: file?.name || "curriculo.md",
      base64: file ? await fileToBase64(file) : "",
      text
    };
    await json(`/api/profiles/${activeId}/resume`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    toast("Currículo vinculado ao Meu Perfil.", "success");
    await settings();
  };
  syncCode();
}

async function sourcesPage() {
  const data = await json("/api/sources");
  const rows = data.sources || [];
  const totalApplications = rows.reduce((sum, row) => sum + Number(row.applications || 0), 0);
  const totalSelected = rows.reduce((sum, row) => sum + Number(row.selected || 0), 0);
  const totalHighSalary = rows.reduce((sum, row) => sum + Number(row.salaryAtOrAboveTarget || 0), 0);
  app.innerHTML = `<section class="page-panel source-page">
    <div class="page-title-row">
      <div><span class="eyebrow">Fontes</span><h2>Onde as oportunidades e os retornos acontecem</h2><p>Compare volume, qualidade salarial e resposta dos canais antes de concentrar suas candidaturas.</p></div>
      <div class="toolbar-actions"><button data-tab="profile">Ajustar currículo</button><button id="sourceScan" class="primary">Buscar novas vagas</button></div>
    </div>
    <div class="kpi-grid compact source-kpis">
      ${metricCard("Sites monitorados", rows.length, "Fontes com dados no radar", "blue")}
      ${metricCard("Candidaturas reais", totalApplications, "Enviadas por todas as fontes", "success")}
      ${metricCard("Avanços", totalSelected, "Selecionadas para nova fase", "gold")}
      ${metricCard("Salário-base ≥ R$ 3 mil", totalHighSalary, "Anúncios com base mínima confirmada", "violet")}
    </div>
    <div class="focus-band">
      <div><span class="eyebrow">Foco do perfil</span><h3>Vagas priorizadas</h3></div>
      <div class="focus-list">${(data.focus || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    </div>
    <div class="filter-line"><label>Filtrar fonte<input id="sourceFilter" placeholder="InfoJobs, LinkedIn, Gupy..."></label></div>
    <div id="sourceGrid" class="source-grid"></div>
  </section>
  <section class="page-panel agency-directory">
    <div class="section-head"><div><span class="eyebrow">Recrutamento</span><h3>Agências e portais confiáveis</h3></div><span class="data-caption">Curitiba e região</span></div>
    <div class="agency-grid">${(data.agencies || []).map((agency) => `<article class="agency-row">
      <div><strong>${escapeHtml(agency.name)}</strong><small>${escapeHtml(agency.sector)} · ${escapeHtml(agency.city)}/${escapeHtml(agency.state)}</small><p>${escapeHtml(agency.notes)}</p></div>
      <a class="action" href="${escapeHtml(agency.website)}" target="_blank" rel="noreferrer">Abrir site</a>
    </article>`).join("")}</div>
  </section>`;

  const renderSources = () => {
    const query = document.querySelector("#sourceFilter").value.trim().toLowerCase();
    const visible = rows.filter((row) => String(row.source || "").toLowerCase().includes(query));
    document.querySelector("#sourceGrid").innerHTML = visible.map((row) => `<article class="source-card">
      <div class="source-card-head"><div><span class="source-initial">${escapeHtml(String(row.source || "?").slice(0, 2).toUpperCase())}</span><strong>${escapeHtml(row.source)}</strong></div><span class="quality-score">Nota ${row.averageFit || 0}</span></div>
      <div class="source-card-metrics">
        <div><span>Vagas</span><strong>${row.jobs || 0}</strong></div>
        <div><span>Candidaturas</span><strong>${row.applications || 0}</strong></div>
        <div><span>Avanços</span><strong>${row.selected || 0}</strong></div>
        <div><span>Recusas</span><strong>${row.rejected || 0}</strong></div>
      </div>
      <div class="source-card-foot">
        <span>${row.salaryAtOrAboveTarget || 0} com base ≥ R$ 3 mil</span>
        <strong>${row.responseRate || 0}% de retorno</strong>
      </div>
    </article>`).join("") || `<div class="empty-state"><h3>Nenhuma fonte encontrada</h3><p>Tente outro nome.</p></div>`;
  };
  renderSources();
  document.querySelector("#sourceFilter").addEventListener("input", renderSources);
  document.querySelector("#sourceScan").onclick = () => runScanAndRefresh("sources");
}

function environmentStatusItem(label, configured, detail) {
  return `<div class="integration-status-item"><span class="status-dot ${configured ? "online" : "offline"}"></span><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(detail)}</small></div><span class="state-chip ${configured ? "success" : "warning"}">${configured ? "Ativo" : "Pendente"}</span></div>`;
}

async function settingsV3() {
  const [data, env, portableExport, gmail] = await Promise.all([
    json("/api/settings"),
    json("/api/environment"),
    json("/api/settings/export?scope=github"),
    json("/api/gmail/status")
  ]);
  const envLocked = Boolean(env.managedExternally || currentUser?.role !== "admin");
  const careerLevels = getPath(data, "jobSearchPreferences.careerLevels", {});
  const workStyles = getPath(data, "jobSearchPreferences.workStyles", {});
  const schedules = getPath(data, "jobSearchPreferences.schedulePreferences", {});
  const contracts = getPath(data, "jobSearchPreferences.contractTypes", {});
  const education = getPath(data, "jobSearchPreferences.educationFilters", {});
  const sources = getPath(data, "sources", {});
  const tracks = getPath(data, "careerTracks", {});
  const automationEnabled = Boolean(data.agent.enabled) && !Boolean(data.agent.paused) && Boolean(getPath(data, "applications.autoApply"));

  app.innerHTML = `<div class="page-stack settings-v3">
    <section class="page-intro settings-intro-v3">
      <div><span class="eyebrow">CONFIGURAÇÃO ÚNICA</span><h2>Defina como o Ápice trabalha por você</h2><p>Cada escolha aparece uma única vez e é salva na sua conta, tanto local quanto online.</p></div>
      <div class="page-actions"><span class="save-indicator" id="settingsSaveIndicator"><i></i><span>Configuração carregada</span></span><button id="copyPortableSettingsV3" class="button secondary">${icon("copy")} Copiar configuração</button><button id="saveSettingsV3" class="button primary">${icon("save")} Salvar agora</button></div>
    </section>

    <div class="settings-layout-v3">
      <aside class="settings-index">
        <span>SEÇÕES</span>
        <button data-jump="settingsGoals"><b>01</b> Objetivos</button>
        <button data-jump="settingsCompatibility"><b>02</b> Compatibilidade</button>
        <button data-jump="settingsSalary"><b>03</b> Remuneração</button>
        <button data-jump="settingsSources"><b>04</b> Fontes</button>
        <button data-jump="settingsAutomation"><b>05</b> Automação</button>
        <button data-jump="settingsIntegrations"><b>06</b> IA e integrações</button>
        <button data-jump="settingsSafety"><b>07</b> Proteções</button>
        <button data-jump="settingsSync"><b>08</b> Sincronização</button>
      </aside>

      <div class="settings-content-v3">
        <section class="settings-section-v3" id="settingsGoals">
          <span class="section-number">01</span>
          <div class="settings-section-content">
            <div class="section-heading-row"><div><h3>Objetivos profissionais</h3><p>Cargos e trilhas usados para encontrar e classificar vagas.</p></div><span class="soft-badge">${getPath(data, "jobSearchPreferences.targetRoles", []).length} cargos</span></div>
            ${textareaField("Cargos desejados, um por linha", "jobSearchPreferences.targetRoles", getPath(data, "jobSearchPreferences.targetRoles", []), "Use nomes específicos; eles têm maior peso na nota de aderência.")}
            ${checkboxGrid("Trilhas de carreira", "careerTracks", tracks)}
            ${checkboxGrid("Níveis de cargo", "jobSearchPreferences.careerLevels", careerLevels)}
          </div>
        </section>

        <section class="settings-section-v3" id="settingsCompatibility">
          <span class="section-number">02</span>
          <div class="settings-section-content">
            <div class="section-heading-row"><div><h3>Local, jornada e compatibilidade</h3><p>Defina onde, como e em quais condições deseja trabalhar.</p></div></div>
            <div class="form-grid">
              ${textareaField("Locais preferidos, um por linha", "jobSearchPreferences.locations.preferred", getPath(data, "jobSearchPreferences.locations.preferred", []))}
              ${textareaField("Estados aceitos, uma sigla por linha", "jobSearchPreferences.locations.acceptedStates", getPath(data, "jobSearchPreferences.locations.acceptedStates", []))}
            </div>
            ${checkboxGrid("Modelo e deslocamento", "jobSearchPreferences.workStyles", workStyles)}
            ${checkboxGrid("Horários e escalas", "jobSearchPreferences.schedulePreferences", schedules)}
            ${checkboxGrid("Tipos de contrato", "jobSearchPreferences.contractTypes", contracts)}
            <details class="advanced-panel-v3"><summary>Formação e requisitos adicionais ${icon("chevron-down")}</summary>${checkboxGrid("Formação aceita", "jobSearchPreferences.educationFilters", education)}${checkboxGrid("CNH e veículo", "jobSearchPreferences.driverLicenseFilters", getPath(data, "jobSearchPreferences.driverLicenseFilters", {}))}</details>
          </div>
        </section>

        <section class="settings-section-v3" id="settingsSalary">
          <span class="section-number">03</span>
          <div class="settings-section-content">
            <div class="section-heading-row"><div><h3>Remuneração mínima e desejada</h3><p>O Ápice considera salário-base; benefícios e bonificações ficam separados.</p></div><span class="soft-badge">BRL</span></div>
            <div class="salary-settings-grid">
              <div><span>CLT mensal</span>${numberInput("Mínimo", "salaryPreferences.salaryByContractType.clt.minimumMonthly", getPath(data, "salaryPreferences.salaryByContractType.clt.minimumMonthly"))}${numberInput("Desejado", "salaryPreferences.salaryByContractType.clt.desiredMonthly", getPath(data, "salaryPreferences.salaryByContractType.clt.desiredMonthly"))}${numberInput("Excelente", "salaryPreferences.salaryByContractType.clt.excellentMonthly", getPath(data, "salaryPreferences.salaryByContractType.clt.excellentMonthly"))}</div>
              <div><span>PJ mensal</span>${numberInput("Mínimo", "salaryPreferences.salaryByContractType.pj.minimumMonthly", getPath(data, "salaryPreferences.salaryByContractType.pj.minimumMonthly"))}${numberInput("Desejado", "salaryPreferences.salaryByContractType.pj.desiredMonthly", getPath(data, "salaryPreferences.salaryByContractType.pj.desiredMonthly"))}${numberInput("Excelente", "salaryPreferences.salaryByContractType.pj.excellentMonthly", getPath(data, "salaryPreferences.salaryByContractType.pj.excellentMonthly"))}</div>
              <div><span>Freela por diária</span>${numberInput("Mínimo", "salaryPreferences.salaryByContractType.freelancer.minimumDaily", getPath(data, "salaryPreferences.salaryByContractType.freelancer.minimumDaily"))}${numberInput("Desejado", "salaryPreferences.salaryByContractType.freelancer.desiredDaily", getPath(data, "salaryPreferences.salaryByContractType.freelancer.desiredDaily"))}${numberInput("Excelente", "salaryPreferences.salaryByContractType.freelancer.excellentDaily", getPath(data, "salaryPreferences.salaryByContractType.freelancer.excellentDaily"))}</div>
            </div>
            <div class="choice-grid compact-choices">
              ${settingToggle("Recusar abaixo do mínimo", "salaryPreferences.rejectBelowMinimum", getPath(data, "salaryPreferences.rejectBelowMinimum"), "Remove oportunidades que informem salário-base inferior ao mínimo.")}
              ${settingToggle("Preferir salário informado", "salaryPreferences.preferSalaryInformed", getPath(data, "salaryPreferences.preferSalaryInformed"), "Dá prioridade a anúncios transparentes sobre remuneração.")}
              ${settingToggle("Recusar vaga sem salário informado", "salaryPreferences.rejectWithoutSalary", getPath(data, "salaryPreferences.rejectWithoutSalary"), "Remove anúncios que não informem o salário-base. Deixe desativado para analisá-los com um aviso de transparência.")}
            </div>
            ${textareaField("Resposta padrão de pretensão CLT", "salaryPreferences.salaryExpectation.defaultCLT", getPath(data, "salaryPreferences.salaryExpectation.defaultCLT"))}
          </div>
        </section>

        <section class="settings-section-v3" id="settingsSources">
          <span class="section-number">04</span>
          <div class="settings-section-content">
            <div class="section-heading-row"><div><h3>Fontes de vagas</h3><p>Ative os canais que devem alimentar seu radar. Links finais têm prioridade sobre páginas de pesquisa.</p></div><button data-tab="sources" class="text-button">Ver desempenho das fontes ${icon("arrow-right")}</button></div>
            ${checkboxGrid("Sites, ATS e alertas", "sources", sources)}
            <div class="source-priority-note">${icon("shield")}<p><strong>Regra de qualidade</strong><span>Google pode ser usado para descobrir anúncios, mas o Ápice só mostra o endereço final da vaga quando houver um link individual válido.</span></p></div>
          </div>
        </section>

        <section class="settings-section-v3" id="settingsAutomation">
          <span class="section-number">05</span>
          <div class="settings-section-content">
            <div class="section-heading-row"><div><h3>Busca e candidatura automatizadas</h3><p>Escolha o ritmo e até onde a IA pode avançar depois da sua autorização.</p></div><span class="status-pill ${automationEnabled ? "online" : "limited"}"><i></i>${automationEnabled ? "Automação ativa" : "Modo assistido"}</span></div>
            <div class="automation-preset">
              <span>${icon("wand")}</span><div><strong>Fluxo recomendado</strong><p>Você aprova a vaga, autoriza a IA e o Ápice prepara todos os campos permitidos. Login, CAPTCHA e confirmações exigidas pelo site continuam sob seu controle.</p></div><button id="enableRecommendedAutomation" class="button primary">Aplicar configuração recomendada</button>
            </div>
            <div class="form-grid four-columns">
              ${numberInput("Vagas por busca", "agent.maxJobsPerRun", getPath(data, "agent.maxJobsPerRun"))}
              ${numberInput("Candidaturas por dia", "strategy.maxApplicationsPerDay", getPath(data, "strategy.maxApplicationsPerDay"))}
              ${numberInput("Nota para preparar", "strategy.onlyPrepareAboveScore", getPath(data, "strategy.onlyPrepareAboveScore"))}
              ${numberInput("Nota para priorizar", "strategy.onlyApplyAboveScore", getPath(data, "strategy.onlyApplyAboveScore"))}
            </div>
            <div class="choice-grid">
              ${settingToggle("Agente ativo", "agent.enabled", getPath(data, "agent.enabled"), "Permite buscas, preparação e atualização do painel.")}
              ${settingToggle("Pausar temporariamente", "agent.paused", getPath(data, "agent.paused"), "Interrompe novas rotinas sem apagar dados ou preferências.")}
              ${settingToggle("Preparar candidaturas", "applications.prepareApplications", getPath(data, "applications.prepareApplications"), "Monta respostas, currículo e próximos passos para vagas autorizadas.")}
              ${settingToggle("Candidatura automática permitida", "applications.autoApply", getPath(data, "applications.autoApply"), "Libera apenas integrações e canais oficialmente permitidos.")}
              ${settingToggle("Preencher formulários", "applications.autoFillFormsWhenAllowed", getPath(data, "applications.autoFillFormsWhenAllowed"), "Prepara campos no navegador para revisão.")}
              ${settingToggle("Perguntar e memorizar", "applications.askAndRememberMissingFields", getPath(data, "applications.askAndRememberMissingFields"), "Pergunta uma vez quando faltar um dado e reutiliza a resposta aprovada.")}
              ${settingToggle("Autofill no navegador", "applications.allowBrowserAutofill", getPath(data, "applications.allowBrowserAutofill"), "Ativa o comando Preencher com Ápice na página oficial.")}
              ${settingToggle("LinkedIn somente assistido", "applications.allowLinkedInSearchOnly", getPath(data, "applications.allowLinkedInSearchOnly"), "Localiza e prepara dados; o envio permanece na sua conta do LinkedIn.")}
            </div>
          </div>
        </section>

        <section class="settings-section-v3" id="settingsIntegrations">
          <span class="section-number">06</span>
          <div class="settings-section-content">
            <div class="section-heading-row"><div><h3>IA e integrações</h3><p>Confira os serviços que dão inteligência e acompanhamento ao agente.</p></div></div>
            <div class="integration-status-grid">
              ${environmentStatusItem("OpenAI", env.openaiConfigured, env.openaiConfigured ? env.openaiModel : "Adicione OPENAI_API_KEY")}
              ${environmentStatusItem("Gemini", env.geminiConfigured, env.geminiConfigured ? env.geminiModel : "Adicione GEMINI_API_KEY")}
              ${environmentStatusItem("Gmail", gmail.connected, gmail.connected ? gmail.email || "Conta autorizada" : "Reconecte a conta Google")}
              ${environmentStatusItem("Google Search", env.googleSearchConfigured, env.googleSearchConfigured ? "Busca direta configurada" : "API de pesquisa ainda não configurada")}
            </div>
            <div class="integration-actions"><button data-tab="accounts" class="button secondary">${icon("lock")} Agências conectadas</button><button id="syncSettingsGmail" class="button secondary">${icon("refresh")} Atualizar Gmail agora</button></div>
            <details class="advanced-panel-v3" ${envLocked ? "" : "open"}><summary>Configuração técnica do ambiente ${icon("chevron-down")}</summary>
              ${envLocked ? `<div class="note"><strong>Ambiente online protegido</strong><p>Chaves de IA e Gmail são alteradas nas variáveis de ambiente da hospedagem, nunca no GitHub.</p></div>` : `<div class="form-grid">
                <label>Chave OpenAI<input id="envOpenaiKeyV3" type="password" placeholder="Manter atual se ficar vazio"></label>
                <label>Modelo OpenAI<input id="envOpenaiModelV3" value="${escapeHtml(env.openaiModel || "")}"></label>
                <label>Chave Gemini<input id="envGeminiKeyV3" type="password" placeholder="Manter atual se ficar vazio"></label>
                <label>Modelo Gemini<input id="envGeminiModelV3" value="${escapeHtml(env.geminiModel || "")}"></label>
                <label>Google Search API Key<input id="envGoogleKeyV3" type="password" placeholder="Manter atual se ficar vazio"></label>
                <label>Google Search Engine ID<input id="envGoogleCxV3" placeholder="CX da pesquisa" value=""></label>
                <button id="saveEnvironmentV3" class="button primary">${icon("save")} Salvar ambiente</button>
              </div>`}
            </details>
          </div>
        </section>

        <section class="settings-section-v3" id="settingsSafety">
          <span class="section-number">07</span>
          <div class="settings-section-content">
            <div class="section-heading-row"><div><h3>Proteções permanentes</h3><p>Estas regras preservam seu perfil, suas contas e a confiabilidade do histórico.</p></div>${icon("shield")}</div>
            <div class="safety-guard-grid">
              <div>${icon("badge-check")}<p><strong>Dados verdadeiros</strong><small>Nenhuma experiência, formação, idioma ou certificado é inventado.</small></p></div>
              <div>${icon("lock")}<p><strong>Contas protegidas</strong><small>O agente não contorna CAPTCHA, SMS, login ou bloqueios da plataforma.</small></p></div>
              <div>${icon("clipboard-check")}<p><strong>Envio auditável</strong><small>Uma vaga só conta como candidatada depois de confirmação real.</small></p></div>
              <div>${icon("circle-help")}<p><strong>Perguntas objetivas</strong><small>Quando faltar informação, o sistema explica o campo e salva sua resposta aprovada.</small></p></div>
            </div>
            <div class="choice-grid compact-choices">
              ${settingToggle("Registrar todas as ações", "safety.logEveryAction", getPath(data, "safety.logEveryAction"), "Mantém uma trilha de auditoria para diagnóstico e transparência.")}
              ${settingToggle("Mascarar dados nos logs", "safety.maskSensitiveDataInLogs", getPath(data, "safety.maskSensitiveDataInLogs"), "Evita expor documentos e dados pessoais em registros técnicos.")}
              ${settingToggle("Criar lembretes de retorno", "notifications.createFollowUpReminders", getPath(data, "notifications.createFollowUpReminders"), "Sinaliza candidaturas sem resposta após o período configurado.")}
            </div>
          </div>
        </section>

        <section class="settings-section-v3" id="settingsSync">
          <span class="section-number">08</span>
          <div class="settings-section-content">
            <div class="section-heading-row"><div><h3>Sincronização e portabilidade</h3><p>Leve preferências seguras entre o computador, a hospedagem e o GitHub.</p></div>${icon("copy")}</div>
            <div class="sync-grid">
              <div class="sync-panel"><span>${icon("copy")}</span><div><strong>Configuração segura</strong><p>Sem nome, telefone, documentos, currículo ou chaves. Pode ser versionada no GitHub.</p></div><button id="downloadPortableSettingsV3" class="button secondary">${icon("download")} Baixar JSON</button></div>
              <div class="sync-panel"><span>${icon("upload")}</span><div><strong>Importar escolhas</strong><p>Aplica cargos, locais, fontes, salários e regras em outra instalação.</p></div><label class="button secondary">${icon("upload")} Escolher arquivo<input id="settingsImportFileV3" type="file" accept="application/json,.json"></label></div>
            </div>
            <details class="code-panel"><summary>Código que reflete todas as escolhas ${icon("chevron-down")}</summary><textarea id="settingsCodeV3" class="code-output" spellcheck="false"></textarea></details>
            <textarea id="portableSettingsCodeV3" class="code-output portable-code" spellcheck="false">${escapeHtml(JSON.stringify(portableExport, null, 2))}</textarea>
            <div class="danger-zone">
              <span>${icon("trash")}</span><div><strong>Começar candidaturas do zero</strong><p>Apaga candidaturas, tentativas e retornos vinculados desta conta. Currículo, perfil, preferências, vagas e Gmail permanecem.</p></div>
              <label>Digite ZERAR CANDIDATURAS<input id="resetApplicationsPhrase" autocomplete="off"></label>
              <button id="resetApplicationsV3" class="button danger" disabled>${icon("trash")} Zerar candidaturas</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>`;

  let currentSettings = structuredClone(data);
  let saveTimer = 0;
  const code = document.querySelector("#settingsCodeV3");
  const portableCode = document.querySelector("#portableSettingsCodeV3");
  const indicator = document.querySelector("#settingsSaveIndicator");
  const readValue = (element) => {
    if (element.type === "checkbox") return element.checked;
    if (element.type === "number") return Number(element.value || 0);
    if (element.tagName === "TEXTAREA") {
      const original = getPath(currentSettings, element.dataset.path);
      return Array.isArray(original) ? element.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : element.value;
    }
    return element.value;
  };
  const syncCode = () => {
    document.querySelectorAll("[data-path]").forEach((element) => setPath(currentSettings, element.dataset.path, readValue(element)));
    code.value = JSON.stringify(currentSettings, null, 2);
  };
  const setSaveState = (label, state = "") => {
    indicator.className = `save-indicator ${state}`;
    indicator.querySelector("span").textContent = label;
  };
  const saveCurrentSettings = async (feedback = false) => {
    syncCode();
    await json("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: code.value });
    const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    setSaveState(`Salvo às ${time}`, "saved");
    if (feedback) toast("Configurações salvas nesta conta.", "success");
  };
  const scheduleSave = () => {
    setSaveState("Alterações pendentes", "pending");
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveCurrentSettings(false).catch((error) => setSaveState(error.message, "error")), 900);
  };
  const downloadJson = (value, fileNameValue) => {
    const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileNameValue;
    link.click();
    URL.revokeObjectURL(url);
  };
  const refreshPortable = async () => {
    await saveCurrentSettings(false);
    const exported = await json("/api/settings/export?scope=github");
    portableCode.value = JSON.stringify(exported, null, 2);
    return exported;
  };

  document.querySelectorAll("[data-path]").forEach((element) => element.addEventListener("input", () => { syncCode(); scheduleSave(); }));
  document.querySelectorAll("[data-jump]").forEach((button) => button.addEventListener("click", () => document.querySelector(`#${button.dataset.jump}`)?.scrollIntoView({ behavior: "smooth", block: "start" })));
  document.querySelector("#saveSettingsV3").onclick = () => saveCurrentSettings(true);
  document.querySelector("#enableRecommendedAutomation").onclick = async () => {
    setPath(currentSettings, "agent.enabled", true);
    setPath(currentSettings, "agent.paused", false);
    setPath(currentSettings, "agent.dryRun", false);
    setPath(currentSettings, "applications.prepareApplications", true);
    setPath(currentSettings, "applications.autoApply", true);
    setPath(currentSettings, "applications.autoApplyWhenAllowed", true);
    setPath(currentSettings, "applications.autoFillFormsWhenAllowed", true);
    setPath(currentSettings, "applications.askAndRememberMissingFields", true);
    setPath(currentSettings, "applications.allowBrowserAutofill", true);
    setPath(currentSettings, "applications.requireApprovalBeforeApply", true);
    setPath(currentSettings, "applications.neverMassApplyWithoutApproval", true);
    await json("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(currentSettings) });
    toast("Automação recomendada ativada. Aprovação e autorização continuam obrigatórias.", "success");
    await settingsV3();
  };
  document.querySelector("#copyPortableSettingsV3").onclick = async () => {
    const exported = await refreshPortable();
    try { await navigator.clipboard.writeText(JSON.stringify(exported, null, 2)); } catch { portableCode.select(); document.execCommand("copy"); }
    toast("Configuração segura copiada.", "success");
  };
  document.querySelector("#downloadPortableSettingsV3").onclick = async () => downloadJson(await refreshPortable(), "apice-preferencias-github.json");
  document.querySelector("#settingsImportFileV3").onchange = async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      await json("/api/settings/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
      toast("Configuração importada.", "success");
      await settingsV3();
    } catch (error) { toast(`Não foi possível importar: ${escapeHtml(error.message)}`, "error"); }
  };
  document.querySelector("#syncSettingsGmail").onclick = async () => {
    const result = await json("/api/gmail/sync", { method: "POST" });
    toast(`${result.matched || 0} retorno(s) atualizados.`, "success");
  };
  document.querySelector("#saveEnvironmentV3")?.addEventListener("click", async () => {
    await json("/api/environment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      openaiApiKey: document.querySelector("#envOpenaiKeyV3").value,
      openaiModel: document.querySelector("#envOpenaiModelV3").value,
      geminiApiKey: document.querySelector("#envGeminiKeyV3").value,
      geminiModel: document.querySelector("#envGeminiModelV3").value,
      googleSearchApiKey: document.querySelector("#envGoogleKeyV3").value,
      googleSearchEngineId: document.querySelector("#envGoogleCxV3").value
    }) });
    toast("Ambiente atualizado.", "success");
    await settingsV3();
  });
  document.querySelector("#resetApplicationsPhrase").addEventListener("input", (event) => {
    document.querySelector("#resetApplicationsV3").disabled = event.currentTarget.value.trim() !== "ZERAR CANDIDATURAS";
  });
  document.querySelector("#resetApplicationsV3").onclick = async () => {
    if (!confirm("Apagar todo o histórico de candidaturas desta conta e devolver as vagas ao início?")) return;
    const result = await json("/api/applications/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: document.querySelector("#resetApplicationsPhrase").value.trim() }) });
    toast(`${result.cleared.applications} candidatura(s) apagada(s).`, "success");
    await load("dashboard");
  };
  code.addEventListener("input", () => {
    try { currentSettings = JSON.parse(code.value); setSaveState("Código válido · salvar para aplicar", "pending"); } catch { setSaveState("JSON inválido", "error"); }
  });
  syncCode();
  refreshIcons(app);
}

function monthlySalaryValue(value) {
  const text = String(value || "").toLowerCase();
  if (!text || /por hora|hora|di[aá]ria|por dia|evento|freela/.test(text)) return 0;
  const matches = text.match(/\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?/g) || [];
  const values = matches.map((item) => Number(item.replace(/\./g, "").replace(",", "."))).filter((item) => Number.isFinite(item) && item >= 500);
  return values.length ? Math.min(...values) : 0;
}

async function profilePage() {
  const [profileData, careerData] = await Promise.all([json("/api/profiles"), json("/api/career-profile")]);
  const active = profileData.active || {};
  const memory = await json(`/api/answer-memory?profileId=${active.id || 0}`);
  const completion = profileCompletion(active);
  const missing = [
    ["Nome completo", active.name],
    ["E-mail", active.email],
    ["Telefone", active.phone],
    ["LinkedIn", active.linkedin],
    ["Resumo profissional", active.summary],
    ["Currículo", active.resume_file]
  ].filter(([, value]) => !String(value || "").trim()).map(([label]) => label);

  app.innerHTML = `<div class="page-stack profile-v3">
    <section class="page-intro">
      <div><span class="eyebrow">IDENTIDADE PROFISSIONAL</span><h2>Seu perfil de candidatura</h2><p>O Ápice usa somente estes dados e seu currículo oficial para preparar formulários, respostas e apresentações.</p></div>
      <div class="page-actions"><button data-tab="accounts" class="button secondary">${icon("lock")} Agências conectadas</button><button data-tab="settings" class="button primary">${icon("sliders")} Preferências de busca</button></div>
    </section>

    <section class="profile-score-band">
      <div class="completion-ring compact" style="--completion:${completion}"><strong>${completion}%</strong><span>completo</span></div>
      <div><span class="section-kicker">PRONTIDÃO DO PERFIL</span><h3>${missing.length ? `${missing.length} ponto(s) para completar` : "Perfil pronto para candidaturas"}</h3><p>${missing.length ? `Ainda faltam: ${escapeHtml(missing.join(", "))}.` : "Seus dados essenciais, currículo e memória já estão disponíveis para a IA."}</p></div>
      <div class="profile-score-stats"><div><strong>${memory.answers?.length || 0}</strong><span>respostas memorizadas</span></div><div><strong>${profileData.profiles?.length || 0}</strong><span>perfil(is)</span></div><div><strong>${careerData.targetRoles?.length || 0}</strong><span>cargos-alvo</span></div></div>
    </section>

    <div class="profile-editor-grid">
      <section class="surface profile-editor">
        <div class="section-heading-row"><div><span class="section-kicker">DADOS PRINCIPAIS</span><h3>${escapeHtml(active.label || active.name || "Perfil ativo")}</h3><p>Edite aqui o que será reutilizado nos formulários.</p></div><span class="status-pill online"><i></i>Perfil ativo</span></div>
        <div class="form-grid profile-form">
          <label>Nome do perfil<input id="activeProfileLabel" value="${escapeHtml(active.label || "Principal")}"></label>
          <label>Nome completo<input id="activeProfileName" value="${escapeHtml(active.name || "")}" autocomplete="name"></label>
          <label>E-mail<input id="activeProfileEmail" type="email" value="${escapeHtml(active.email || "")}" autocomplete="email"></label>
          <label>Telefone<input id="activeProfilePhone" value="${escapeHtml(active.phone || "")}" autocomplete="tel"></label>
          <label class="field-wide">LinkedIn<input id="activeProfileLinkedin" value="${escapeHtml(active.linkedin || "")}" placeholder="https://www.linkedin.com/in/..."></label>
          <label>Cidade<input id="activeProfileCity" value="${escapeHtml(active.city || "")}"></label>
          <label>Estado<input id="activeProfileState" value="${escapeHtml(active.state || "")}"></label>
          <label>País<input id="activeProfileCountry" value="${escapeHtml(active.country || "Brasil")}"></label>
          <label class="field-wide">Resumo profissional<textarea id="activeProfileSummary" rows="7">${escapeHtml(active.summary || "")}</textarea></label>
        </div>
        <div class="form-footer"><span id="profileSaveStatus">Alterações são salvas apenas nesta conta.</span><button id="saveActiveProfile" class="button primary">${icon("save")} Salvar perfil</button></div>
      </section>

      <section class="surface resume-manager">
        <div class="section-heading-row"><div><span class="section-kicker">CURRÍCULO OFICIAL</span><h3>Arquivo usado nas vagas</h3></div>${icon("file-text")}</div>
        <div class="resume-file-card">
          <span>${icon("file-text")}</span>
          <div><strong>${escapeHtml(fileName(active.resume_file || careerData.applicationPositioning?.resumeFile || ""))}</strong><small>${active.resume_file ? "Vinculado ao perfil ativo" : "Envie o currículo principal"}</small></div>
          <span class="state-chip ${active.resume_file ? "success" : "warning"}">${active.resume_file ? "Pronto" : "Pendente"}</span>
        </div>
        <label class="upload-dropzone" for="profileResumeFileUpload">
          ${icon("upload")}<strong>Escolher novo currículo</strong><span>PDF, DOC, DOCX, TXT ou MD</span>
          <input id="profileResumeFileUpload" type="file" accept=".pdf,.doc,.docx,.txt,.md">
        </label>
        <label>Complemento para a IA<textarea id="profileResumeText" rows="6" placeholder="Cole experiências, cursos ou resultados que precisam ser entendidos pela IA."></textarea></label>
        <button id="uploadProfileResumeV3" class="button primary full">${icon("upload")} Atualizar currículo</button>
        <div class="truth-note">${icon("shield")}<p><strong>Base verdadeira</strong><span>O Ápice pode adaptar a apresentação, mas nunca inventa experiência, formação ou competência.</span></p></div>
      </section>
    </div>

    <div class="profile-intelligence-grid">
      <section class="surface strengths-panel">
        <div class="section-heading-row"><div><span class="section-kicker">POSICIONAMENTO</span><h3>Forças que a IA deve destacar</h3></div>${icon("sparkles")}</div>
        <div class="strength-list">${(careerData.strengths || []).slice(0, 8).map((item) => `<div>${icon("check-circle")}<span>${escapeHtml(item)}</span></div>`).join("") || `<div class="empty-mini">Complete seu currículo para gerar forças profissionais.</div>`}</div>
      </section>
      <section class="surface target-role-panel">
        <div class="section-heading-row"><div><span class="section-kicker">CARGOS-ALVO</span><h3>Buscas alinhadas ao currículo</h3></div><button data-tab="settings" class="text-button">Editar ${icon("arrow-right")}</button></div>
        <div class="pill-cloud">${(careerData.targetRoles || []).map((role) => `<span>${escapeHtml(role)}</span>`).join("")}</div>
      </section>
    </div>

    <section class="surface memory-panel">
      <div class="section-heading-row"><div><span class="section-kicker">MEMÓRIA DE CANDIDATURA</span><h3>Respostas que o Ápice já sabe</h3><p>Quando uma vaga pedir algo novo, a resposta aprovada fica disponível para as próximas.</p></div><span class="soft-badge">${memory.answers?.length || 0} respostas</span></div>
      <div class="memory-table">${(memory.answers || []).map((answer) => `<div><span>${escapeHtml(answer.question_text || answer.question_key)}</span><strong>${escapeHtml(answer.answer_text)}</strong><small>${escapeHtml(answer.category || "Geral")}</small></div>`).join("") || `<div class="empty-mini">Nenhuma resposta memorizada. A IA perguntará quando encontrar um campo novo.</div>`}</div>
    </section>

    <section class="surface profiles-manager">
      <div class="section-heading-row"><div><span class="section-kicker">MULTIUSUÁRIO</span><h3>Perfis desta conta</h3><p>Cada pessoa mantém currículo, respostas e candidaturas separados.</p></div><button id="toggleNewProfile" class="button secondary">${icon("plus")} Novo perfil</button></div>
      <div class="profile-card-grid">${(profileData.profiles || []).map((profile) => `<article class="profile-summary-card ${Number(profile.is_active) === 1 ? "active" : ""}">
        <span class="account-avatar">${escapeHtml(initials(profile.name))}</span><div><strong>${escapeHtml(profile.label || profile.name)}</strong><small>${escapeHtml(profile.name)} · ${escapeHtml(profile.email || "e-mail pendente")}</small></div>
        <span class="soft-badge">${profile.memory_count || 0} respostas</span>
        <div class="profile-card-actions">${Number(profile.is_active) === 1 ? `<span class="state-chip success">Ativo</span>` : `<button data-activate-profile="${profile.id}">Ativar</button>`}${(profileData.profiles || []).length > 1 ? `<button class="danger-text" data-delete-profile="${profile.id}" title="Excluir perfil">${icon("trash")}</button>` : ""}</div>
      </article>`).join("")}</div>
      <div id="newProfileForm" class="new-profile-form hidden">
        <div class="form-grid"><label>Nome do perfil<input id="profileLabel" placeholder="Ex.: Perfil principal"></label><label>Nome completo<input id="profileName"></label><label>E-mail<input id="profileEmail" type="email"></label><label>Telefone<input id="profilePhone"></label><label>Cidade<input id="profileCity" value="Curitiba"></label><label>Estado<input id="profileState" value="PR"></label></div>
        <button id="createProfileV3" class="button primary">Criar e ativar perfil</button>
      </div>
    </section>
  </div>`;

  document.querySelector("#saveActiveProfile").onclick = async () => {
    if (!active.id) return toast("Nenhum perfil ativo foi encontrado.", "error");
    const payload = {
      label: document.querySelector("#activeProfileLabel").value,
      name: document.querySelector("#activeProfileName").value,
      email: document.querySelector("#activeProfileEmail").value,
      phone: document.querySelector("#activeProfilePhone").value,
      linkedin: document.querySelector("#activeProfileLinkedin").value,
      city: document.querySelector("#activeProfileCity").value,
      state: document.querySelector("#activeProfileState").value,
      country: document.querySelector("#activeProfileCountry").value,
      summary: document.querySelector("#activeProfileSummary").value,
      resume_file: active.resume_file || "",
      is_active: true
    };
    await json(`/api/profiles/${active.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    toast("Perfil atualizado.", "success");
    await profilePage();
  };
  document.querySelector("#uploadProfileResumeV3").onclick = async () => {
    if (!active.id) return toast("Ative um perfil antes de enviar currículo.", "error");
    const file = document.querySelector("#profileResumeFileUpload").files?.[0];
    const text = document.querySelector("#profileResumeText").value.trim();
    if (!file && !text) return toast("Escolha um arquivo ou informe um complemento.", "info");
    await json(`/api/profiles/${active.id}/resume`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file?.name || "curriculo.md", base64: file ? await fileToBase64(file) : "", text }) });
    toast("Currículo atualizado no perfil ativo.", "success");
    await profilePage();
  };
  document.querySelector("#toggleNewProfile").onclick = () => document.querySelector("#newProfileForm").classList.toggle("hidden");
  document.querySelector("#createProfileV3").onclick = async () => {
    const name = document.querySelector("#profileName").value.trim();
    if (!name) return toast("Informe o nome completo.", "info");
    await json("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      label: document.querySelector("#profileLabel").value || name,
      name,
      email: document.querySelector("#profileEmail").value,
      phone: document.querySelector("#profilePhone").value,
      city: document.querySelector("#profileCity").value,
      state: document.querySelector("#profileState").value,
      country: "Brasil",
      is_active: true
    }) });
    toast("Novo perfil criado e ativado.", "success");
    await profilePage();
  };
  document.querySelectorAll("[data-activate-profile]").forEach((button) => button.addEventListener("click", async () => {
    await json(`/api/profiles/${button.dataset.activateProfile}/activate`, { method: "POST" });
    toast("Perfil ativado.", "success");
    await profilePage();
  }));
  document.querySelectorAll("[data-delete-profile]").forEach((button) => button.addEventListener("click", async () => {
    if (!confirm("Excluir este perfil e as respostas memorizadas dele?")) return;
    await json(`/api/profiles/${button.dataset.deleteProfile}`, { method: "DELETE" });
    toast("Perfil excluído.", "success");
    await profilePage();
  }));
  refreshIcons(app);
}

function stagesForApplication(row) {
  const stages = [];
  const sent = isSentApplication(row);
  const authorized = isAuthorizedApplication(row);
  const needsAttention = Number(row.latest_requires_action || 0) === 1
    || Boolean(String(row.next_action || "").trim())
    || row.application_status === "Aguardando resposta do usuário"
    || ["acao_necessaria", "requer_canal"].includes(String(row.authorization_status || ""));
  if (isAwaitingAuthorization(row)) stages.push("authorization");
  if (!sent && authorized) stages.push("processing");
  if (needsAttention) stages.push("attention");
  if (sent) stages.push("sent");
  if (sent && String(row.pipeline_outcome || "") === "negativa") stages.push("negative");
  if (sent && String(row.pipeline_outcome || "") !== "negativa" && Number(row.pipeline_stage || 1) >= 2) stages.push("positive");
  if (String(row.availability_status || "") === "fechada") stages.push("closed");
  return stages;
}

function showAutomationDrawer(data) {
  document.querySelector("#automationOverlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "automationOverlay";
  overlay.className = "automation-overlay";
  overlay.innerHTML = `<button class="automation-backdrop" data-close-automation aria-label="Fechar assistente"></button>
    <aside class="automation-drawer" role="dialog" aria-modal="true" aria-labelledby="automationTitle">
      <div class="automation-drawer-head">
        <div><span class="section-kicker">ÁPICE IA</span><h2 id="automationTitle">Preparação da candidatura</h2><p>Veja o que foi preenchido, o que falta e qual é o próximo passo real.</p></div>
        <button class="icon-button" data-close-automation aria-label="Fechar">${icon("x")}</button>
      </div>
      <div class="automation-drawer-body">${renderAutomationResult(data)}</div>
    </aside>`;
  app.appendChild(overlay);
  overlay.querySelectorAll("[data-close-automation]").forEach((button) => button.addEventListener("click", () => overlay.remove()));
  refreshIcons(overlay);
}

async function applicationsV3(initialMessage = "") {
  const [rows, gmail] = await Promise.all([json("/api/applications"), json("/api/gmail/status")]);
  const filters = getSavedFilters("applications-v3", { q: "", source: "all", work: "all", availability: "all", minScore: 0, stage: "all" });
  const sources = uniqueSources(rows);
  const workModels = uniqueValues(rows, "work_model");
  const stageLabels = {
    all: "Todas",
    authorization: "Autorizar",
    processing: "IA preparando",
    attention: "Precisa de você",
    sent: "Candidatadas",
    positive: "Avançaram",
    negative: "Não selecionadas",
    closed: "Encerradas"
  };
  const stageCounts = Object.keys(stageLabels).reduce((acc, id) => {
    acc[id] = id === "all" ? rows.length : rows.filter((row) => stagesForApplication(row).includes(id)).length;
    return acc;
  }, {});
  const sentCount = stageCounts.sent || 0;
  const awaitingCount = stageCounts.authorization || 0;
  const attentionCount = stageCounts.attention || 0;
  const positiveCount = stageCounts.positive || 0;
  const gmailTone = gmail.rateLimited ? "limited" : gmail.connected ? "online" : "offline";

  app.innerHTML = `<div class="page-stack applications-v3">
    <section class="page-intro">
      <div><span class="eyebrow">PIPELINE DE CANDIDATURAS</span><h2>Autorize, acompanhe e aja no momento certo</h2><p>Aprovar escolhe a vaga. Autorizar libera a IA. Só um envio confirmado entra no histórico.</p></div>
      <div class="page-actions">
        <span class="status-pill ${gmailTone}"><i></i>Gmail ${gmail.connected ? "conectado" : "desconectado"}</span>
        <button id="syncApplicationsGmail" class="button secondary">${icon("refresh")} Atualizar retornos</button>
        <button id="selectVisibleApplications" class="button secondary">${icon("check")} Selecionar exibidas</button>
        <button id="markSelectedApplicationsV3" class="button secondary" disabled>${icon("check-circle")} Confirmar envios <span id="applicationSentSelectionCount">0</span></button>
        <button id="authorizeApplicationsV3" class="button primary">${icon("wand")} Autorizar IA <span id="applicationSelectionCount">0</span></button>
      </div>
    </section>

    <section class="compact-stat-strip application-stats">
      <button data-application-stage-shortcut="authorization"><strong>${awaitingCount}</strong><span>aguardando autorização</span></button>
      <button data-application-stage-shortcut="processing"><strong>${stageCounts.processing || 0}</strong><span>em preparação</span></button>
      <button data-application-stage-shortcut="sent"><strong>${sentCount}</strong><span>candidaturas reais</span></button>
      <button data-application-stage-shortcut="positive"><strong>${positiveCount}</strong><span>avanços</span></button>
      <button data-application-stage-shortcut="attention"><strong>${attentionCount}</strong><span>precisam de você</span></button>
    </section>

    <div id="applicationActionResult" class="note ${initialMessage ? "" : "hidden"}">${initialMessage}</div>

    <section class="authorization-guide">
      <span>${icon("shield")}</span>
      <div><strong>Automação com rastreabilidade</strong><p>Após sua autorização, o Ápice prepara respostas, reutiliza seu currículo, abre a fonte oficial e informa se concluiu, se falta algum dado ou se o site exige sua intervenção.</p></div>
      <button data-tab="profile" class="text-button">Revisar dados do perfil ${icon("arrow-right")}</button>
    </section>

    <section class="surface pipeline-workbench">
      <div class="stage-tabs application-stage-tabs" id="applicationStageTabsV3">
        ${Object.entries(stageLabels).map(([id, label]) => `<button data-application-stage="${id}" class="${filters.stage === id ? "active" : ""}"><span>${escapeHtml(label)}</span><strong>${stageCounts[id] || 0}</strong></button>`).join("")}
      </div>
      <div class="primary-filter-row application-filter-row">
        <label class="search-field">${icon("search")}<input id="applicationSearchV3" value="${escapeHtml(filters.q)}" placeholder="Buscar vaga, empresa, fonte ou status"></label>
        <label>Fonte<select id="applicationSourceV3">${optionList(sources, filters.source, "Todas as fontes")}</select></label>
        <label>Modelo<select id="applicationWorkV3">${optionList(workModels, filters.work, "Todos")}</select></label>
        <label>Disponibilidade<select id="applicationAvailabilityV3"><option value="all">Todas</option><option value="aberta" ${filters.availability === "aberta" ? "selected" : ""}>Aberta</option><option value="fechada" ${filters.availability === "fechada" ? "selected" : ""}>Fechada</option><option value="indefinida" ${filters.availability === "indefinida" ? "selected" : ""}>Indefinida</option><option value="nao_verificado" ${filters.availability === "nao_verificado" ? "selected" : ""}>Não verificada</option></select></label>
        <label>Nota mínima<input id="applicationMinScoreV3" type="number" min="0" max="100" value="${Number(filters.minScore || 0)}"></label>
        <button id="clearApplicationFiltersV3" class="button ghost">${icon("x")} Limpar</button>
      </div>
    </section>

    <div class="result-heading"><div><strong id="visibleApplicationsCount">0</strong><span>candidaturas exibidas</span></div><div class="result-heading-actions"><button id="checkAvailabilityV3" class="text-button">${icon("activity")} Verificar vagas abertas</button><button data-tab="returns" class="text-button">${icon("history")} Histórico do Gmail</button></div></div>
    <div id="applicationsV3Mount" data-testid="applications-grid"></div>
  </div>`;

  const mount = document.querySelector("#applicationsV3Mount");
  const readFilters = () => ({
    q: document.querySelector("#applicationSearchV3").value.trim(),
    source: document.querySelector("#applicationSourceV3").value,
    work: document.querySelector("#applicationWorkV3").value,
    availability: document.querySelector("#applicationAvailabilityV3").value,
    minScore: Number(document.querySelector("#applicationMinScoreV3").value || 0),
    stage: document.querySelector("#applicationStageTabsV3 button.active")?.dataset.applicationStage || "all"
  });
  const updateSelection = () => {
    const selected = [...document.querySelectorAll("#applicationsV3Mount .application-check:checked")];
    const authorizable = selected.filter((input) => input.closest(".application-card")?.querySelector("[data-authorize]")).length;
    document.querySelector("#applicationSelectionCount").textContent = String(selected.length);
    document.querySelector("#applicationSentSelectionCount").textContent = String(selected.length);
    document.querySelector("#authorizeApplicationsV3").disabled = !selected.length || !authorizable;
    document.querySelector("#markSelectedApplicationsV3").disabled = !selected.length;
  };
  const renderRows = () => {
    const active = readFilters();
    saveFilters("applications-v3", active);
    const visible = rows.filter((row) => {
      if (!includesSearch(row, active.q)) return false;
      if (active.source !== "all" && sourceName(row) !== active.source) return false;
      if (active.work !== "all" && String(row.work_model) !== active.work) return false;
      if (active.availability !== "all" && String(row.availability_status || "nao_verificado") !== active.availability) return false;
      if (Number(row.fit_score || 0) < active.minScore) return false;
      if (active.stage !== "all" && !stagesForApplication(row).includes(active.stage)) return false;
      return true;
    });
    document.querySelector("#visibleApplicationsCount").textContent = String(visible.length);
    mount.innerHTML = visible.length
      ? `<div class="opportunity-grid">${visible.map((row) => applicationCard(row, isSentApplication(row) ? "sent" : "approved")).join("")}</div>`
      : rows.length
        ? `<div class="empty-state"><span>${icon("filter")}</span><h3>Nenhuma candidatura nesta etapa</h3><p>Ajuste os filtros ou escolha outra etapa do pipeline.</p></div>`
        : `<div class="empty-state fresh-start"><span>${icon("briefcase")}</span><h3>Seu pipeline está pronto para começar</h3><p>Você ainda não aprovou nenhuma vaga. Vá ao radar, escolha oportunidades e elas aparecerão aqui aguardando sua autorização.</p><button data-tab="jobs" class="button primary">Ver vagas disponíveis ${icon("arrow-right")}</button></div>`;
    mount.querySelectorAll(".application-check").forEach((input) => input.addEventListener("change", updateSelection));
    updateSelection();
    refreshIcons(mount);
  };

  document.querySelectorAll("[data-application-stage]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-application-stage]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderRows();
  }));
  document.querySelectorAll("[data-application-stage-shortcut]").forEach((button) => button.addEventListener("click", () => {
    const target = document.querySelector(`[data-application-stage="${button.dataset.applicationStageShortcut}"]`);
    target?.click();
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }));
  document.querySelectorAll("#applicationSearchV3, #applicationSourceV3, #applicationWorkV3, #applicationAvailabilityV3, #applicationMinScoreV3").forEach((element) => element.addEventListener("input", renderRows));
  document.querySelector("#clearApplicationFiltersV3").onclick = () => {
    localStorage.removeItem(filterKey("applications-v3"));
    applicationsV3(initialMessage);
  };
  document.querySelector("#selectVisibleApplications").onclick = () => {
    const checks = [...document.querySelectorAll("#applicationsV3Mount .application-check")];
    const shouldSelect = checks.some((input) => !input.checked);
    checks.forEach((input) => input.checked = shouldSelect);
    updateSelection();
  };
  document.querySelector("#authorizeApplicationsV3").onclick = async () => {
    const ids = [...document.querySelectorAll("#applicationsV3Mount .application-check:checked")]
      .filter((input) => input.closest(".application-card")?.querySelector("[data-authorize]"))
      .map((input) => Number(input.value)).filter(Boolean);
    if (!ids.length) return toast("Selecione candidaturas que estejam aguardando autorização.", "info");
    try {
      const data = await json("/api/applications/authorize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      toast(`${data.authorized} candidatura(s) autorizada(s).`, "success");
      await applicationsV3(`<strong>IA autorizada para ${data.authorized} candidatura(s).</strong><p>O resultado detalhado está aberto ao lado.</p>`);
      showAutomationDrawer(data);
    } catch (error) {
      toast(escapeHtml(error.message), "error");
    }
  };
  document.querySelector("#markSelectedApplicationsV3").onclick = async () => {
    const ids = [...document.querySelectorAll("#applicationsV3Mount .application-check:checked")]
      .map((input) => Number(input.value)).filter(Boolean);
    if (!ids.length) return toast("Selecione as candidaturas com envio confirmado.", "info");
    try {
      const data = await json("/api/applications/mark-sent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      toast(`${data.sent} candidatura(s) confirmada(s) no histórico.`, "success");
      await applicationsV3(`<strong>${data.sent} candidatura(s) confirmada(s).</strong><p>O painel agora acompanha os retornos reais dessas vagas.</p>`);
    } catch (error) {
      toast(escapeHtml(error.message), "error");
    }
  };
  document.querySelector("#checkAvailabilityV3").onclick = async () => {
    const ids = [...document.querySelectorAll("#applicationsV3Mount .application-check:checked")].map((input) => Number(input.value)).filter(Boolean);
    const result = await json("/api/applications/check-availability", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    toast(`${result.checked} vaga(s) verificadas: ${result.open} abertas e ${result.closed} encerradas.`, "success");
    await applicationsV3();
  };
  document.querySelector("#syncApplicationsGmail").onclick = async () => {
    try {
      const result = await json("/api/gmail/sync", { method: "POST" });
      toast(`${result.matched || 0} retorno(s) vinculado(s) às candidaturas.`, "success");
      await applicationsV3();
    } catch (error) {
      toast(escapeHtml(error.message), "error");
    }
  };
  renderRows();
  refreshIcons(app);
}

async function jobsV3(initialMessage = "") {
  const rows = await json("/api/jobs");
  const filters = getSavedFilters("jobs-v3", {
    q: "",
    source: "all",
    work: "all",
    status: "all",
    minScore: 0,
    minSalary: 0,
    directOnly: false,
    hideDuplicates: true,
    sort: "fit"
  });
  const sources = uniqueSources(rows);
  const workModels = uniqueValues(rows, "work_model");
  const statuses = uniqueValues(rows, "status");
  const directCount = rows.filter(hasDirectJobUrl).length;
  const recommendedCount = rows.filter((row) => Number(row.fit_score || 0) >= 85).length;
  const salaryCount = rows.filter((row) => monthlySalaryValue(row.salary) > 0).length;

  app.innerHTML = `<div class="page-stack jobs-v3">
    <section class="page-intro">
      <div><span class="eyebrow">RADAR DE OPORTUNIDADES</span><h2>Escolha as vagas com maior potencial</h2><p>As vagas aprovadas saem desta tela e entram em Candidaturas aguardando sua autorização.</p></div>
      <div class="page-actions">
        <button id="scanJobsV3" class="button secondary">${icon("refresh")} Atualizar busca</button>
        <button id="selectVisibleJobs" class="button secondary">${icon("check")} Selecionar exibidas</button>
        <button id="approveSelectedJobsV3" class="button primary">${icon("wand")} Aprovar <span id="jobSelectionCount">0</span></button>
      </div>
    </section>

    <section class="compact-stat-strip">
      <div><strong>${rows.length}</strong><span>vagas disponíveis</span></div>
      <div><strong>${directCount}</strong><span>links diretos</span></div>
      <div><strong>${recommendedCount}</strong><span>nota 85 ou mais</span></div>
      <div><strong>${salaryCount}</strong><span>salário informado</span></div>
    </section>

    <div id="jobActionResult" class="note ${initialMessage ? "" : "hidden"}">${initialMessage}</div>

    <section class="surface filter-workbench">
      <div class="primary-filter-row">
        <label class="search-field">${icon("search")}<input id="jobSearchV3" value="${escapeHtml(filters.q)}" placeholder="Buscar cargo, empresa, cidade ou palavra-chave"></label>
        <label>Fonte<select id="jobSourceV3">${optionList(sources, filters.source, "Todas as fontes")}</select></label>
        <label>Modelo<select id="jobWorkV3">${optionList(workModels, filters.work, "Todos os modelos")}</select></label>
        <label>Ordenar<select id="jobSortV3"><option value="fit" ${filters.sort === "fit" ? "selected" : ""}>Maior aderência</option><option value="chance" ${filters.sort === "chance" ? "selected" : ""}>Maior chance</option><option value="salary" ${filters.sort === "salary" ? "selected" : ""}>Maior salário</option><option value="newest" ${filters.sort === "newest" ? "selected" : ""}>Mais recentes</option></select></label>
      </div>
      <details class="filter-details">
        <summary>${icon("sliders")} Filtros avançados <span id="activeJobFilters"></span>${icon("chevron-down")}</summary>
        <div class="advanced-filter-grid">
          <label>Classificação<select id="jobStatusV3">${optionList(statuses, filters.status, "Todas")}</select></label>
          <label>Nota mínima<input id="jobMinScoreV3" type="number" min="0" max="100" value="${Number(filters.minScore || 0)}"></label>
          <label>Salário-base mínimo<input id="jobMinSalaryV3" type="number" min="0" step="500" value="${Number(filters.minSalary || 0)}"></label>
          <label class="switch-line"><input id="jobDirectV3" type="checkbox" ${filters.directOnly ? "checked" : ""}><span><strong>Somente link direto</strong><small>Oculta páginas de pesquisa e fontes sem formulário.</small></span></label>
          <label class="switch-line"><input id="jobDuplicatesV3" type="checkbox" ${filters.hideDuplicates ? "checked" : ""}><span><strong>Ocultar duplicadas</strong><small>Exibe apenas uma oportunidade de cada grupo.</small></span></label>
          <button id="clearJobFiltersV3" class="button ghost">${icon("x")} Limpar filtros</button>
        </div>
      </details>
    </section>

    <details class="surface link-importer-panel">
      <summary>${icon("link")} Tenho o link direto de uma vaga <span>Adicionar ao radar</span>${icon("chevron-down")}</summary>
      ${realLinkImporter("jobsV3", () => jobsV3("<strong>Link oficial importado.</strong><p>A vaga já pode ser analisada e aprovada.</p>"))}
    </details>

    <div class="result-heading"><div><strong id="visibleJobsCount">0</strong><span>oportunidades exibidas</span></div><p id="jobFilterSummary">Ordenadas pelo seu potencial</p></div>
    <div id="jobsV3Mount" data-testid="jobs-grid"></div>
  </div>`;

  const mount = document.querySelector("#jobsV3Mount");
  const readFilters = () => ({
    q: document.querySelector("#jobSearchV3").value.trim(),
    source: document.querySelector("#jobSourceV3").value,
    work: document.querySelector("#jobWorkV3").value,
    status: document.querySelector("#jobStatusV3").value,
    minScore: Number(document.querySelector("#jobMinScoreV3").value || 0),
    minSalary: Number(document.querySelector("#jobMinSalaryV3").value || 0),
    directOnly: document.querySelector("#jobDirectV3").checked,
    hideDuplicates: document.querySelector("#jobDuplicatesV3").checked,
    sort: document.querySelector("#jobSortV3").value
  });
  const updateSelection = () => {
    const count = document.querySelectorAll("#jobsV3Mount .job-check:checked").length;
    document.querySelector("#jobSelectionCount").textContent = String(count);
    document.querySelector("#approveSelectedJobsV3").disabled = count === 0;
  };
  const renderRows = () => {
    const active = readFilters();
    saveFilters("jobs-v3", active);
    let visible = rows.filter((row) => {
      if (!includesSearch(row, active.q)) return false;
      if (active.source !== "all" && sourceName(row) !== active.source) return false;
      if (active.work !== "all" && String(row.work_model) !== active.work) return false;
      if (active.status !== "all" && String(row.status) !== active.status) return false;
      if (Number(row.fit_score || 0) < active.minScore) return false;
      if (active.minSalary && monthlySalaryValue(row.salary) < active.minSalary) return false;
      if (active.directOnly && !hasDirectJobUrl(row)) return false;
      return true;
    });
    if (active.hideDuplicates) {
      const seenDuplicates = new Set();
      visible = visible.filter((row) => {
        const key = String(row.duplicate_key || "");
        if (!key || Number(row.duplicate_count || 1) <= 1) return true;
        if (seenDuplicates.has(key)) return false;
        seenDuplicates.add(key);
        return true;
      });
    }
    visible = [...visible].sort((left, right) => {
      if (active.sort === "newest") return Date.parse(String(right.found_at || "")) - Date.parse(String(left.found_at || ""));
      if (active.sort === "salary") return monthlySalaryValue(right.salary) - monthlySalaryValue(left.salary) || Number(right.fit_score || 0) - Number(left.fit_score || 0);
      if (active.sort === "chance") return Number(right.hire_chance_score || 0) - Number(left.hire_chance_score || 0) || Number(right.fit_score || 0) - Number(left.fit_score || 0);
      return Number(right.fit_score || 0) - Number(left.fit_score || 0) || Number(right.job_quality_score || 0) - Number(left.job_quality_score || 0);
    });
    const activeCount = [active.source !== "all", active.work !== "all", active.status !== "all", active.minScore > 0, active.minSalary > 0, active.directOnly, active.hideDuplicates].filter(Boolean).length;
    document.querySelector("#activeJobFilters").textContent = activeCount ? `${activeCount} ativos` : "";
    document.querySelector("#visibleJobsCount").textContent = String(visible.length);
    document.querySelector("#jobFilterSummary").textContent = visible.length ? `${visible.filter(hasDirectJobUrl).length} com candidatura direta · ${visible.filter((row) => Number(row.fit_score || 0) >= 85).length} recomendadas` : "Nenhuma vaga corresponde aos filtros";
    mount.innerHTML = visible.length
      ? `<div class="opportunity-grid">${visible.map(jobCard).join("")}</div>`
      : `<div class="empty-state"><span>${icon("search")}</span><h3>Nenhuma vaga neste filtro</h3><p>Ajuste os critérios ou atualize a busca para encontrar novas oportunidades.</p><button id="emptyJobScan" class="button primary">Buscar vagas agora</button></div>`;
    document.querySelector("#emptyJobScan")?.addEventListener("click", () => runScanAndRefresh("jobs"));
    mount.querySelectorAll(".job-check").forEach((input) => input.addEventListener("change", updateSelection));
    updateSelection();
    refreshIcons(mount);
  };

  document.querySelector("#scanJobsV3").onclick = () => runScanAndRefresh("jobs");
  bindRealLinkImporter("jobsV3", () => jobsV3("<strong>Link oficial importado.</strong><p>A vaga já pode ser analisada e aprovada.</p>"));
  document.querySelector("#selectVisibleJobs").onclick = () => {
    const checks = [...document.querySelectorAll("#jobsV3Mount .job-check")];
    const shouldSelect = checks.some((input) => !input.checked);
    checks.forEach((input) => input.checked = shouldSelect);
    updateSelection();
  };
  document.querySelector("#clearJobFiltersV3").onclick = () => {
    localStorage.removeItem(filterKey("jobs-v3"));
    jobsV3(initialMessage);
  };
  document.querySelectorAll("#jobSearchV3, #jobSourceV3, #jobWorkV3, #jobStatusV3, #jobMinScoreV3, #jobMinSalaryV3, #jobDirectV3, #jobDuplicatesV3, #jobSortV3").forEach((element) => element.addEventListener("input", renderRows));
  document.querySelector("#approveSelectedJobsV3").onclick = async () => {
    const ids = [...document.querySelectorAll("#jobsV3Mount .job-check:checked")].map((input) => Number(input.value)).filter(Boolean);
    if (!ids.length) return toast("Selecione pelo menos uma vaga.", "info");
    const button = document.querySelector("#approveSelectedJobsV3");
    button.disabled = true;
    button.innerHTML = `${icon("refresh")} Aprovando...`;
    refreshIcons(button);
    try {
      const data = await json("/api/jobs/approve-selected", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      const skipped = (data.skipped || []).length;
      toast(`${data.approved} vaga(s) aprovada(s)${skipped ? ` e ${skipped} ignorada(s) por falta de link direto` : ""}.`, "success");
      currentTab = "applications";
      updateShellState("applications");
      await applicationsV3(`<strong>${data.approved} vaga(s) aprovada(s).</strong><p>Agora revise e autorize a IA para começar a preparação.</p>`);
    } catch (error) {
      toast(escapeHtml(error.message), "error");
      button.disabled = false;
      button.innerHTML = `${icon("wand")} Aprovar <span id="jobSelectionCount">${ids.length}</span>`;
      refreshIcons(button);
    }
  };
  renderRows();
  refreshIcons(app);
}

function profileCompletion(profile = {}) {
  const required = [profile.name, profile.email, profile.phone, profile.city, profile.state, profile.summary, profile.resume_file];
  const useful = [profile.linkedin, profile.country, Number(profile.memory_count || 0) > 0];
  const completed = [...required, ...useful].filter((value) => Boolean(String(value || "").trim())).length;
  return Math.round((completed / (required.length + useful.length)) * 100);
}

function executiveMetric(label, value, detail, iconName, tone = "blue") {
  return `<article class="executive-metric ${tone}">
    <span class="metric-icon">${icon(iconName)}</span>
    <div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value ?? 0)}</strong><p>${escapeHtml(detail)}</p></div>
  </article>`;
}

function pipelineStep(index, label, value, detail, tab, state = "") {
  return `<button class="pipeline-step ${state}" data-tab="${escapeHtml(tab)}">
    <span class="pipeline-index">${escapeHtml(index)}</span>
    <div><strong>${escapeHtml(value ?? 0)}</strong><b>${escapeHtml(label)}</b><small>${escapeHtml(detail)}</small></div>
    ${icon("arrow-right")}
  </button>`;
}

function priorityRow(item, index) {
  return `<article class="priority-row ${escapeHtml(item.tone)}">
    <span class="priority-number">${String(index + 1).padStart(2, "0")}</span>
    <div><small>${escapeHtml(item.priority)}</small><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></div>
    <button data-tab="${escapeHtml(item.tab)}">${escapeHtml(item.label)} ${icon("arrow-right")}</button>
  </article>`;
}

function topOpportunityRow(row) {
  return `<article class="top-opportunity-row">
    <div class="compact-score"><strong>${escapeHtml(row.fit_score ?? "-")}</strong><span>aderência</span></div>
    <div class="top-opportunity-main"><strong>${escapeHtml(row.title || "Vaga")}</strong><small>${escapeHtml(row.company || "Empresa a confirmar")} · ${escapeHtml(row.location || "Local a confirmar")}</small></div>
    <div class="top-opportunity-meta"><span>${escapeHtml(row.salary || "Salário não informado")}</span><small>${escapeHtml(sourceName(row))}</small></div>
    ${row.id ? `<button data-detail="${row.id}" title="Ver detalhes">${icon("arrow-right")}</button>` : ""}
  </article>`;
}

async function dashboardV3() {
  const [summary, gmail, sourceData, profileData] = await Promise.all([
    json("/api/summary"),
    json("/api/gmail/status"),
    json("/api/sources"),
    json("/api/profiles")
  ]);
  const pipeline = summary.pipeline || {};
  const salary = summary.salary || {};
  const momentum = summary.momentum || {};
  const sourceRows = (sourceData.sources || []).slice(0, 5);
  const suggestions = dashboardAiSuggestions(summary, gmail, sourceRows);
  const recentEvents = (summary.recentRecruiterEvents || []).slice(0, 5);
  const firstName = String(currentUser?.name || "").trim().split(/\s+/)[0] || "profissional";
  const currentHour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  const greeting = currentHour < 12 ? "Bom dia" : currentHour < 18 ? "Boa tarde" : "Boa noite";
  const gmailLimited = Boolean(gmail.rateLimited);
  const gmailTone = gmailLimited ? "limited" : gmail.connected ? "online" : "offline";
  const gmailLabel = gmailLimited ? "Em pausa temporária" : gmail.connected ? "Conectado" : "Desconectado";
  const completion = profileCompletion(profileData.active || {});
  const topJobs = (summary.topJobs || []).slice(0, 5);

  app.innerHTML = `<div class="page-stack dashboard-v3">
    <section class="welcome-panel">
      <div>
        <span class="eyebrow">INTELIGÊNCIA PARA SUA PRÓXIMA OPORTUNIDADE</span>
        <h2>${greeting}, ${escapeHtml(firstName)}.</h2>
        <p>O Ápice organiza as melhores vagas, prepara seus dados e mostra exatamente o que depende de você.</p>
      </div>
      <div class="welcome-actions">
        <button id="dashboardScan" class="button light">${icon("search")} Buscar novas vagas</button>
        <button data-tab="applications" class="button outline-light">Ver meu pipeline ${icon("arrow-right")}</button>
      </div>
      <div class="welcome-signal"><span>${icon("sparkles")}</span><div><strong>${suggestions.length} decisões organizadas</strong><small>Atualizado com vagas, perfil e Gmail</small></div></div>
    </section>

    <section class="metric-ribbon" aria-label="Indicadores principais">
      ${executiveMetric("Vagas para avaliar", summary.availableJobs || 0, `${summary.gold || 0} oportunidades prioritárias`, "briefcase", "blue")}
      ${executiveMetric("Aguardando autorização", summary.awaitingAuthorization || 0, "A IA ainda não iniciou", "clock", "gold")}
      ${executiveMetric("Candidaturas reais", pipeline.actual || 0, "Envios com confirmação", "clipboard-check", "teal")}
      ${executiveMetric("Avanços", pipeline.selected || 0, `${pipeline.responseRate || 0}% de retorno`, "trend", "green")}
      ${executiveMetric("Ações necessárias", pipeline.actions || 0, "Pendências objetivas", "circle-alert", "orange")}
    </section>

    <div class="dashboard-lead-grid">
      <section class="surface priority-panel">
        <div class="section-heading-row">
          <div><span class="section-kicker">ÁPICE IA</span><h3>O que merece sua atenção agora</h3><p>Recomendações ordenadas pelo impacto no seu processo seletivo.</p></div>
          <span class="soft-badge">${suggestions.length} prioridades</span>
        </div>
        <div class="priority-list">${suggestions.slice(0, 4).map(priorityRow).join("")}</div>
      </section>

      <aside class="surface readiness-panel">
        <div class="section-heading-row"><div><span class="section-kicker">PRONTIDÃO</span><h3>Seu sistema</h3></div><span class="status-pill ${gmailTone}"><i></i>${escapeHtml(gmailLabel)}</span></div>
        <div class="completion-ring" style="--completion:${completion}"><strong>${completion}%</strong><span>perfil completo</span></div>
        <div class="readiness-list">
          <div><span>${icon("file-text")}</span><p><strong>${escapeHtml(fileName(profileData.active?.resume_file || ""))}</strong><small>Currículo principal</small></p></div>
          <div><span>${icon("bot")}</span><p><strong>${summary.memoryAnswers || 0} respostas</strong><small>Memória de formulários</small></p></div>
          <div><span>${icon("mail")}</span><p><strong>Gmail ${gmail.connected ? "ativo" : "pendente"}</strong><small>${gmail.lastSync?.completed_at ? `Atualizado em ${formatDayMonth(gmail.lastSync.completed_at)}` : "Sem leitura recente"}</small></p></div>
        </div>
        <button data-tab="profile" class="button secondary full">Completar meu perfil ${icon("arrow-right")}</button>
      </aside>
    </div>

    <section class="surface pipeline-panel">
      <div class="section-heading-row"><div><span class="section-kicker">FLUXO DIRETO</span><h3>Da descoberta ao retorno</h3></div><small class="updated-label">Sem etapas duplicadas</small></div>
      <div class="pipeline-track">
        ${pipelineStep("01", "Vagas", summary.availableJobs || 0, "Analisar e aprovar", "jobs", "discover")}
        ${pipelineStep("02", "Autorização", summary.awaitingAuthorization || 0, "Liberar a IA", "applications", "authorize")}
        ${pipelineStep("03", "Preparação", summary.authorized || 0, "Preencher e concluir", "applications", "prepare")}
        ${pipelineStep("04", "Candidatadas", pipeline.actual || 0, "Monitorar respostas", "applications", "track")}
      </div>
    </section>

    <div class="dashboard-analysis-grid">
      <section class="surface performance-panel">
        <div class="section-heading-row"><div><span class="section-kicker">RITMO</span><h3>Atividade dos últimos 14 dias</h3></div><span class="soft-badge">${momentum.applications7d || 0} envios · ${momentum.replies7d || 0} respostas em 7 dias</span></div>
        ${activityPulseChart(summary.activityTrend || [])}
      </section>
      <section class="surface recruiter-panel">
        <div class="section-heading-row"><div><span class="section-kicker">RECRUTADORES</span><h3>Retornos recentes</h3></div><button data-tab="applications" class="text-button">Ver todos ${icon("arrow-right")}</button></div>
        <div class="event-feed">${recentEvents.map(recruiterEventRow).join("") || `<div class="empty-mini">Nenhuma resposta nova. O Gmail continuará monitorando.</div>`}</div>
      </section>
    </div>

    <div class="dashboard-analysis-grid market-row">
      <section class="surface salary-panel">
        <div class="section-heading-row"><div><span class="section-kicker">REMUNERAÇÃO</span><h3>Faixa salarial das vagas</h3></div><span class="soft-badge">Meta ${formatMoney(salary.target || 3000)}</span></div>
        <div class="salary-overview"><div><strong>${salary.atOrAboveTarget || 0}</strong><span>na meta</span></div><div><strong>${salary.notInformed || 0}</strong><span>sem salário</span></div><div><strong>${formatMoney(salary.medianMinimum || 0)}</strong><span>mediana</span></div></div>
        ${salaryChart(salary.distribution || [])}
      </section>
      <section class="surface sources-panel">
        <div class="section-heading-row"><div><span class="section-kicker">FONTES</span><h3>Canais com melhor sinal</h3></div><button data-tab="settings" class="text-button">Configurar ${icon("arrow-right")}</button></div>
        <div class="source-performance">${sourceRows.map(sourcePerformanceRow).join("") || `<div class="empty-mini">As fontes aparecerão depois da próxima busca.</div>`}</div>
      </section>
    </div>

    <section class="surface top-opportunities">
      <div class="section-heading-row"><div><span class="section-kicker">MAIOR POTENCIAL</span><h3>Oportunidades para priorizar</h3><p>Ordenadas por aderência, qualidade do anúncio e risco.</p></div><button data-tab="jobs" class="button secondary">Ver todas as vagas ${icon("arrow-right")}</button></div>
      <div class="top-opportunity-list">${topJobs.map(topOpportunityRow).join("") || `<div class="empty-state compact"><h3>Nenhuma vaga disponível</h3><p>Rode uma nova busca para alimentar esta seleção.</p></div>`}</div>
    </section>
  </div>`;

  document.querySelector("#dashboardScan").onclick = () => runScanAndRefresh("dashboard");
  refreshIcons(app);
}

async function logs() {
  const health = await json("/api/health");
  app.innerHTML = `<section class="notice-panel">
    <div class="section-head"><div><span class="eyebrow">Logs</span><h2>Auditoria e saúde do agente</h2></div><span class="state-chip success">${escapeHtml(health.status)}</span></div>
    <p>Auditoria local: <code>logs/audit.jsonl</code> e <code>logs/errors.jsonl</code>. Dados sensíveis são mascarados.</p>
    <div class="kpi-grid compact">
      ${metricCard("Servidor", "online", formatDate(health.time), "success")}
      ${metricCard("Banco", health.environment.databaseUrl, "DATABASE_URL", "blue")}
      ${metricCard("OpenAI", health.environment.openaiConfigured ? "ativa" : "pendente", health.environment.openaiModel, health.environment.openaiConfigured ? "success" : "warning")}
    </div>
  </section>`;
}

async function load(tab) {
  currentTab = tab || "dashboard";
  updateShellState(currentTab);
  try {
    if (tab === "jobs") return jobsV3();
    if (tab === "approved") return applications();
    if (tab === "informal") return informal();
    if (tab === "applications") return applicationsV3();
    if (tab === "returns") return returnsPage();
    if (tab === "sources") return sourcesPage();
    if (tab === "actions") return returnsPage();
    if (tab === "aiApply") return aiApplyPage();
    if (tab === "accounts") return accountsPage();
    if (["profile", "profiles", "resume"].includes(tab)) return profilePage();
    if (tab === "settings") return settingsV3();
    if (tab === "logs") return logs();
    return dashboardV3();
  } catch (error) {
    app.innerHTML = `<section class="notice-panel"><h2>Algo não carregou</h2><p>${escapeHtml(error.message)}</p><button data-tab="dashboard">Voltar ao painel</button></section>`;
    toast(escapeHtml(error.message), "error");
  }
}

header.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  const theme = event.target.closest("#themeToggle");
  const logout = event.target.closest("#logoutButton");
  const mobileMenu = event.target.closest("#mobileMenu");
  const backdrop = event.target.closest("#sidebarBackdrop");
  const globalScan = event.target.closest("#globalScan");
  const globalSync = event.target.closest("#globalSync");
  if (button && currentUser) load(button.dataset.tab);
  if (theme) {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("careerHunterTheme", next);
    theme.innerHTML = icon(next === "dark" ? "sun" : "moon");
    refreshIcons(theme);
  }
  if (mobileMenu) {
    document.querySelector("#appSidebar")?.classList.toggle("open");
    document.querySelector("#sidebarBackdrop")?.classList.toggle("visible");
  }
  if (backdrop) {
    document.querySelector("#appSidebar")?.classList.remove("open");
    backdrop.classList.remove("visible");
  }
  if (globalScan) runScanAndRefresh(currentTab === "jobs" ? "jobs" : "dashboard");
  if (globalSync) {
    globalSync.disabled = true;
    globalSync.innerHTML = `${icon("refresh")}<span>Atualizando...</span>`;
    refreshIcons(globalSync);
    json("/api/gmail/sync", { method: "POST" })
      .then((result) => {
        toast(`${result.matched || 0} retorno(s) atualizado(s) e ${result.jobsImported || 0} nova(s) vaga(s).`, "success");
        return load(currentTab);
      })
      .catch((error) => toast(escapeHtml(error.message), "error"))
      .finally(() => {
        if (!document.body.contains(globalSync)) return;
        globalSync.disabled = false;
        globalSync.innerHTML = `${icon("refresh")}<span>Atualizar Gmail</span>`;
        refreshIcons(globalSync);
      });
  }
  if (logout) {
    json("/api/auth/logout", { method: "POST" }).finally(() => {
      currentUser = null;
      boot();
    });
  }
});

app.addEventListener("click", (event) => {
  const detail = event.target.closest("[data-detail]");
  const tab = event.target.closest("[data-tab]");
  const retry = event.target.closest("[data-retry]");
  const jobApprove = event.target.closest("[data-job-approve]");
  const authorize = event.target.closest("[data-authorize]");
  const aiApply = event.target.closest("[data-ai-apply]");
  const accelerate = event.target.closest("[data-accelerate-url]");
  const markSent = event.target.closest("[data-mark-sent]");
  const saveMemory = event.target.closest("[data-save-memory]");
  const copyValue = event.target.closest("[data-copy-value]");
  const copyAutofill = event.target.closest("[data-copy-autofill]");
  const autofillBookmarklet = event.target.closest("[data-autofill-bookmarklet]");
  if (detail) jobDetail(detail.dataset.detail, currentTab);
  if (tab) load(tab.dataset.tab);
  if (jobApprove) {
    const jobId = Number(jobApprove.dataset.jobApprove);
    json("/api/jobs/approve-selected", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [jobId] }) })
      .then(() => {
        toast("Vaga aprovada. Autorize a candidatura na próxima etapa.", "success");
        currentTab = "applications";
        updateShellState("applications");
        return applicationsV3("<strong>Vaga aprovada.</strong><p>A IA aguarda sua autorização para começar.</p>");
      })
      .catch((error) => toast(escapeHtml(error.message), "error"));
  }
  if (authorize) {
    json("/api/applications/authorize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [Number(authorize.dataset.authorize)] }) })
      .then(async (data) => {
        toast("Autorização registrada. A IA preparou o próximo passo permitido.", "success");
        await applicationsV3("<strong>Autorização registrada.</strong><p>O resultado detalhado da IA está aberto ao lado.</p>");
        showAutomationDrawer(data);
      })
      .catch((error) => toast(escapeHtml(error.message), "error"));
  }
  if (copyValue) {
    navigator.clipboard.writeText(copyValue.dataset.copyValue || "")
      .then(() => toast("Campo copiado.", "success"))
      .catch(() => toast("Não consegui copiar automaticamente.", "error"));
  }
  if (copyAutofill) {
    navigator.clipboard.writeText(copyAutofill.dataset.copyAutofill || "")
      .then(() => toast("Autofill copiado. Abra a vaga oficial, cole na barra de endereço e execute.", "success"))
      .catch(() => toast("Não consegui copiar automaticamente.", "error"));
  }
  if (autofillBookmarklet) {
    event.preventDefault();
    toast("Arraste este botão para a barra de favoritos. Use-o na página oficial depois de preparar a candidatura.", "info");
  }
  if (accelerate) {
    openOfficialJob(accelerate.dataset.accelerateUrl);
    const applicationId = Number(accelerate.dataset.accelerateApplicationId || 0);
    if (applicationId) {
      json("/api/applications/ai-apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [applicationId] }) })
        .then((data) => showAutomationDrawer(data))
        .catch((error) => toast(escapeHtml(error.message), "error"));
    } else {
      toast("A vaga oficial foi aberta. Aprove-a no painel para liberar o preenchimento com seus dados.", "info");
    }
  }
  if (retry) {
    json("/api/applications/retry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [Number(retry.dataset.retry)] }) })
      .then(() => {
        toast("Candidatura recolocada para tentar novamente.", "success");
        return applicationsV3();
      })
      .catch((error) => toast(escapeHtml(error.message), "error"));
  }
  if (aiApply) {
    const url = String(aiApply.dataset.applicationUrl || "").trim();
    if (url && !isGoogleSearchUrl(url)) {
      openOfficialJob(url);
      json("/api/applications/ai-apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [Number(aiApply.dataset.aiApply)] }) })
        .then((data) => showAutomationDrawer(data))
        .catch((error) => toast(escapeHtml(error.message), "error"));
      return;
    }
    json("/api/applications/ai-apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [Number(aiApply.dataset.aiApply)] }) })
      .then((data) => {
        toast("IA preparou a candidatura desta vaga.", "success");
        showAutomationDrawer(data);
      })
      .catch((error) => toast(escapeHtml(error.message), "error"));
  }
  if (markSent) {
    const ids = String(markSent.dataset.markSent || "").split(",").map(Number).filter(Boolean);
    json("/api/applications/mark-sent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) })
      .then(() => {
        toast("Candidatura marcada como enviada.", "success");
        return applicationsV3();
      })
      .catch((error) => toast(escapeHtml(error.message), "error"));
  }
  if (saveMemory) {
    const capture = saveMemory.closest(".memory-capture");
    const answers = [...capture.querySelectorAll("[data-memory-key]")]
      .map((input) => ({
        key: input.dataset.memoryKey,
        question: input.dataset.memoryQuestion,
        category: input.dataset.memoryCategory,
        fieldType: input.dataset.memoryFieldType,
        answer: input.value
      }))
      .filter((item) => item.answer.trim());
    json("/api/answer-memory/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: Number(capture.dataset.profileId), answers })
    }).then(() => {
      toast("Respostas salvas na memória do perfil.", "success");
      return applicationsV3();
    }).catch((error) => toast(escapeHtml(error.message), "error"));
  }
});

boot();
