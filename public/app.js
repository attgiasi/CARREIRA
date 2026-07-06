const app = document.querySelector("#app");
const header = document.querySelector("header");
let currentTab = "dashboard";
let aiApplyPrefill = null;
let aiApplyReturnTab = "approved";
let currentUser = null;
let startupAiApplyPrefill = readAiApplyPrefillFromQuery();

const tabs = [
  ["dashboard", "Painel"],
  ["jobs", "Vagas"],
  ["approved", "Aprovadas"],
  ["applications", "Candidaturas"],
  ["aiApply", "IA Candidatura"],
  ["informal", "Freelas"],
  ["accounts", "Agências Conectadas"],
  ["profile", "Meu Perfil"],
  ["logs", "Logs"]
];

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

const tableColumns = {
  jobs: [
    { id: "select", label: "", always: true, render: (row) => `<input class="job-check" type="checkbox" value="${row.id}">` },
    { id: "title", label: "Nome da vaga", render: (row) => `<strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.company || "Empresa a confirmar")}</small>` },
    { id: "salary", label: "Salário", render: (row) => escapeHtml(row.salary || "Não informado") },
    { id: "location", label: "Local", render: (row) => escapeHtml(row.location || "A confirmar") },
    { id: "work_model", label: "Tipo de trabalho", render: (row) => escapeHtml(row.work_model || "A confirmar") },
    { id: "description", label: "Descrição resumida", render: (row) => escapeHtml(shortDescription(row.description)) },
    { id: "source", label: "Fonte", render: (row) => `${sourceBadge(row.source)}<small>${hasDirectJobUrl(row) ? "Link da vaga" : isAssistedSource(row.source) ? "Fonte de busca" : "Sem link direto"}</small>` },
    { id: "score", label: "Nota", render: (row) => scoreBadge(row) },
    { id: "status", label: "Status", render: (row) => stateChip(row) },
    { id: "risk", label: "Risco", default: false, render: (row) => `<strong class="${riskClass(row.risk_score)}">${row.risk_score ?? "-"}</strong><small>${escapeHtml(row.risk_flags || "Sem alerta")}</small>` },
    { id: "found_at", label: "Encontrada em", default: false, render: (row) => formatDate(row.found_at) },
    { id: "action", label: "Ação", always: true, render: (row) => `<div class="action-stack">${sourceActionLink(row)}${aiAccelerateButton(row)}<button data-detail="${row.id}">Detalhes</button><small>${escapeHtml(jobNextStep(row))}</small></div>` }
  ],
  applications: [
    { id: "select", label: "", always: true, render: (row) => `<input class="application-check" type="checkbox" value="${row.id}">` },
    { id: "title", label: "Nome da vaga", render: (row) => `<strong>${escapeHtml(row.title || `Vaga ${row.job_id || ""}`)}</strong><small>${escapeHtml(row.company || "Empresa a confirmar")}</small>` },
    { id: "salary", label: "Salário", render: (row) => escapeHtml(row.salary || "Não informado") },
    { id: "location", label: "Local", render: (row) => escapeHtml(row.location || "A confirmar") },
    { id: "work_model", label: "Tipo de trabalho", render: (row) => escapeHtml(row.work_model || "A confirmar") },
    { id: "description", label: "Descrição resumida", render: (row) => escapeHtml(shortDescription(row.description)) },
    { id: "source", label: "Fonte", render: (row) => `${sourceBadge(row.source)}<small>${hasDirectJobUrl(row) ? "link da vaga" : isAssistedSource(row.source) ? "fonte de busca" : "sem link"}</small>` },
    { id: "score", label: "Nota", render: (row) => scoreBadge(row) },
    { id: "status", label: "Status", render: (row) => `${stateChip(row)}<small>${escapeHtml(row.application_status || "-")}</small>` },
    { id: "dates", label: "Datas", render: (row) => `<small>Preparada: ${formatDate(row.created_at)}</small><small>Última ação: ${formatDate(row.updated_at)}</small><small>Candidatado: ${formatDate(row.applied_at)}</small>` },
    { id: "assets", label: "Currículo/Carta", render: (row) => `<small>CV: ${escapeHtml(row.generated_resume_path || "Não gerado")}</small><small>Carta: ${escapeHtml(row.cover_letter_path || "Não gerada")}</small>` },
    { id: "risk", label: "Risco", default: false, render: (row) => `<strong class="${riskClass(row.risk_score)}">${row.risk_score ?? "-"}</strong><small>${escapeHtml(row.risk_flags || "Sem alerta")}</small>` },
    { id: "action", label: "Ação", always: true, render: (row) => `<div class="action-stack">${sourceActionLink(row)}${aiAccelerateButton(row, "Acelerar no navegador", row.id)}${row.job_id ? `<button data-detail="${row.job_id}">Detalhes</button>` : ""}<button data-retry="${row.id}">Candidatar novamente</button></div>` }
  ]
};

document.documentElement.dataset.theme = localStorage.getItem("careerHunterTheme") || "light";

function renderShell() {
  const nav = currentUser ? tabs.map(([id, label]) => `<button data-tab="${id}">${label}</button>`).join("") : "";
  header.innerHTML = `
    <div class="brand-row">
      <button class="brand-lockup" data-tab="dashboard" title="Ir para o painel">
        <span class="brand-mark">CH</span>
        <span><strong>Career Hunter</strong><small>Agente de carreira</small></span>
      </button>
      <nav id="mainNav">${nav}</nav>
      ${currentUser ? `<div class="account-chip"><strong>${escapeHtml(currentUser.name)}</strong><small>${escapeHtml(currentUser.email)}</small><button id="logoutButton">Sair</button></div>` : ""}
      <button id="themeToggle" title="Alternar modo escuro"></button>
    </div>`;
  document.querySelector("#themeToggle").textContent = document.documentElement.dataset.theme === "dark" ? "Modo claro" : "Modo escuro";
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

function renderAuth(message = "") {
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
        <button data-auth-mode="register">Criar conta</button>
      </div>
      <div id="authMessage" class="note ${message ? "" : "hidden"}">${message}</div>
      <form id="loginForm" class="auth-form">
        <label>E-mail<input name="email" type="email" autocomplete="email" required></label>
        <label>Senha<input name="password" type="password" autocomplete="current-password" required></label>
        <button class="primary" type="submit">Entrar</button>
      </form>
      <form id="registerForm" class="auth-form hidden">
        <label>Nome completo<input name="name" autocomplete="name" required></label>
        <label>E-mail<input name="email" type="email" autocomplete="email" required></label>
        <label>Senha<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
        <small>Use pelo menos 8 caracteres com letras e números.</small>
        <button class="primary" type="submit">Criar conta</button>
      </form>
    </div>
  </section>`;
  document.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-auth-mode]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const mode = button.dataset.authMode;
    document.querySelector("#loginForm").classList.toggle("hidden", mode !== "login");
    document.querySelector("#registerForm").classList.toggle("hidden", mode !== "register");
  }));
  document.querySelector("#loginForm").addEventListener("submit", (event) => submitAuth(event, "login"));
  document.querySelector("#registerForm").addEventListener("submit", (event) => submitAuth(event, "register"));
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
    if (!session.authenticated) {
      currentUser = null;
      renderAuth(session.users ? "" : "<strong>Primeiro acesso:</strong><p>Crie a conta administradora. Os dados atuais serão vinculados a ela.</p>");
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
  if (Number(row.sent_by_agent) === 1 || row.application_status === "Candidatura enviada") {
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
  if (row.approval_status === "aprovado_pelo_usuario") {
    return { label: "Aprovada", tone: "ready", detail: "Pode iniciar candidatura" };
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

function sourceBadge(source) {
  return `<span class="source-badge">${escapeHtml(sourceName(source) || "Fonte")}</span>`;
}

function sourceName(sourceOrRow) {
  const source = typeof sourceOrRow === "object" && sourceOrRow ? String(sourceOrRow.source || "") : String(sourceOrRow || "");
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
    gmail: "Gmail"
  };
  return names[source] || source.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) || "Fonte";
}

function sourceLink(row, label = sourceName(row)) {
  return hasDirectJobUrl(row)
    ? `<a class="source-link" href="${escapeHtml(row.url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`
    : isAssistedSource(row.source) && hasUsableJobUrl(row)
      ? `<a class="source-link" href="${escapeHtml(row.url)}" target="_blank" rel="noreferrer">Buscar no ${escapeHtml(label)}</a>`
    : `<span class="source-badge">${escapeHtml(label)}</span>`;
}

function sourceActionLink(row) {
  if (hasDirectJobUrl(row)) {
    return `<a class="action" href="${escapeHtml(row.url)}" target="_blank" rel="noreferrer">Abrir ${escapeHtml(sourceName(row))}</a>`;
  }
  if (isAssistedSource(row.source) && hasUsableJobUrl(row)) {
    return `<a class="action secondary" href="${escapeHtml(row.url)}" target="_blank" rel="noreferrer">Buscar no ${escapeHtml(sourceName(row))}</a>`;
  }
  return "";
}

function aiAccelerateButton(row, label = "Acelerar candidatura", applicationId = "") {
  if (!hasDirectJobUrl(row)) return "";
  const title = row.title || "";
  const company = row.company || "";
  return `<button class="primary" data-accelerate-url="${escapeHtml(row.url)}" data-accelerate-title="${escapeHtml(title)}" data-accelerate-company="${escapeHtml(company)}" data-accelerate-application-id="${escapeHtml(applicationId)}">${escapeHtml(label)}</button>`;
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
  return Number(row.sent_by_agent) === 1 || row.application_status === "Candidatura enviada";
}

function isApprovedApplication(row) {
  return row.approval_status === "aprovado_pelo_usuario" && !isSentApplication(row);
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
  if (channel.id === "ia") return "Clique em Candidatar com IA para preparar campos, respostas, currículo e carta.";
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
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
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
  return "Vaga com fonte direta: selecione e aprove a oportunidade.";
}

function jobCard(row) {
  return `<article class="opportunity-card">
    <div class="card-topline">
      ${cardCheckbox("job-check", row.id)}
      <div class="card-score"><strong>${row.fit_score ?? "-"}</strong><span>nota</span></div>
    </div>
    <div class="card-title-row">
      <div>
        <h3>${escapeHtml(row.title)}</h3>
        <p>${escapeHtml(row.company || "Empresa a confirmar")}</p>
      </div>
      ${sourceLink(row)}
    </div>
    <div class="mini-chip-row">${duplicateBadge(row)}</div>
    ${metaGrid([
      ["Salário", escapeHtml(row.salary || "Não informado")],
      ["Local", escapeHtml(row.location || "A confirmar")],
      ["Modelo", escapeHtml(row.work_model || "A confirmar")],
      ["Cadastro", escapeHtml(formatDate(row.found_at))]
    ])}
    <p class="card-description">${escapeHtml(shortDescription(row.description, 300))}</p>
    <div class="card-footer">
      <span class="state-chip ${isAssistedSource(row.source) ? "warning" : hasDirectJobUrl(row) ? "success" : "info"}">${isAssistedSource(row.source) ? "Fonte de busca" : hasDirectJobUrl(row) ? "Link da vaga" : "Sem canal"}</span>
      <small>${escapeHtml(jobNextStep(row))}</small>
    </div>
    <div class="card-actions">
      ${sourceActionLink(row)}
      ${aiAccelerateButton(row)}
      <button data-detail="${row.id}">Detalhes</button>
    </div>
  </article>`;
}

function applicationCard(row, context = "approved") {
  const channel = applicationChannel(row);
  const state = applicationState(row);
  const canApplyWithAi = ["ia", "dados"].includes(channel.id);
  return `<article class="opportunity-card application-card" data-channel="${channel.id}">
    <div class="card-topline">
      ${cardCheckbox("application-check", row.id)}
      <div class="card-score"><strong>${row.fit_score ?? "-"}</strong><span>nota</span></div>
    </div>
    <div class="card-title-row">
      <div>
        <h3>${escapeHtml(row.title || `Candidatura ${row.id}`)}</h3>
        <p>${escapeHtml(row.company || "Empresa a confirmar")}</p>
      </div>
      ${sourceLink(row)}
    </div>
    <div class="mini-chip-row">${duplicateBadge(row)}</div>
    ${metaGrid([
      ["Salário", escapeHtml(row.salary || "Não informado")],
      ["Local", escapeHtml(row.location || "A confirmar")],
      ["Modelo", escapeHtml(row.work_model || "A confirmar")],
      ["Chance", `${escapeHtml(row.hire_chance_score ?? "-")}/100`],
      [context === "sent" ? "Candidatado" : "Aprovado", escapeHtml(formatDate(context === "sent" ? row.applied_at : row.updated_at))]
    ])}
    <p class="card-description">${escapeHtml(shortDescription(row.description, 280))}</p>
    <div class="application-assets">
      <span><strong>CV</strong> ${escapeHtml(fileName(row.generated_resume_path))}</span>
      <span><strong>Carta</strong> ${escapeHtml(fileName(row.cover_letter_path))}</span>
      <span><strong>Chance</strong> ${escapeHtml(row.hire_chance_reason || "Calculada pela aderência, qualidade da vaga e risco.")}</span>
    </div>
    <div class="card-footer">
      <span class="state-chip ${channel.tone}">${escapeHtml(channel.label)}</span>
      <span class="state-chip ${state.tone}">${escapeHtml(state.label)}</span>
      ${context === "sent" ? availabilityChip(row) : `<small>${escapeHtml(applicationNextAction(row))}</small>`}
    </div>
    <div class="card-actions">
      ${sourceActionLink(row)}
      ${canApplyWithAi && context !== "sent" ? `<button class="primary" data-ai-apply="${row.id}" data-application-url="${escapeHtml(row.url || "")}" data-application-title="${escapeHtml(row.title || "")}" data-application-company="${escapeHtml(row.company || "")}">Candidatar com IA</button>` : ""}
      ${context !== "sent" ? aiAccelerateButton(row, "Acelerar no navegador", row.id) : ""}
      ${context !== "sent" ? `<button data-mark-sent="${row.id}">Marcar enviada</button>` : `<button data-retry="${row.id}">Candidatar novamente</button>`}
      ${row.job_id ? `<button data-detail="${row.job_id}">Detalhes</button>` : ""}
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
      ${action.applicationId ? `<button data-tab="approved">Ver aprovadas</button>` : ""}
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
      <span class="eyebrow">Orientação</span>
      <h3>O que fazer nas vagas</h3>
      <p>Primeiro filtre por vagas com fonte direta. Quando a vaga tiver link real, selecione e clique em Aprovar selecionadas. Se a fonte for uma página de busca, abra a fonte, entre na vaga individual e cole o link oficial no campo de importação.</p>
    </div>
    <div class="guidance-steps">
      <div><strong>1. Buscar vagas</strong><small>Use o botão Buscar vagas para renovar o radar sem repetir as já movidas.</small></div>
      <div><strong>2. Validar fonte</strong><small>Priorize vagas com formulário, e-mail de RH ou página oficial da empresa.</small></div>
      <div><strong>3. Aprovar a vaga</strong><small>Depois de validar, a vaga sai daqui e entra em Aprovadas.</small></div>
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
  const [summary, profile] = await Promise.all([json("/api/summary"), json("/api/career-profile")]);
  const actions = [
    !summary.environment.openaiConfigured ? ["Configurar IA", "Adicione sua OPENAI_API_KEY para cartas e respostas mais fortes.", "profile"] : null,
    Number(summary.availableJobs) > 0 ? ["Revisar vagas", `${summary.availableJobs} vaga(s) novas fora da fila de candidatura.`, "jobs"] : null,
    Number(summary.approved) > 0 ? ["Candidatar aprovadas", `${summary.approved} vaga(s) aprovadas aguardando ação.`, "approved"] : null,
    Number(summary.pendingInformation) > 0 ? ["Responder memória", `${summary.pendingInformation} candidatura(s) precisam de dados seus.`, "applications"] : null,
    Number(summary.waitingRealJob) > 0 ? ["Validar fonte", `${summary.waitingRealJob} entrada(s) precisam de link real da vaga.`, "applications"] : null
  ].filter(Boolean);

  app.innerHTML = `<div class="command-hero">
    <div class="hero-copy">
      <span class="eyebrow">Centro de comando</span>
      <h2>Pipeline de carreira premium</h2>
      <p>Busca vagas, aprova oportunidades, prepara candidatura por IA e acompanha respostas em um fluxo direto.</p>
    </div>
    <div class="hero-actions">
      <button id="scanNow" class="primary">Buscar vagas</button>
    </div>
  </div>

  <div class="kpi-grid">
    ${metricCard("Vagas novas", summary.availableJobs, "Fora da fila de candidatura", "accent")}
    ${metricCard("Radar total", summary.jobs, "Histórico encontrado", "blue")}
    ${metricCard("Aprovadas", summary.approved, "Prontas para candidatar", "gold")}
    ${metricCard("Pendências", summary.actionItems, "Ver em Candidaturas", "warning")}
    ${metricCard("Duplicadas", summary.duplicateGroups || 0, "Entre fontes diferentes", "warning")}
    ${metricCard("Faltam dados", summary.pendingInformation, "Perguntas para salvar na memória", "warning")}
    ${metricCard("Prontas", summary.ready, "Fonte oficial aberta", "accent")}
    ${metricCard("Candidatadas", summary.sent, `Última: ${formatDate(summary.lastAppliedAt)}`, "success")}
    ${metricCard("Meu Perfil", summary.profiles, `${summary.memoryAnswers} resposta(s) memorizada(s)`, "blue")}
  </div>

  <div class="command-grid">
    <section class="pipeline-panel">
      <div class="section-head"><div><span class="eyebrow">Pipeline</span><h3>Status operacional</h3></div></div>
      <div class="pipeline-track">
        ${pipelineStage("Busca", summary.jobs, "captadas")}
        ${pipelineStage("Novas", summary.availableJobs, "para revisar")}
        ${pipelineStage("Vagas", summary.availableJobs, "para aprovar")}
        ${pipelineStage("Aprovadas", summary.approved, "para candidatar")}
        ${pipelineStage("Candidaturas", summary.sent, "enviadas")}
      </div>
      <div class="status-board">
        ${(summary.byApplicationStatus || []).map((row) => `<div><span>${escapeHtml(row.status)}</span><strong>${row.total}</strong></div>`).join("") || "<p>Nenhum status registrado ainda.</p>"}
      </div>
    </section>

    <section class="ai-panel">
      <div class="section-head"><div><span class="eyebrow">IA e currículo</span><h3>${profile.ai.openaiConfigured ? "IA ativa" : "IA aguardando chave"}</h3></div><span class="state-chip ${profile.ai.openaiConfigured ? "success" : "warning"}">${escapeHtml(profile.ai.model)}</span></div>
      <p class="tight">${escapeHtml(profile.applicationPositioning.headline)}</p>
      <div class="resume-snapshot">
        <div><strong>${profile.resumes.length}</strong><span>currículo(s) base</span></div>
        <div><strong>${profile.generatedResumes.length}</strong><span>CVs gerados</span></div>
        <div><strong>${profile.generatedCoverLetters.length}</strong><span>cartas geradas</span></div>
      </div>
      <div class="env-status">
        <span class="state-chip ${summary.environment.openaiConfigured ? "success" : "warning"}">OpenAI ${summary.environment.openaiConfigured ? "ativa" : "pendente"}</span>
        <span class="state-chip ${summary.environment.geminiConfigured ? "success" : "info"}">Gemini ${summary.environment.geminiConfigured ? "ativa" : "opcional"}</span>
      </div>
    </section>
  </div>

  <div class="three-column">
    <section>
      <div class="section-head"><div><span class="eyebrow">Melhores vagas</span><h3>Prioridade atual</h3></div></div>
      <div class="stack-list">${(summary.topJobs || []).map((row) => `<div class="stack-item">
        <div><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.company || "Empresa a confirmar")} · ${escapeHtml(row.source)}</small></div>
        ${scoreBadge(row)}
      </div>`).join("") || `<div class="empty-mini">Sem vaga ranqueada com link direto ainda.</div>`}</div>
    </section>
    <section>
      <div class="section-head"><div><span class="eyebrow">Fontes</span><h3>Onde estão aparecendo</h3></div></div>
      <div class="bar-list">${(summary.bySource || []).map((row) => sourceBar(row, summary.jobs)).join("") || `<div class="empty-mini">Nenhuma fonte registrada.</div>`}</div>
    </section>
    <section>
      <div class="section-head"><div><span class="eyebrow">Próximas ações</span><h3>Fila inteligente</h3></div></div>
      <div class="stack-list">${actions.length ? actions.map(([title, text, tab]) => `<button class="action-row" data-tab="${tab}"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(text)}</small></button>`).join("") : `<div class="empty-mini">Nenhuma ação crítica agora.</div>`}</div>
    </section>
  </div>`;
  document.querySelector("#scanNow").onclick = () => runScanAndRefresh("dashboard");
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
  const sources = uniqueValues(rows, "source");
  const workModels = uniqueValues(rows, "work_model");
  const statuses = uniqueValues(rows, "status");

  app.innerHTML = `<section class="page-panel">
    <div class="page-title-row">
      <div><span class="eyebrow">Vagas</span><h2>Achou as vagas</h2><p>Selecione as oportunidades que fazem sentido e aprove. Elas saem daqui e entram em Aprovadas.</p></div>
      <div class="toolbar-actions">
        <button id="scanJobs">Buscar vagas</button>
        <button id="toggleJobFilters">Filtros</button>
        <button id="selectAllJobs">Selecionar todas</button>
        <button id="clearJobs">Limpar</button>
        <button id="approveSelectedJobs" class="primary">Aprovar selecionadas</button>
      </div>
    </div>
    <div id="jobActionResult" class="note ${initialMessage ? "" : "hidden"}">${initialMessage}</div>
    ${jobGuidancePanel(rows)}
    ${realLinkImporter("jobs", () => jobs("<strong>Link real importado.</strong><p>A vaga entrou na fila como fonte direta. Selecione e aprove a oportunidade.</p>"))}
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
      if (active.source !== "all" && String(row.source) !== active.source) return false;
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
    mount.innerHTML = `<div class="table-meta"><strong>${visibleRows.length}</strong><span>vaga(s) exibida(s)</span></div>${visibleRows.length ? `<div class="opportunity-grid">${visibleRows.map(jobCard).join("")}</div>` : empty}`;
    const emptyScan = document.querySelector("#scanJobsEmpty");
    if (emptyScan) emptyScan.onclick = () => runScanAndRefresh("jobs");
  };

  document.querySelector("#scanJobs").onclick = () => runScanAndRefresh("jobs");
  bindRealLinkImporter("jobs", () => jobs("<strong>Link real importado.</strong><p>A vaga entrou na fila como fonte direta. Selecione e aprove a oportunidade.</p>"));
  document.querySelector("#toggleJobFilters").onclick = () => document.querySelector("#jobFilters").classList.toggle("collapsed");
  document.querySelector("#selectAllJobs").onclick = () => document.querySelectorAll(".job-check").forEach((input) => input.checked = true);
  document.querySelector("#clearJobs").onclick = () => document.querySelectorAll(".job-check").forEach((input) => input.checked = false);
  document.querySelector("#clearJobFilters").onclick = () => {
    localStorage.removeItem(filterKey("jobs"));
    jobs(initialMessage);
  };
  document.querySelectorAll("#jobFilters input, #jobFilters select").forEach((element) => element.addEventListener("input", applyFilters));
  document.querySelector("#approveSelectedJobs").onclick = async () => {
    const ids = [...document.querySelectorAll(".job-check:checked")].map((input) => Number(input.value));
    if (!ids.length) return showInlineResult("#jobActionResult", "Selecione pelo menos uma vaga para aprovar.");
    const data = await json("/api/jobs/approve-selected", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    const skipped = (data.skipped || []).map((item) => `<li>#${item.id}: ${escapeHtml(item.reason)}</li>`).join("");
    const message = `<strong>${data.approved} vaga(s) aprovada(s).</strong>${skipped ? `<ul>${skipped}</ul>` : ""}<p>Elas foram para a aba Aprovadas.</p>`;
    toast("Vagas aprovadas e enviadas para a etapa de candidatura.", "success");
    await jobs(message);
  };
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
    if (["autofill_pronto", "auto_apply_pronto"].includes(status)) return "ready";
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
          <div><strong>Pacote de preenchimento #${escapeHtml(action.id || "")}</strong><small>Use no formulário oficial da vaga.</small></div>
          <div class="card-actions">
            <button data-copy-autofill="${escapeHtml(autofill)}">Copiar autofill</button>
            <a class="action primary-link" href="${escapeHtml(autofill)}">Preencher esta página</a>
          </div>
        </div>
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

function buildAiApplyBookmarklet() {
  const target = `${window.location.origin}/?aiUrl=`;
  return `javascript:(()=>{const u=encodeURIComponent(location.href);const t=encodeURIComponent(document.title||'');window.open('${target}'+u+'&aiTitle='+t+'&aiSource=bookmarklet','_blank','noopener');})()`;
}

function buildAutofillBookmarklet(fields) {
  const payload = encodeURIComponent(JSON.stringify(fields));
  return `javascript:(()=>{const f=JSON.parse(decodeURIComponent('${payload}'));const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');const aliases={'Nome completo':['nome','name','full name','nome completo'],'E-mail':['email','e-mail','mail'],'Telefone':['telefone','phone','celular','whatsapp','mobile'],'LinkedIn':['linkedin','linked in'],'Cidade':['cidade','city'],'Estado':['estado','uf','state'],'País':['pais','country'],'Resumo profissional':['resumo','summary','sobre','objetivo','cover','apresentacao'],'Pretensão salarial':['salario','salary','pretensao','remuneracao'],'Disponibilidade':['disponibilidade','availability','inicio','start']};const labelFor=e=>{let t=[e.name,e.id,e.placeholder,e.getAttribute('aria-label')].join(' ');const id=e.id;if(id){const l=document.querySelector('label[for=\"'+CSS.escape(id)+'\"]');if(l)t+=' '+l.innerText}const p=e.closest('label');if(p)t+=' '+p.innerText;return norm(t)};let n=0;document.querySelectorAll('input,textarea,select').forEach(e=>{const text=labelFor(e);for(const [k,v] of Object.entries(f)){if(!v)continue;const keys=[k,...(aliases[k]||[])].map(norm);if(keys.some(a=>a&&text.includes(a))){if(e.tagName==='SELECT'){[...e.options].some(o=>{if(norm(o.text).includes(norm(v))||norm(o.value).includes(norm(v))){e.value=o.value;return true}return false})}else if(['checkbox','radio','file','submit','button','hidden'].includes(e.type)){}else{e.value=v}e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));e.style.outline='3px solid #55c29a';n++;break}}});alert('Career Hunter preencheu '+n+' campo(s). Revise antes de enviar.');})()`;
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
  const sources = uniqueValues(rows, "source");
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
      if (active.source !== "all" && String(row.source) !== active.source) return false;
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
    mount.innerHTML = `<div class="table-meta"><strong>${visibleRows.length}</strong><span>aprovada(s) exibida(s)</span><span>IA: ${counters.ia || 0}</span><span>Você faz: ${counters.manual || 0}</span><span>E-mail/WhatsApp/Telefone: ${(counters.email || 0) + (counters.whatsapp || 0) + (counters.telefone || 0)}</span></div>${visibleRows.length ? `<div class="opportunity-grid">${visibleRows.map((row) => applicationCard(row, "approved")).join("")}</div>` : empty}`;
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
  const filters = getSavedFilters("applications", { q: "", source: "all", work: "all", availability: "all", minScore: 0, stage: "all" });
  const sources = uniqueValues(rows, "source");
  const workModels = uniqueValues(rows, "work_model");
  const stages = {
    all: "Todas",
    todo: "Precisa ação",
    ia: "IA pode fazer",
    manual: "Eu faço",
    precisa_link: "Precisa link",
    sent: "Já candidatadas"
  };

  app.innerHTML = `<section class="page-panel">
    <div class="page-title-row">
      <div><span class="eyebrow">Candidaturas</span><h2>Próximo passo de cada vaga</h2><p>Veja o que cada vaga precisa agora: IA preencher, você concluir, importar link real, responder dados ou acompanhar retorno.</p></div>
      <div class="toolbar-actions">
        <button id="toggleApplicationFilters">Filtros</button>
        <button id="selectAllApplications">Selecionar todas</button>
        <button id="clearApplications">Limpar</button>
        <button id="checkAvailability" class="primary">Verificar disponibilidade</button>
      </div>
    </div>
    <div id="applicationActionResult" class="note ${initialMessage ? "" : "hidden"}">${initialMessage}</div>
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
    const visibleRows = rows.filter((row) => {
      const availability = String(row.availability_status || "nao_verificado");
      const channel = applicationChannel(row).id;
      const sent = isSentApplication(row);
      if (!includesSearch(row, active.q)) return false;
      if (active.source !== "all" && String(row.source) !== active.source) return false;
      if (active.work !== "all" && String(row.work_model) !== active.work) return false;
      if (active.availability !== "all" && availability !== active.availability) return false;
      if (Number(row.fit_score || 0) < active.minScore) return false;
      if (active.stage === "sent" && !sent) return false;
      if (active.stage === "todo" && sent) return false;
      if (active.stage === "ia" && (sent || !["ia", "dados"].includes(channel))) return false;
      if (active.stage === "manual" && (sent || !["manual", "email", "whatsapp", "telefone"].includes(channel))) return false;
      if (active.stage === "precisa_link" && (sent || channel !== "precisa_link")) return false;
      return true;
    });
    const counters = rows.reduce((acc, row) => {
      const key = isSentApplication(row) ? "sent" : applicationChannel(row).id;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const empty = `<div class="empty-state"><h3>Nenhuma candidatura nesta etapa</h3><p>Aprove vagas ou registre candidaturas enviadas para acompanhar aqui.</p><button data-tab="approved" class="primary">Ver aprovadas</button></div>`;
    mount.innerHTML = `<div class="table-meta"><strong>${visibleRows.length}</strong><span>candidatura(s) exibida(s)</span><span>IA: ${counters.ia || 0}</span><span>Precisa link: ${counters.precisa_link || 0}</span><span>Enviadas: ${counters.sent || 0}</span></div>${visibleRows.length ? `<div class="opportunity-grid">${visibleRows.map((row) => applicationCard(row, isSentApplication(row) ? "sent" : "approved")).join("")}</div>` : empty}`;
  };

  const selectedIds = () => [...document.querySelectorAll(".application-check:checked")].map((input) => Number(input.value));
  document.querySelector("#toggleApplicationFilters").onclick = () => document.querySelector("#applicationFilters").classList.toggle("collapsed");
  document.querySelector("#selectAllApplications").onclick = () => document.querySelectorAll(".application-check").forEach((input) => input.checked = true);
  document.querySelector("#clearApplications").onclick = () => document.querySelectorAll(".application-check").forEach((input) => input.checked = false);
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
  app.innerHTML = `<section class="page-panel">
    <div class="page-title-row">
      <div><span class="eyebrow">Ações</span><h2>O que preciso fazer agora</h2><p>Cada card mostra uma pendência objetiva: link real, dados faltantes, candidatura manual, e-mail, WhatsApp ou acompanhamento.</p></div>
      <div class="toolbar-actions">
        <button data-tab="jobs">Vagas</button>
        <button data-tab="approved" class="primary">Aprovadas</button>
        <button data-tab="applications">Candidaturas</button>
      </div>
    </div>
    <div class="kpi-grid compact">
      ${metricCard("Ações", data.actions.length, "pendências e próximos passos", "blue")}
      ${metricCard("Alta prioridade", data.actions.filter((item) => item.priority === "alta").length, "precisam de decisão", "warning")}
      ${metricCard("Candidatura por IA", data.actions.filter((item) => item.type === "ia").length, "podem ser preparadas", "success")}
      ${metricCard("Manual", data.actions.filter((item) => item.type === "manual").length, "você conclui no site", "gold")}
    </div>
    <div class="action-grid">${data.actions.length ? data.actions.map(actionCard).join("") : `<div class="empty-state"><h3>Nenhuma ação pendente</h3><p>Busque vagas, aprove as melhores e acompanhe os próximos passos aqui.</p><button data-tab="jobs" class="primary">Ver vagas</button></div>`}</div>
  </section>`;
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
      <div><span class="eyebrow">IA Candidatura</span><h2>Colar link e acelerar candidatura</h2><p>Cole o link real da vaga. A IA importa, aprova, prepara seus dados e mostra exatamente o que preencher.</p></div>
      <div class="toolbar-actions">
        <button id="backFromAiApply">Voltar</button>
        <button data-tab="approved">Aprovadas</button>
        <button data-tab="applications">Candidaturas</button>
      </div>
    </div>
    <div id="aiApplyResult" class="note ${initialMessage ? "" : "hidden"}">${initialMessage}</div>
    <div class="ai-apply-workbench">
      <section class="ai-apply-control">
        <span class="eyebrow">Link real</span>
        <h3>Navegador de candidatura</h3>
        <p>Cole uma vaga individual. Se o site permitir visualização embutida, ele aparece ao lado. Se bloquear, use Abrir fonte.</p>
        <label>Link da vaga<input id="aiApplyUrl" placeholder="https://empresa.com/vaga/oficial" value="${escapeHtml(initial?.url || "")}"></label>
        <div class="form-grid">
          <label>Cargo opcional<input id="aiApplyTitle" placeholder="Ex.: Atendente, Bartender, Comercial" value="${escapeHtml(initial?.title || "")}"></label>
          <label>Empresa opcional<input id="aiApplyCompany" placeholder="Nome da empresa" value="${escapeHtml(initial?.company || "")}"></label>
        </div>
        <div class="card-actions">
          <button id="loadAiFrame">Carregar página</button>
          <button id="vaiIa" class="primary">VAI IA</button>
        </div>
        <div class="bookmarklet-box">
          <strong>Favorito inteligente</strong>
          <small>Arraste o botão para a barra de favoritos. Quando estiver em uma vaga real, clique nele para mandar o link direto para esta aba.</small>
          <div class="card-actions">
            <a id="aiBookmarkletLink" class="action primary-link" href="${escapeHtml(bookmarklet)}">Importar vaga atual</a>
            <button id="copyAiBookmarklet" type="button">Copiar favorito</button>
          </div>
          <textarea id="aiBookmarkletCode" readonly rows="3">${escapeHtml(bookmarklet)}</textarea>
        </div>
        <div class="notice-mini">
          <strong>Como funciona</strong>
          <small>A IA prepara currículo, carta, respostas e campos. Ela não burla CAPTCHA, bloqueios, rastreamento ou regras de sites. O envio final de dados pessoais depende de canal permitido e da sua confirmação.</small>
        </div>
      </section>
      <section class="embedded-browser-shell">
        <div class="embedded-browser-toolbar">
          <span id="embeddedStatus">Aguardando link</span>
          <a id="openAiApplyExternal" class="action hidden" target="_blank" rel="noreferrer">Abrir fonte</a>
        </div>
        <div class="embedded-browser-stage">
          <iframe id="aiApplyFrame" title="Página da vaga" sandbox="allow-forms allow-popups allow-same-origin allow-scripts" referrerpolicy="no-referrer"></iframe>
          <div id="frameFallback" class="frame-fallback hidden">
            <strong>Este site pode bloquear a visualização interna.</strong>
            <small>Use Abrir fonte para concluir no site oficial. A IA continua preparando currículo, carta e respostas por aqui.</small>
            <a id="frameFallbackExternal" class="action primary-link" target="_blank" rel="noreferrer">Abrir fonte oficial</a>
          </div>
        </div>
      </section>
    </div>
  </section>`;

  const urlInput = document.querySelector("#aiApplyUrl");
  const frame = document.querySelector("#aiApplyFrame");
  const status = document.querySelector("#embeddedStatus");
  const external = document.querySelector("#openAiApplyExternal");
  const fallback = document.querySelector("#frameFallback");
  const fallbackExternal = document.querySelector("#frameFallbackExternal");
  const normalizeUrl = () => urlInput.value.trim();
  const applicationId = Number(initial?.applicationId || 0);
  let frameLoadTimer = null;
  const showFrameFallback = (url, message = "Visualização interna indisponível") => {
    status.textContent = message;
    fallbackExternal.href = url;
    fallback.classList.remove("hidden");
  };
  const loadFrame = () => {
    const url = normalizeUrl();
    if (!url) return showInlineResult("#aiApplyResult", "Cole o link real da vaga primeiro.");
    if (isGoogleSearchUrl(url)) {
      showInlineResult("#aiApplyResult", "<strong>Use o link final da vaga.</strong><p>Este link é uma página de busca do Google. Abra o resultado da empresa ou do site de vagas e importe a URL da vaga individual.</p>");
      return;
    }
    try {
      new URL(url);
    } catch {
      showInlineResult("#aiApplyResult", "Informe um link completo começando com http:// ou https://.");
      return;
    }
    if (frameLoadTimer) window.clearTimeout(frameLoadTimer);
    fallback.classList.add("hidden");
    frame.src = "about:blank";
    frame.src = url;
    external.href = url;
    fallbackExternal.href = url;
    external.classList.remove("hidden");
    status.textContent = "Carregando visualização segura";
    frameLoadTimer = window.setTimeout(() => showFrameFallback(url), 4200);
  };
  frame.addEventListener("load", () => {
    if (frameLoadTimer) window.clearTimeout(frameLoadTimer);
    if (frame.src && frame.src !== "about:blank") status.textContent = "Visualização carregada. Se ficar em branco, use Abrir fonte.";
  });
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
    const url = normalizeUrl();
    if (!url) return showInlineResult("#aiApplyResult", "Cole o link real da vaga primeiro.");
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
          title: document.querySelector("#aiApplyTitle").value.trim() || undefined,
          company: document.querySelector("#aiApplyCompany").value.trim() || undefined
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
    showInlineResult("#aiApplyResult", `${renderAutomationResult(result)}<p>Depois de revisar/preencher no site, registre o envio para mover a vaga para Candidaturas e acompanhar disponibilidade.</p>${markSentButton(preparedIds, "Registrei minha candidatura")}`);
    toast("IA preparou a candidatura para o link informado.", "success");
  };
  document.querySelector("#loadAiFrame").onclick = loadFrame;
  document.querySelector("#vaiIa").onclick = prepareWithAi;
  document.querySelector("#backFromAiApply").onclick = () => load(aiApplyReturnTab || "approved");
  if (initial?.url && initial.autoLoad) {
    loadFrame();
    showInlineResult("#aiApplyResult", "<strong>Link carregado.</strong><p>Revise a página aberta e clique em VAI IA para preparar a candidatura com seu currículo.</p>");
  }
  if (initial?.url && initial.autoPrepare) {
    loadFrame();
    await prepareWithAi();
  }
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
      <button data-tab="approved" class="primary">Usar nas aprovadas</button>
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
        <label>Nome do perfil<input id="profileLabel" placeholder="Ex: Giasi principal"></label>
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
  const [data, resumes, env, profileData] = await Promise.all([json("/api/settings"), json("/api/resumes"), json("/api/environment"), json("/api/profiles")]);
  const activeProfile = profileData.active || {};
  const careerLevels = getPath(data, "jobSearchPreferences.careerLevels", {});
  const workStyles = getPath(data, "jobSearchPreferences.workStyles", {});
  const schedules = getPath(data, "jobSearchPreferences.schedulePreferences", {});
  const contracts = getPath(data, "jobSearchPreferences.contractTypes", {});
  const education = getPath(data, "jobSearchPreferences.educationFilters", {});
  const license = getPath(data, "jobSearchPreferences.driverLicenseFilters", {});
  const sources = getPath(data, "sources", {});
  const tracks = getPath(data, "careerTracks", {});
  const informalWork = getPath(data, "informalWork", {});

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
      <button data-jump="seguranca">Segurança</button>
      <button data-jump="codigo">Código</button>
    </aside>

    <section class="settings-panel">
      <div class="settings-head">
        <div><span class="eyebrow">Meu Perfil</span><h2>Currículo, preferências e IA</h2><p>Um lugar só para seus dados, currículo, vagas desejadas, fontes de busca e chaves de IA.</p></div>
        <div class="save-box"><button id="saveVisualSettings" class="primary">Salvar meu perfil</button><span id="saveStatus"></span></div>
      </div>

      <div class="config-section" id="perfil">
        <h3>Dados do perfil</h3>
        <div class="form-grid">
          ${input("Nome", "profile.name", data.profile.name)}
          ${input("E-mail", "profile.email", data.profile.email)}
          ${input("Telefone", "profile.phone", data.profile.phone)}
          ${input("LinkedIn", "profile.linkedin", data.profile.linkedin)}
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
        <div class="form-grid">
          <div class="field"><label>Chave OpenAI</label><input id="envOpenaiKey" type="password" placeholder="${env.openaiConfigured ? "Chave configurada. Digite outra para trocar." : "Cole sua OPENAI_API_KEY"}"><small>Não vai para o GitHub. Fica no .env ou nos segredos do servidor online.</small></div>
          <div class="field"><label>Modelo OpenAI</label><input id="envOpenaiModel" value="${escapeHtml(env.openaiModel || "gpt-4o-mini")}"></div>
          <div class="field"><label>Chave Gemini</label><input id="envGeminiKey" type="password" placeholder="${env.geminiConfigured ? "Chave configurada. Digite outra para trocar." : "Cole sua GEMINI_API_KEY"}"><small>Usada como apoio/fallback para análise e respostas quando o módulo estiver habilitado.</small></div>
          <div class="field"><label>Modelo Gemini</label><input id="envGeminiModel" value="${escapeHtml(env.geminiModel || "gemini-1.5-flash")}"></div>
          <div class="field"><label>Google Search API Key</label><input id="envGoogleKey" type="password" placeholder="${env.googleSearchConfigured ? "Configurada. Digite outra para trocar." : "Opcional"}"></div>
          <div class="field"><label>Google Search Engine ID</label><input id="envGoogleCx" value=""></div>
          <div class="field"><label>Banco online DATABASE_URL</label><input id="envDatabaseUrl" value="${escapeHtml(env.databaseUrl || "file:./data/jobs.sqlite")}"><small>Para Render/Railway use um caminho persistente, ex: file:/var/data/jobs.sqlite.</small></div>
          <div class="field"><label>Porta do painel</label><input id="envPort" value="${escapeHtml(env.port || "8788")}"></div>
        </div>
        <div class="env-status">
          <span class="state-chip ${env.openaiConfigured ? "success" : "warning"}">OpenAI ${env.openaiConfigured ? "ativa" : "pendente"}</span>
          <span class="state-chip ${env.geminiConfigured ? "success" : "info"}">Gemini ${env.geminiConfigured ? "ativa" : "opcional"}</span>
          <span class="state-chip ${env.googleSearchConfigured ? "success" : "info"}">Google Search ${env.googleSearchConfigured ? "ativo" : "opcional"}</span>
          <span class="state-chip ${env.envExists ? "success" : "warning"}">.env ${env.envExists ? "criado" : "não criado"}</span>
        </div>
        <button id="saveEnvConfig" class="primary">Salvar IA no .env</button><span id="envSaveStatus"></span>
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

      <div class="config-section" id="seguranca">
        <h3>Estratégia e segurança</h3>
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
          ${settingToggle("LinkedIn só busca", "applications.allowLinkedInSearchOnly", getPath(data, "applications.allowLinkedInSearchOnly"), "Encontra vagas no LinkedIn, mas você abre e se candidata manualmente.")}
          ${settingToggle("Exigir aprovação", "applications.requireApprovalBeforeApply", getPath(data, "applications.requireApprovalBeforeApply"), "Mantém você no controle antes de qualquer candidatura.")}
          ${settingToggle("APIs oficiais", "applications.allowQuickApplyAPIs", getPath(data, "applications.allowQuickApplyAPIs"), "Use apenas com integração oficial/permitida pela plataforma.")}
          ${settingToggle("Autofill no navegador", "applications.allowBrowserAutofill", getPath(data, "applications.allowBrowserAutofill"), "Ajuda a preencher, mas não burla login, CAPTCHA ou regras de site.")}
        </div>
      </div>

      <div class="config-section" id="codigo">
        <h3>Código gerado pelas suas escolhas</h3>
        <p>Este é o arquivo <code>agent-settings.json</code> usado pelo agente.</p>
        <textarea id="settingsCode" class="code-output" spellcheck="false"></textarea>
      </div>
    </section>
  </div>`;

  let currentSettings = structuredClone(data);
  const code = document.querySelector("#settingsCode");
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
  document.querySelector("#saveVisualSettings").onclick = async () => {
    syncCode();
    await json("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: code.value });
    document.querySelector("#saveStatus").textContent = "Meu Perfil foi salvo.";
    toast("Meu Perfil e preferências foram salvos.", "success");
  };
  document.querySelector("#saveEnvConfig").onclick = async () => {
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
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  try {
    if (tab === "jobs") return jobs();
    if (tab === "approved") return approved();
    if (tab === "informal") return informal();
    if (tab === "applications") return applications();
    if (tab === "actions") return applications();
    if (tab === "aiApply") return aiApplyPage();
    if (tab === "accounts") return accountsPage();
    if (["profile", "profiles", "resume", "settings"].includes(tab)) return settings();
    if (tab === "logs") return logs();
    return dashboard();
  } catch (error) {
    app.innerHTML = `<section class="notice-panel"><h2>Algo não carregou</h2><p>${escapeHtml(error.message)}</p><button data-tab="dashboard">Voltar ao painel</button></section>`;
    toast(escapeHtml(error.message), "error");
  }
}

header.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  const theme = event.target.closest("#themeToggle");
  const logout = event.target.closest("#logoutButton");
  if (button && currentUser) load(button.dataset.tab);
  if (theme) {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("careerHunterTheme", next);
    document.querySelector("#themeToggle").textContent = next === "dark" ? "Modo claro" : "Modo escuro";
  }
  if (logout) {
    json("/api/auth/logout", { method: "POST" }).finally(() => {
      currentUser = null;
      renderAuth("<strong>Sessão encerrada.</strong>");
    });
  }
});

app.addEventListener("click", (event) => {
  const detail = event.target.closest("[data-detail]");
  const tab = event.target.closest("[data-tab]");
  const retry = event.target.closest("[data-retry]");
  const aiApply = event.target.closest("[data-ai-apply]");
  const accelerate = event.target.closest("[data-accelerate-url]");
  const markSent = event.target.closest("[data-mark-sent]");
  const saveMemory = event.target.closest("[data-save-memory]");
  const copyValue = event.target.closest("[data-copy-value]");
  const copyAutofill = event.target.closest("[data-copy-autofill]");
  if (detail) jobDetail(detail.dataset.detail, currentTab);
  if (tab) load(tab.dataset.tab);
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
  if (accelerate) {
    aiApplyReturnTab = currentTab || "approved";
    setAiApplyPrefill({
      url: accelerate.dataset.accelerateUrl,
      title: accelerate.dataset.accelerateTitle,
      company: accelerate.dataset.accelerateCompany,
      applicationId: accelerate.dataset.accelerateApplicationId,
      autoLoad: true
    });
    load("aiApply");
  }
  if (retry) {
    json("/api/applications/retry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [Number(retry.dataset.retry)] }) })
      .then(() => {
        toast("Candidatura recolocada para tentar novamente.", "success");
        return applications();
      })
      .catch((error) => toast(escapeHtml(error.message), "error"));
  }
  if (aiApply) {
    const url = String(aiApply.dataset.applicationUrl || "").trim();
    if (url && !isGoogleSearchUrl(url)) {
      aiApplyReturnTab = currentTab || "approved";
      setAiApplyPrefill({
        url,
        title: aiApply.dataset.applicationTitle,
        company: aiApply.dataset.applicationCompany,
        applicationId: aiApply.dataset.aiApply,
        autoLoad: true,
        autoPrepare: true
      });
      load("aiApply");
      return;
    }
    json("/api/applications/ai-apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [Number(aiApply.dataset.aiApply)] }) })
      .then((data) => {
        toast("IA preparou a candidatura desta vaga.", "success");
        return approved(renderAutomationResult(data));
      })
      .catch((error) => toast(escapeHtml(error.message), "error"));
  }
  if (markSent) {
    const ids = String(markSent.dataset.markSent || "").split(",").map(Number).filter(Boolean);
    json("/api/applications/mark-sent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) })
      .then(() => {
        toast("Candidatura marcada como enviada.", "success");
        return applications();
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
      return approved();
    }).catch((error) => toast(escapeHtml(error.message), "error"));
  }
});

boot();
