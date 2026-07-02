const app = document.querySelector("#app");
const header = document.querySelector("header");

const tabs = [
  ["dashboard", "Painel"],
  ["jobs", "Vagas"],
  ["applications", "Candidaturas"],
  ["resume", "Meu Curriculo"],
  ["informal", "Freelas"],
  ["settings", "Configuracoes"],
  ["logs", "Logs"]
];

const assistedSources = new Set(["google-assisted-search", "sine", "infojobs", "jobs99", "rh-agencies-curitiba"]);

const tableColumns = {
  jobs: [
    { id: "select", label: "", always: true, render: (row) => `<input class="job-check" type="checkbox" value="${row.id}">` },
    { id: "title", label: "Nome da vaga", render: (row) => `<strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.company || "Empresa a confirmar")}</small>` },
    { id: "salary", label: "Salario", render: (row) => escapeHtml(row.salary || "Nao informado") },
    { id: "location", label: "Local", render: (row) => escapeHtml(row.location || "A confirmar") },
    { id: "work_model", label: "Tipo de trabalho", render: (row) => escapeHtml(row.work_model || "A confirmar") },
    { id: "description", label: "Descricao resumida", render: (row) => escapeHtml(shortDescription(row.description)) },
    { id: "source", label: "Fonte", render: (row) => `${sourceBadge(row.source)}<small>${row.url ? "Link disponivel" : "Sem link direto"}</small>` },
    { id: "score", label: "Nota", render: (row) => scoreBadge(row) },
    { id: "status", label: "Status", render: (row) => stateChip(row) },
    { id: "risk", label: "Risco", default: false, render: (row) => `<strong class="${riskClass(row.risk_score)}">${row.risk_score ?? "-"}</strong><small>${escapeHtml(row.risk_flags || "Sem alerta")}</small>` },
    { id: "found_at", label: "Encontrada em", default: false, render: (row) => formatDate(row.found_at) },
    { id: "action", label: "Acao", always: true, render: (row) => `${row.url ? `<a class="action" href="${escapeHtml(row.url)}" target="_blank" rel="noreferrer">Abrir fonte</a>` : ""}<button data-detail="${row.id}">Detalhes</button>` }
  ],
  applications: [
    { id: "select", label: "", always: true, render: (row) => `<input class="application-check" type="checkbox" value="${row.id}">` },
    { id: "title", label: "Nome da vaga", render: (row) => `<strong>${escapeHtml(row.title || `Vaga ${row.job_id || ""}`)}</strong><small>${escapeHtml(row.company || "Empresa a confirmar")}</small>` },
    { id: "salary", label: "Salario", render: (row) => escapeHtml(row.salary || "Nao informado") },
    { id: "location", label: "Local", render: (row) => escapeHtml(row.location || "A confirmar") },
    { id: "work_model", label: "Tipo de trabalho", render: (row) => escapeHtml(row.work_model || "A confirmar") },
    { id: "description", label: "Descricao resumida", render: (row) => escapeHtml(shortDescription(row.description)) },
    { id: "source", label: "Fonte", render: (row) => `${sourceBadge(row.source)}<small>${row.url ? "tem link" : "sem link"}</small>` },
    { id: "score", label: "Nota", render: (row) => scoreBadge(row) },
    { id: "status", label: "Status", render: (row) => `${stateChip(row)}<small>${escapeHtml(row.application_status || "-")}</small>` },
    { id: "dates", label: "Datas", render: (row) => `<small>Preparada: ${formatDate(row.created_at)}</small><small>Ultima acao: ${formatDate(row.updated_at)}</small><small>Candidatado: ${formatDate(row.applied_at)}</small>` },
    { id: "assets", label: "Curriculo/Carta", render: (row) => `<small>CV: ${escapeHtml(row.generated_resume_path || "Nao gerado")}</small><small>Carta: ${escapeHtml(row.cover_letter_path || "Nao gerada")}</small>` },
    { id: "risk", label: "Risco", default: false, render: (row) => `<strong class="${riskClass(row.risk_score)}">${row.risk_score ?? "-"}</strong><small>${escapeHtml(row.risk_flags || "Sem alerta")}</small>` },
    { id: "action", label: "Acao", always: true, render: (row) => `${row.url ? `<a class="action" href="${escapeHtml(row.url)}" target="_blank" rel="noreferrer">Abrir fonte</a>` : ""}${row.job_id ? `<button data-detail="${row.job_id}">Detalhes</button>` : ""}` }
  ]
};

document.documentElement.dataset.theme = localStorage.getItem("careerHunterTheme") || "light";
renderShell();

function renderShell() {
  header.innerHTML = `
    <div class="brand-row">
      <button class="brand-lockup" data-tab="dashboard" title="Ir para o painel">
        <span class="brand-mark">CH</span>
        <span><strong>Career Hunter</strong><small>Agente de carreira</small></span>
      </button>
      <nav id="mainNav">${tabs.map(([id, label]) => `<button data-tab="${id}">${label}</button>`).join("")}</nav>
      <button id="themeToggle" title="Alternar modo escuro"></button>
    </div>`;
  document.querySelector("#themeToggle").textContent = document.documentElement.dataset.theme === "dark" ? "Modo claro" : "Modo escuro";
}

async function json(url, options) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(typeof data === "string" ? data : data.error || "Erro na requisicao");
  }
  return data;
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
    googleJobsSearch: "Busca Google",
    rhAgenciesCuritiba: "Agencias de RH em Curitiba",
    jobs99: "99jobs",
    gmailAlerts: "Alertas do Gmail",
    manualUrlImporter: "Links manuais",
    companyHunter: "Empresas-alvo",
    companyCareerPages: "Paginas de carreira",
    linkedinEmailAlertsOnly: "LinkedIn por e-mail",
    indeedEmailAlertsOnly: "Indeed por e-mail",
    cathoEmailAlertsOnly: "Catho por e-mail",
    infojobsEmailAlertsOnly: "InfoJobs por e-mail",
    informalWorkHunter: "Freelas e bicos",
    homeOffice: "Home office",
    remoto: "Remoto",
    hibrido: "Hibrido",
    presencial: "Presencial",
    comViagem: "Com viagem",
    semViagem: "Sem viagem",
    campoExterno: "Campo externo",
    comMudancaCidade: "Com mudanca de cidade",
    semMudancaCidade: "Sem mudanca de cidade",
    operacional: "Operacional",
    auxiliar: "Auxiliar",
    assistente: "Assistente",
    tecnico: "Tecnico",
    analista: "Analista",
    especialista: "Especialista",
    supervisao: "Supervisao",
    coordenacao: "Coordenacao",
    gestao: "Gestao",
    gerencia: "Gerencia",
    consultoria: "Consultoria",
    freelancerEventos: "Freelancer/eventos",
    clt: "CLT",
    pj: "PJ",
    temporario: "Temporario",
    freelancer: "Freelancer",
    contrato: "Contrato",
    intermitente: "Intermitente",
    estagio: "Estagio"
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

function checkboxGrid(title, group, values) {
  return `<div class="field-block"><label>${title}</label><div class="choice-grid">${Object.entries(values || {}).map(([key, value]) => `
    <label class="check-pill"><input type="checkbox" data-path="${group}.${key}" ${value ? "checked" : ""}> <span>${labelize(key)}</span></label>
  `).join("")}</div></div>`;
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
  const clean = String(value || "Sem descricao informada.").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}

function scoreBadge(row) {
  return `<div class="score-stack">
    <strong>${row.fit_score ?? "-"}</strong>
    <span>${escapeHtml(row.status || row.job_status || "Sem classificacao")}</span>
    <small>Risco ${row.risk_score ?? "-"}</small>
  </div>`;
}

function applicationState(row) {
  if (Number(row.sent_by_agent) === 1 || row.application_status === "Candidatura enviada") {
    return { label: "Candidatado", tone: "success", detail: row.applied_at ? `Enviado em ${formatDate(row.applied_at)}` : "Envio registrado" };
  }
  if (row.application_status === "Pronta para envio assistido") {
    return { label: "Pronta", tone: "ready", detail: "Abrir fonte oficial" };
  }
  if (row.application_status === "Aguardando vaga real da fonte") {
    return { label: "Precisa vaga real", tone: "warning", detail: "Fonte assistida" };
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
    return { label: "Preparada", tone: "info", detail: "Aguardando aprovacao" };
  }
  return { label: "Nova", tone: "muted", detail: "Ainda em vagas" };
}

function stateChip(row) {
  const state = applicationState(row);
  return `<span class="state-chip ${state.tone}">${state.label}</span><small>${escapeHtml(state.detail)}</small>`;
}

function sourceBadge(source) {
  return `<span class="source-badge">${escapeHtml(source || "Fonte")}</span>`;
}

function formatDate(value) {
  if (!value) return "Ainda nao registrado";
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
  return `<table class="data-table"><thead><tr>${activeColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${activeColumns.map((column) => `<td>${column.render(row)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
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
  toast("Buscando novas vagas. O radar esta rodando uma nova pesquisa.", "info");
  try {
    const data = await json("/api/scan", { method: "POST" });
    if (!data.ok) throw new Error(data.error || "falha desconhecida");
    toast("Busca concluida. Novas oportunidades foram verificadas.", "success");
    await load(target);
  } catch (error) {
    toast(`Erro ao buscar vagas: ${escapeHtml(error.message)}`, "error");
  }
}

async function dashboard() {
  const [summary, profile] = await Promise.all([json("/api/summary"), json("/api/career-profile")]);
  const actions = [
    !summary.environment.openaiConfigured ? ["Configurar IA", "Adicione sua OPENAI_API_KEY para cartas e respostas mais fortes.", "settings"] : null,
    Number(summary.availableJobs) > 0 ? ["Revisar vagas", `${summary.availableJobs} vaga(s) novas fora da fila de candidatura.`, "jobs"] : null,
    Number(summary.awaitingApproval) > 0 ? ["Aprovar candidaturas", `${summary.awaitingApproval} candidatura(s) aguardando sua decisao.`, "applications"] : null,
    Number(summary.waitingRealJob) > 0 ? ["Validar fonte", `${summary.waitingRealJob} entrada(s) precisam de link real da vaga.`, "applications"] : null
  ].filter(Boolean);

  app.innerHTML = `<div class="command-hero">
    <div class="hero-copy">
      <span class="eyebrow">Centro de comando</span>
      <h2>Pipeline de carreira premium</h2>
      <p>Busca, triagem, curriculo, aprovacao e candidatura assistida em um fluxo unico.</p>
    </div>
    <div class="hero-actions">
      <button id="scanNow" class="primary">Buscar vagas</button>
      <button data-tab="jobs">Vagas</button>
      <button data-tab="applications">Candidaturas</button>
      <button data-tab="resume">Meu curriculo</button>
    </div>
  </div>

  <div class="kpi-grid">
    ${metricCard("Vagas novas", summary.availableJobs, "Fora da fila de candidatura", "accent")}
    ${metricCard("Radar total", summary.jobs, "Historico encontrado", "blue")}
    ${metricCard("Preparadas", summary.applications, "Curriculo e carta gerados", "gold")}
    ${metricCard("Aguardando voce", summary.awaitingApproval, "Precisam aprovacao", "warning")}
    ${metricCard("Aprovadas", summary.approved, "Liberadas por voce", "ready")}
    ${metricCard("Prontas", summary.ready, "Fonte oficial aberta", "accent")}
    ${metricCard("Candidatadas", summary.sent, `Ultima: ${formatDate(summary.lastAppliedAt)}`, "success")}
    ${metricCard("Freelas", summary.informal, "Taxas e eventos", "blue")}
  </div>

  <div class="command-grid">
    <section class="pipeline-panel">
      <div class="section-head"><div><span class="eyebrow">Pipeline</span><h3>Status operacional</h3></div></div>
      <div class="pipeline-track">
        ${pipelineStage("Busca", summary.jobs, "captadas")}
        ${pipelineStage("Novas", summary.availableJobs, "para revisar")}
        ${pipelineStage("Preparacao", summary.applications, "na fila")}
        ${pipelineStage("Aprovacao", summary.approved, "liberadas")}
        ${pipelineStage("Candidatura", summary.sent, "registradas")}
      </div>
      <div class="status-board">
        ${(summary.byApplicationStatus || []).map((row) => `<div><span>${escapeHtml(row.status)}</span><strong>${row.total}</strong></div>`).join("") || "<p>Nenhum status registrado ainda.</p>"}
      </div>
    </section>

    <section class="ai-panel">
      <div class="section-head"><div><span class="eyebrow">IA e curriculo</span><h3>${profile.ai.openaiConfigured ? "IA ativa" : "IA aguardando chave"}</h3></div><span class="state-chip ${profile.ai.openaiConfigured ? "success" : "warning"}">${escapeHtml(profile.ai.model)}</span></div>
      <p class="tight">${escapeHtml(profile.applicationPositioning.headline)}</p>
      <div class="resume-snapshot">
        <div><strong>${profile.resumes.length}</strong><span>curriculo(s) base</span></div>
        <div><strong>${profile.generatedResumes.length}</strong><span>CVs gerados</span></div>
        <div><strong>${profile.generatedCoverLetters.length}</strong><span>cartas geradas</span></div>
      </div>
      <button data-tab="settings" class="full">Configurar IA e perfil</button>
    </section>
  </div>

  <div class="three-column">
    <section>
      <div class="section-head"><div><span class="eyebrow">Melhores vagas</span><h3>Prioridade atual</h3></div><button data-tab="jobs">Abrir</button></div>
      <div class="stack-list">${(summary.topJobs || []).map((row) => `<div class="stack-item">
        <div><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.company || "Empresa a confirmar")} · ${escapeHtml(row.source)}</small></div>
        ${scoreBadge(row)}
      </div>`).join("") || `<div class="empty-mini">Sem vaga ranqueada fora das fontes assistidas.</div>`}</div>
    </section>
    <section>
      <div class="section-head"><div><span class="eyebrow">Fontes</span><h3>Onde estao aparecendo</h3></div></div>
      <div class="bar-list">${(summary.bySource || []).map((row) => sourceBar(row, summary.jobs)).join("") || `<div class="empty-mini">Nenhuma fonte registrada.</div>`}</div>
    </section>
    <section>
      <div class="section-head"><div><span class="eyebrow">Proximas acoes</span><h3>Fila inteligente</h3></div></div>
      <div class="stack-list">${actions.length ? actions.map(([title, text, tab]) => `<button class="action-row" data-tab="${tab}"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(text)}</small></button>`).join("") : `<div class="empty-mini">Fluxo sem pendencias criticas agora.</div>`}</div>
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
  const filters = getSavedFilters("jobs", { q: "", source: "all", work: "all", status: "all", minScore: 0, salary: false, assisted: "all" });
  const sources = uniqueValues(rows, "source");
  const workModels = uniqueValues(rows, "work_model");
  const statuses = uniqueValues(rows, "status");

  app.innerHTML = `<section class="page-panel">
    <div class="page-title-row">
      <div><span class="eyebrow">Vagas</span><h2>Oportunidades novas</h2><p>Quando uma vaga vira candidatura, ela sai daqui para evitar repeticao.</p></div>
      <div class="toolbar-actions">
        <button id="scanJobs">Buscar vagas</button>
        <button id="toggleJobFilters">Filtros e colunas</button>
        <button id="selectAllJobs">Selecionar todas</button>
        <button id="clearJobs">Limpar</button>
        <button id="prepareSelectedJobs" class="primary">Mover para candidaturas</button>
      </div>
    </div>
    <div id="jobActionResult" class="note ${initialMessage ? "" : "hidden"}">${initialMessage}</div>
    <div id="jobFilters" class="filter-studio">
      <div class="filter-grid">
        <label>Buscar<input id="jobSearch" value="${escapeHtml(filters.q)}" placeholder="cargo, empresa, cidade, fonte"></label>
        <label>Fonte<select id="jobSource">${optionList(sources, filters.source, "Todas")}</select></label>
        <label>Tipo de trabalho<select id="jobWork">${optionList(workModels, filters.work, "Todos")}</select></label>
        <label>Status<select id="jobStatus">${optionList(statuses, filters.status, "Todos")}</select></label>
        <label>Nota minima<input id="jobMinScore" type="number" min="0" max="100" value="${Number(filters.minScore || 0)}"></label>
        <label>Tipo de fonte<select id="jobAssisted"><option value="all">Todas</option><option value="real" ${filters.assisted === "real" ? "selected" : ""}>Vagas com fonte direta</option><option value="assisted" ${filters.assisted === "assisted" ? "selected" : ""}>Buscas assistidas</option></select></label>
        <label class="check-line"><input id="jobSalary" type="checkbox" ${filters.salary ? "checked" : ""}> Somente com salario</label>
        <button id="clearJobFilters">Limpar filtros</button>
      </div>
      ${columnPicker("jobs", tableColumns.jobs)}
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
    assisted: document.querySelector("#jobAssisted").value
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
      return true;
    });
    const empty = rows.length
      ? `<div class="empty-state"><h3>Nenhuma vaga bate com os filtros</h3><p>Ajuste filtros ou rode uma nova busca.</p><button id="scanJobsEmpty" class="primary">Buscar vagas</button></div>`
      : `<div class="empty-state"><h3>Nenhuma vaga nova na fila</h3><p>As vagas movidas para candidatura saem daqui automaticamente. Rode uma nova pesquisa para buscar oportunidades diferentes.</p><button id="scanJobsEmpty" class="primary">Buscar vagas</button></div>`;
    mount.innerHTML = `<div class="table-meta"><strong>${visibleRows.length}</strong><span>vaga(s) exibida(s)</span></div>${renderTable("jobs", visibleRows, tableColumns.jobs, empty)}`;
    const emptyScan = document.querySelector("#scanJobsEmpty");
    if (emptyScan) emptyScan.onclick = () => runScanAndRefresh("jobs");
  };

  document.querySelector("#scanJobs").onclick = () => runScanAndRefresh("jobs");
  document.querySelector("#toggleJobFilters").onclick = () => document.querySelector("#jobFilters").classList.toggle("collapsed");
  document.querySelector("#selectAllJobs").onclick = () => document.querySelectorAll(".job-check").forEach((input) => input.checked = true);
  document.querySelector("#clearJobs").onclick = () => document.querySelectorAll(".job-check").forEach((input) => input.checked = false);
  document.querySelector("#clearJobFilters").onclick = () => {
    localStorage.removeItem(filterKey("jobs"));
    jobs(initialMessage);
  };
  document.querySelectorAll("#jobFilters input, #jobFilters select").forEach((element) => element.addEventListener("input", applyFilters));
  document.querySelectorAll('[data-column-scope="jobs"]').forEach((element) => element.addEventListener("change", () => {
    saveVisibleColumns("jobs", tableColumns.jobs);
    applyFilters();
  }));
  document.querySelector("#prepareSelectedJobs").onclick = async () => {
    const ids = [...document.querySelectorAll(".job-check:checked")].map((input) => Number(input.value));
    if (!ids.length) return showInlineResult("#jobActionResult", "Selecione pelo menos uma vaga.");
    const data = await json("/api/jobs/prepare-selected", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    const skipped = (data.skipped || []).map((item) => `<li>#${item.id}: ${escapeHtml(item.reason)}</li>`).join("");
    const message = `<strong>${data.prepared} candidatura(s) preparada(s).</strong>${skipped ? `<ul>${skipped}</ul>` : ""}<p>Elas foram para a aba Candidaturas.</p>`;
    toast("Candidaturas preparadas e movidas para a fila.", "success");
    await jobs(message);
  };
  applyFilters();
}

function showInlineResult(selector, message) {
  const result = document.querySelector(selector);
  result.classList.remove("hidden");
  result.innerHTML = message;
}

function applicationGuidance(row) {
  if (row.source === "google-assisted-search") return "Abra a busca do Google, escolha a vaga real na pagina de resultados e importe o link especifico em data/manual-urls.txt.";
  if (["sine", "infojobs", "jobs99", "rh-agencies-curitiba"].includes(row.source)) return "Esta entrada e uma busca assistida. Abra o link, escolha uma vaga real e importe o link especifico para personalizar a candidatura.";
  if (row.url) return `Abra o link oficial da fonte (${row.source}) e revise os dados antes do envio.`;
  if (row.source === "companyHunter") return "Prospecao ativa sem link. Pesquise pagina Trabalhe Conosco, contato de RH ou e-mail oficial da empresa.";
  if (String(row.source).includes("whatsapp")) return "Sem link no WhatsApp. Peça empresa, local, horario, remuneracao, responsavel e forma oficial de candidatura.";
  return "Sem link encontrado. Confirme a fonte original antes de enviar dados pessoais.";
}

async function jobDetail(id) {
  const row = await json(`/api/jobs/${id}`);
  app.innerHTML = `<section class="detail-page">
    <div class="page-title-row">
      <div><button data-tab="jobs">Voltar</button><span class="eyebrow">Detalhe da vaga</span><h2>${escapeHtml(row.title)}</h2><p>${escapeHtml(row.company || "Empresa a confirmar")}</p></div>
      ${row.url ? `<a class="action primary-link" href="${escapeHtml(row.url)}" target="_blank" rel="noreferrer">Abrir fonte</a>` : ""}
    </div>
    <div class="kpi-grid compact">
      ${metricCard("Fit", row.fit_score, row.fit_reason || "A confirmar", "accent")}
      ${metricCard("Chance", row.hire_chance_score, row.hire_chance_reason || "A confirmar", "blue")}
      ${metricCard("Qualidade", row.job_quality_score, row.status || "Sem status", "gold")}
      ${metricCard("Risco", row.risk_score, row.risk_flags || "Sem alerta", Number(row.risk_score) >= 60 ? "warning" : "ready")}
    </div>
    <div class="two-column">
      <section>
        <h3>Informacoes principais</h3>
        <div class="profile-grid">
          <div><span>Salario</span><strong>${escapeHtml(row.salary || "Nao informado")}</strong></div>
          <div><span>Local</span><strong>${escapeHtml(row.location || "A confirmar")}</strong></div>
          <div><span>Modelo</span><strong>${escapeHtml(row.work_model || "A confirmar")}</strong></div>
          <div><span>Fonte</span><strong>${escapeHtml(row.source || "A confirmar")}</strong></div>
          <div><span>Nivel</span><strong>${escapeHtml(row.seniority_level || "A confirmar")}</strong></div>
          <div><span>Escolaridade</span><strong>${escapeHtml(row.education_required || "Nao informada")}</strong></div>
        </div>
        <h3>Como saber mais ou se candidatar</h3>
        <p>${applicationGuidance(row)}</p>
      </section>
      <section>
        <h3>Descricao</h3>
        <pre>${escapeHtml(row.description || "Sem descricao.")}</pre>
      </section>
    </div>
  </section>`;
}

async function applications(initialMessage = "") {
  const rows = await json("/api/applications");
  const filters = getSavedFilters("applications", { q: "", source: "all", work: "all", status: "all", minScore: 0, channel: "all", sent: "all" });
  const sources = uniqueValues(rows, "source");
  const workModels = uniqueValues(rows, "work_model");
  const statuses = uniqueValues(rows, "application_status");

  app.innerHTML = `<section class="page-panel">
    <div class="page-title-row">
      <div><span class="eyebrow">Candidaturas</span><h2>Fila de envio assistido</h2><p>Aprovacao, status, datas e materiais gerados em um so lugar.</p></div>
      <div class="toolbar-actions">
        <button id="toggleApplicationFilters">Filtros e colunas</button>
        <button id="selectAllApplications">Selecionar todas</button>
        <button id="clearApplications">Limpar</button>
        <button id="approveApplications" class="primary">Aprovar</button>
        <button id="assistedApplyApplications">Candidatar-se com IA</button>
        <button id="markSentApplications">Marcar enviada</button>
        <button id="rejectApplications">Rejeitar</button>
      </div>
    </div>
    <div id="applicationActionResult" class="note ${initialMessage ? "" : "hidden"}">${initialMessage}</div>
    <div id="applicationFilters" class="filter-studio">
      <div class="filter-grid">
        <label>Buscar<input id="applicationSearch" value="${escapeHtml(filters.q)}" placeholder="vaga, empresa, fonte, status"></label>
        <label>Fonte<select id="applicationSource">${optionList(sources, filters.source, "Todas")}</select></label>
        <label>Tipo de trabalho<select id="applicationWork">${optionList(workModels, filters.work, "Todos")}</select></label>
        <label>Status<select id="applicationStatus">${optionList(statuses, filters.status, "Todos")}</select></label>
        <label>Nota minima<input id="applicationMinScore" type="number" min="0" max="100" value="${Number(filters.minScore || 0)}"></label>
        <label>Canal<select id="applicationChannel"><option value="all">Todos</option><option value="with-url" ${filters.channel === "with-url" ? "selected" : ""}>Com link</option><option value="without-url" ${filters.channel === "without-url" ? "selected" : ""}>Sem link</option></select></label>
        <label>Envio<select id="applicationSent"><option value="all">Todos</option><option value="sent" ${filters.sent === "sent" ? "selected" : ""}>Candidatadas</option><option value="pending" ${filters.sent === "pending" ? "selected" : ""}>Pendentes</option></select></label>
        <button id="clearApplicationFilters">Limpar filtros</button>
      </div>
      ${columnPicker("applications", tableColumns.applications)}
    </div>
    <div id="applicationsTableMount"></div>
  </section>`;

  const mount = document.querySelector("#applicationsTableMount");
  const readFilters = () => ({
    q: document.querySelector("#applicationSearch").value.trim(),
    source: document.querySelector("#applicationSource").value,
    work: document.querySelector("#applicationWork").value,
    status: document.querySelector("#applicationStatus").value,
    minScore: Number(document.querySelector("#applicationMinScore").value || 0),
    channel: document.querySelector("#applicationChannel").value,
    sent: document.querySelector("#applicationSent").value
  });
  const applyFilters = () => {
    const active = readFilters();
    saveFilters("applications", active);
    const visibleRows = rows.filter((row) => {
      if (!includesSearch(row, active.q)) return false;
      if (active.source !== "all" && String(row.source) !== active.source) return false;
      if (active.work !== "all" && String(row.work_model) !== active.work) return false;
      if (active.status !== "all" && String(row.application_status) !== active.status) return false;
      if (Number(row.fit_score || 0) < active.minScore) return false;
      if (active.channel === "with-url" && !row.url) return false;
      if (active.channel === "without-url" && row.url) return false;
      if (active.sent === "sent" && !(Number(row.sent_by_agent) === 1 || row.application_status === "Candidatura enviada")) return false;
      if (active.sent === "pending" && (Number(row.sent_by_agent) === 1 || row.application_status === "Candidatura enviada")) return false;
      return true;
    });
    const empty = `<div class="empty-state"><h3>Nenhuma candidatura exibida</h3><p>Ajuste filtros ou mova vagas da aba Vagas para candidaturas.</p><button data-tab="jobs" class="primary">Ver vagas</button></div>`;
    mount.innerHTML = `<div class="table-meta"><strong>${visibleRows.length}</strong><span>candidatura(s) exibida(s)</span></div>${renderTable("applications", visibleRows, tableColumns.applications, empty)}`;
  };

  const selectedIds = () => [...document.querySelectorAll(".application-check:checked")].map((input) => Number(input.value));
  const postSelection = async (url, successBuilder) => {
    const ids = selectedIds();
    if (!ids.length) return showInlineResult("#applicationActionResult", "Selecione pelo menos uma candidatura.");
    const data = await json(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    const message = successBuilder(data);
    toast("Acao registrada. Veja o retorno na fila.", "info");
    await applications(message);
  };

  document.querySelector("#toggleApplicationFilters").onclick = () => document.querySelector("#applicationFilters").classList.toggle("collapsed");
  document.querySelector("#selectAllApplications").onclick = () => document.querySelectorAll(".application-check").forEach((input) => input.checked = true);
  document.querySelector("#clearApplications").onclick = () => document.querySelectorAll(".application-check").forEach((input) => input.checked = false);
  document.querySelector("#clearApplicationFilters").onclick = () => {
    localStorage.removeItem(filterKey("applications"));
    applications(initialMessage);
  };
  document.querySelectorAll("#applicationFilters input, #applicationFilters select").forEach((element) => element.addEventListener("input", applyFilters));
  document.querySelectorAll('[data-column-scope="applications"]').forEach((element) => element.addEventListener("change", () => {
    saveVisibleColumns("applications", tableColumns.applications);
    applyFilters();
  }));
  document.querySelector("#approveApplications").onclick = () => postSelection("/api/applications/approve", (data) => `<strong>${data.approved} candidatura(s) aprovada(s).</strong> Agora voce pode clicar em Candidatar-se com IA.`);
  document.querySelector("#rejectApplications").onclick = () => postSelection("/api/applications/reject", (data) => `<strong>${data.rejected} candidatura(s) rejeitada(s).</strong>`);
  document.querySelector("#markSentApplications").onclick = () => postSelection("/api/applications/mark-sent", (data) => `<strong>${data.sent} candidatura(s) marcada(s) como enviada(s).</strong>`);
  document.querySelector("#assistedApplyApplications").onclick = () => postSelection("/api/applications/assisted-apply", (data) => {
    const lines = (data.actions || []).map((action) => `<li><strong>#${action.id}</strong> <span class="state-chip ${action.status === "pronta_para_formulario" ? "ready" : action.status === "ja_candidatado" ? "success" : action.status === "bloqueada" ? "warning" : "info"}">${escapeHtml(action.status)}</span>: ${escapeHtml(action.message)}<small>${escapeHtml(action.nextStep || "")}</small>${action.url ? `<a href="${escapeHtml(action.url)}" target="_blank" rel="noreferrer">abrir fonte</a>` : ""}</li>`).join("");
    return `<strong>Resultado da candidatura assistida</strong><ul>${lines}</ul>`;
  });
  applyFilters();
}

async function resumePage() {
  const data = await json("/api/career-profile");
  const profile = data.profile;
  const trackEntries = Object.entries(data.careerTracks || {}).filter(([, active]) => active);
  app.innerHTML = `<div class="command-hero resume-hero">
    <div class="hero-copy">
      <span class="eyebrow">Meu curriculo</span>
      <h2>${escapeHtml(profile.name)}</h2>
      <p>${escapeHtml(data.applicationPositioning.headline)}</p>
    </div>
    <div class="hero-actions">
      <button data-tab="settings" class="primary">Editar perfil</button>
      <button data-tab="applications">Candidaturas</button>
    </div>
  </div>

  <div class="command-grid">
    <section>
      <div class="section-head"><div><span class="eyebrow">Base real</span><h3>Dados principais</h3></div></div>
      <div class="profile-grid">
        <div><span>Local</span><strong>${escapeHtml(profile.city)}/${escapeHtml(profile.state)}</strong></div>
        <div><span>E-mail</span><strong>${escapeHtml(profile.email)}</strong></div>
        <div><span>Telefone</span><strong>${escapeHtml(profile.phone || "Nao informado")}</strong></div>
        <div><span>LinkedIn</span><strong>${escapeHtml(profile.linkedin || "Nao informado")}</strong></div>
      </div>
      <p>${escapeHtml(profile.summary)}</p>
      <h3>Formacao</h3>
      <ul>${(profile.education?.degrees || []).map((degree) => `<li>${escapeHtml(degree)}</li>`).join("")}</ul>
    </section>
    <section>
      <div class="section-head"><div><span class="eyebrow">IA</span><h3>Status e materiais</h3></div><span class="state-chip ${data.ai.openaiConfigured ? "success" : "warning"}">${data.ai.openaiConfigured ? "Ativa" : "Configurar .env"}</span></div>
      <div class="resume-snapshot">
        <div><strong>${data.resumes.length}</strong><span>curriculos base</span></div>
        <div><strong>${data.generatedResumes.length}</strong><span>CVs gerados</span></div>
        <div><strong>${data.generatedCoverLetters.length}</strong><span>cartas geradas</span></div>
      </div>
      <div class="stack-list">${(data.resumes || []).map((file) => `<div class="stack-item"><strong>${escapeHtml(file)}</strong><span class="state-chip success">Detectado</span></div>`).join("") || "<div class=\"empty-mini\">Nenhum curriculo detectado na pasta resumes.</div>"}</div>
      <small>Modelo configurado: ${escapeHtml(data.ai.model)}</small>
    </section>
  </div>

  <div class="three-column">
    <section>
      <div class="section-head"><div><span class="eyebrow">Forcas</span><h3>O que destacar</h3></div></div>
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
  app.innerHTML = `<section class="page-panel">
    <div class="page-title-row"><div><span class="eyebrow">Freelas</span><h2>Taxas, eventos e bicos</h2><p>Avalia valor por hora, risco e clareza da proposta.</p></div></div>
    <table class="data-table"><thead><tr><th>Score</th><th>Tipo</th><th>Contratante</th><th>Local</th><th>Horario</th><th>Taxa</th><th>Hora</th><th>Risco</th><th>Status</th></tr></thead>
      <tbody>${rows.map((row) => `<tr>
        <td>${row.freela_score}</td><td>${escapeHtml(row.title)}</td><td>${escapeHtml(row.contractor_name)}</td><td>${escapeHtml(row.location)}</td>
        <td>${escapeHtml(row.start_time || "-")} - ${escapeHtml(row.end_time || "-")}</td><td>R$ ${row.total_pay || 0}</td><td>R$ ${row.hourly_rate || 0}</td>
        <td class="${riskClass(row.risk_score)}">${row.risk_score}<small>${escapeHtml(row.risk_flags || "")}</small></td><td>${escapeHtml(row.status)}</td>
      </tr>`).join("")}</tbody></table>
  </section>`;
}

async function settings() {
  const [data, resumes, env] = await Promise.all([json("/api/settings"), json("/api/resumes"), json("/api/environment")]);
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
      <button data-jump="perfil">Perfil</button>
      <button data-jump="ia">IA e online</button>
      <button data-jump="busca">Busca</button>
      <button data-jump="local">Local e modelo</button>
      <button data-jump="salario">Salario</button>
      <button data-jump="freelas">Freelas</button>
      <button data-jump="fontes">Fontes</button>
      <button data-jump="seguranca">Seguranca</button>
      <button data-jump="codigo">Codigo</button>
    </aside>

    <section class="settings-panel">
      <div class="settings-head">
        <div><span class="eyebrow">Configuracoes</span><h2>Controle visual do agente</h2><p>Campos, botoes e codigo final sincronizado no arquivo do agente.</p></div>
        <div class="save-box"><button id="saveVisualSettings" class="primary">Salvar configuracoes</button><span id="saveStatus"></span></div>
      </div>

      <div class="config-section" id="perfil">
        <h3>Perfil e curriculos</h3>
        <div class="form-grid">
          ${input("Nome", "profile.name", data.profile.name)}
          ${input("E-mail", "profile.email", data.profile.email)}
          ${input("Telefone", "profile.phone", data.profile.phone)}
          ${input("LinkedIn", "profile.linkedin", data.profile.linkedin)}
          ${input("Cidade", "profile.city", data.profile.city)}
          ${input("Estado", "profile.state", data.profile.state)}
          ${textareaField("Resumo profissional", "profile.summary", data.profile.summary)}
          ${textareaField("Formacoes, uma por linha", "profile.education.degrees", data.profile.education.degrees)}
        </div>
        <div class="resume-list"><strong>Curriculos encontrados:</strong> ${resumes.files.length ? resumes.files.map((file) => `<span>${escapeHtml(file)}</span>`).join("") : "<em>Nenhum curriculo detectado.</em>"}</div>
      </div>

      <div class="config-section" id="ia">
        <h3>IA, Google e sincronizacao online</h3>
        <div class="form-grid">
          <div class="field"><label>Chave OpenAI</label><input id="envOpenaiKey" type="password" placeholder="${env.openaiConfigured ? "Chave configurada. Digite outra para trocar." : "Cole sua OPENAI_API_KEY"}"><small>Nao vai para o GitHub. Fica no .env ou nos segredos do servidor online.</small></div>
          <div class="field"><label>Modelo OpenAI</label><input id="envOpenaiModel" value="${escapeHtml(env.openaiModel || "gpt-4o-mini")}"></div>
          <div class="field"><label>Google Search API Key</label><input id="envGoogleKey" type="password" placeholder="${env.googleSearchConfigured ? "Configurada. Digite outra para trocar." : "Opcional"}"></div>
          <div class="field"><label>Google Search Engine ID</label><input id="envGoogleCx" value=""></div>
          <div class="field"><label>Banco online DATABASE_URL</label><input id="envDatabaseUrl" value="${escapeHtml(env.databaseUrl || "file:./data/jobs.sqlite")}"><small>Para Render/Railway use um caminho persistente, ex: file:/var/data/jobs.sqlite.</small></div>
          <div class="field"><label>Porta do painel</label><input id="envPort" value="${escapeHtml(env.port || "8788")}"></div>
        </div>
        <div class="env-status">
          <span class="state-chip ${env.openaiConfigured ? "success" : "warning"}">OpenAI ${env.openaiConfigured ? "ativa" : "pendente"}</span>
          <span class="state-chip ${env.googleSearchConfigured ? "success" : "info"}">Google Search ${env.googleSearchConfigured ? "ativo" : "opcional"}</span>
          <span class="state-chip ${env.envExists ? "success" : "warning"}">.env ${env.envExists ? "criado" : "nao criado"}</span>
        </div>
        <button id="saveEnvConfig" class="primary">Salvar IA no .env</button><span id="envSaveStatus"></span>
      </div>

      <div class="config-section" id="busca">
        <h3>O que buscar</h3>
        ${textareaField("Cargos e palavras-chave, um por linha", "jobSearchPreferences.targetRoles", getPath(data, "jobSearchPreferences.targetRoles", []))}
        ${checkboxGrid("Trilhas de carreira", "careerTracks", tracks)}
        ${checkboxGrid("Niveis aceitos", "jobSearchPreferences.careerLevels", careerLevels)}
        ${checkboxGrid("Tipos de contrato", "jobSearchPreferences.contractTypes", contracts)}
      </div>

      <div class="config-section" id="local">
        <h3>Local, modelo e rotina</h3>
        <div class="form-grid">
          ${textareaField("Locais preferidos, um por linha", "jobSearchPreferences.locations.preferred", getPath(data, "jobSearchPreferences.locations.preferred", []))}
          ${textareaField("Estados aceitos, um por linha", "jobSearchPreferences.locations.acceptedStates", getPath(data, "jobSearchPreferences.locations.acceptedStates", []))}
        </div>
        ${checkboxGrid("Modelos de trabalho", "jobSearchPreferences.workStyles", workStyles)}
        ${checkboxGrid("Horarios e escalas", "jobSearchPreferences.schedulePreferences", schedules)}
        ${checkboxGrid("Escolaridade aceita", "jobSearchPreferences.educationFilters", education)}
        ${checkboxGrid("CNH e veiculo", "jobSearchPreferences.driverLicenseFilters", license)}
        <div class="form-grid">
          <label class="check-line"><input type="checkbox" data-path="profile.driverLicense.hasLicense" ${data.profile.driverLicense.hasLicense ? "checked" : ""}> Tenho CNH</label>
          <label class="check-line"><input type="checkbox" data-path="profile.driverLicense.hasOwnVehicle" ${data.profile.driverLicense.hasOwnVehicle ? "checked" : ""}> Tenho veiculo proprio</label>
          ${textareaField("Categorias da sua CNH, uma por linha", "profile.driverLicense.categories", data.profile.driverLicense.categories)}
        </div>
      </div>

      <div class="config-section" id="salario">
        <h3>Salario e pretensao</h3>
        <div class="form-grid">
          ${numberInput("CLT minimo mensal", "salaryPreferences.salaryByContractType.clt.minimumMonthly", getPath(data, "salaryPreferences.salaryByContractType.clt.minimumMonthly", 0))}
          ${numberInput("CLT desejado mensal", "salaryPreferences.salaryByContractType.clt.desiredMonthly", getPath(data, "salaryPreferences.salaryByContractType.clt.desiredMonthly", 0))}
          ${numberInput("PJ minimo mensal", "salaryPreferences.salaryByContractType.pj.minimumMonthly", getPath(data, "salaryPreferences.salaryByContractType.pj.minimumMonthly", 0))}
          ${numberInput("PJ desejado mensal", "salaryPreferences.salaryByContractType.pj.desiredMonthly", getPath(data, "salaryPreferences.salaryByContractType.pj.desiredMonthly", 0))}
          ${numberInput("Diaria minima", "salaryPreferences.salaryByContractType.freelancer.minimumDaily", getPath(data, "salaryPreferences.salaryByContractType.freelancer.minimumDaily", 0))}
          ${numberInput("Valor/hora minimo", "salaryPreferences.salaryByContractType.hourly.minimumHourly", getPath(data, "salaryPreferences.salaryByContractType.hourly.minimumHourly", 0))}
        </div>
        <div class="choice-grid">
          <label class="check-pill"><input type="checkbox" data-path="salaryPreferences.rejectWithoutSalary" ${getPath(data, "salaryPreferences.rejectWithoutSalary") ? "checked" : ""}> Rejeitar vaga sem salario</label>
          <label class="check-pill"><input type="checkbox" data-path="salaryPreferences.penalizeWithoutSalary" ${getPath(data, "salaryPreferences.penalizeWithoutSalary") ? "checked" : ""}> Penalizar vaga sem salario</label>
          <label class="check-pill"><input type="checkbox" data-path="salaryPreferences.askSalaryInDraft" ${getPath(data, "salaryPreferences.askSalaryInDraft") ? "checked" : ""}> Perguntar salario no rascunho</label>
        </div>
      </div>

      <div class="config-section" id="freelas">
        <h3>Freelas, bicos, taxas e eventos</h3>
        ${checkboxGrid("Tipos aceitos", "informalWork", Object.fromEntries(Object.entries(informalWork).filter(([, value]) => typeof value === "boolean")))}
        <div class="form-grid">
          ${numberInput("Valor/hora minimo", "informalWork.minimumHourlyRate", informalWork.minimumHourlyRate)}
          ${numberInput("Diaria minima", "informalWork.minimumDailyRate", informalWork.minimumDailyRate)}
          ${numberInput("Diaria desejada", "informalWork.desiredDailyRate", informalWork.desiredDailyRate)}
          ${numberInput("Taxa minima de evento", "informalWork.minimumEventRate", informalWork.minimumEventRate)}
          ${numberInput("Distancia maxima em km", "informalWork.maxDistanceKm", informalWork.maxDistanceKm)}
          ${numberInput("Prazo maximo para pagamento", "informalWork.maximumPaymentDelayDays", informalWork.maximumPaymentDelayDays)}
        </div>
      </div>

      <div class="config-section" id="fontes">
        <h3>Fontes de busca</h3>
        ${checkboxGrid("Fontes ativas", "sources", sources)}
        <div class="note"><strong>WhatsApp:</strong> monitoramento em tempo real exige API oficial ou encaminhamento seguro. O caminho seguro e colar/exportar mensagens em <code>data/whatsapp-vagas.txt</code> e rodar Buscar vagas.</div>
      </div>

      <div class="config-section" id="seguranca">
        <h3>Estrategia e seguranca</h3>
        <div class="form-grid">
          ${numberInput("Maximo de vagas por rodada", "agent.maxJobsPerRun", data.agent.maxJobsPerRun)}
          ${numberInput("Maximo de candidaturas por dia", "strategy.maxApplicationsPerDay", data.strategy.maxApplicationsPerDay)}
          ${numberInput("Preparar so acima da nota", "strategy.onlyPrepareAboveScore", data.strategy.onlyPrepareAboveScore)}
          ${numberInput("Aplicar so acima da nota", "strategy.onlyApplyAboveScore", data.strategy.onlyApplyAboveScore)}
        </div>
        <div class="choice-grid">
          <label class="check-pill"><input type="checkbox" data-path="agent.enabled" ${data.agent.enabled ? "checked" : ""}> Agente ativo</label>
          <label class="check-pill"><input type="checkbox" data-path="agent.paused" ${data.agent.paused ? "checked" : ""}> Pausar agente</label>
          <label class="check-pill"><input type="checkbox" data-path="agent.dryRun" ${data.agent.dryRun ? "checked" : ""}> Modo seguro/dry-run</label>
          <label class="check-pill"><input type="checkbox" data-path="applications.prepareApplications" ${getPath(data, "applications.prepareApplications") ? "checked" : ""}> Preparar candidaturas</label>
          <label class="check-pill"><input type="checkbox" data-path="applications.autoApply" ${getPath(data, "applications.autoApply") ? "checked" : ""}> Auto apply</label>
          <label class="check-pill"><input type="checkbox" data-path="applications.requireApprovalBeforeApply" ${getPath(data, "applications.requireApprovalBeforeApply") ? "checked" : ""}> Exigir aprovacao antes de aplicar</label>
          <label class="check-pill"><input type="checkbox" data-path="applications.requireApprovalBeforeSendingEmail" ${getPath(data, "applications.requireApprovalBeforeSendingEmail") ? "checked" : ""}> Exigir aprovacao para e-mail</label>
        </div>
      </div>

      <div class="config-section" id="codigo">
        <h3>Codigo gerado pelas suas escolhas</h3>
        <p>Este e o arquivo <code>agent-settings.json</code> usado pelo agente.</p>
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
      document.querySelector("#saveStatus").textContent = "Codigo valido.";
    } catch {
      document.querySelector("#saveStatus").textContent = "Codigo ainda nao e JSON valido.";
    }
  });
  document.querySelector("#saveVisualSettings").onclick = async () => {
    syncCode();
    await json("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: code.value });
    document.querySelector("#saveStatus").textContent = "Configuracoes salvas.";
    toast("Configuracoes do agente salvas.", "success");
  };
  document.querySelector("#saveEnvConfig").onclick = async () => {
    const payload = {
      openaiApiKey: document.querySelector("#envOpenaiKey").value,
      openaiModel: document.querySelector("#envOpenaiModel").value,
      googleSearchApiKey: document.querySelector("#envGoogleKey").value,
      googleSearchEngineId: document.querySelector("#envGoogleCx").value,
      databaseUrl: document.querySelector("#envDatabaseUrl").value,
      port: document.querySelector("#envPort").value
    };
    const result = await json("/api/environment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    document.querySelector("#envSaveStatus").textContent = result.environment.openaiConfigured ? "IA salva e ativa nesta sessao." : "Arquivo .env salvo. Falta preencher OPENAI_API_KEY.";
    toast("Configuracao de IA/ambiente salva no .env.", "success");
  };
  syncCode();
}

async function logs() {
  const health = await json("/api/health");
  app.innerHTML = `<section class="notice-panel">
    <div class="section-head"><div><span class="eyebrow">Logs</span><h2>Auditoria e saude do agente</h2></div><span class="state-chip success">${escapeHtml(health.status)}</span></div>
    <p>Auditoria local: <code>logs/audit.jsonl</code> e <code>logs/errors.jsonl</code>. Dados sensiveis sao mascarados.</p>
    <div class="kpi-grid compact">
      ${metricCard("Servidor", "online", formatDate(health.time), "success")}
      ${metricCard("Banco", health.environment.databaseUrl, "DATABASE_URL", "blue")}
      ${metricCard("OpenAI", health.environment.openaiConfigured ? "ativa" : "pendente", health.environment.openaiModel, health.environment.openaiConfigured ? "success" : "warning")}
    </div>
  </section>`;
}

async function load(tab) {
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  try {
    if (tab === "jobs") return jobs();
    if (tab === "informal") return informal();
    if (tab === "applications") return applications();
    if (tab === "resume") return resumePage();
    if (tab === "settings") return settings();
    if (tab === "logs") return logs();
    return dashboard();
  } catch (error) {
    app.innerHTML = `<section class="notice-panel"><h2>Algo nao carregou</h2><p>${escapeHtml(error.message)}</p><button data-tab="dashboard">Voltar ao painel</button></section>`;
    toast(escapeHtml(error.message), "error");
  }
}

header.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (button) load(button.dataset.tab);
});

document.querySelector("#themeToggle").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("careerHunterTheme", next);
  document.querySelector("#themeToggle").textContent = next === "dark" ? "Modo claro" : "Modo escuro";
});

app.addEventListener("click", (event) => {
  const detail = event.target.closest("[data-detail]");
  const tab = event.target.closest("[data-tab]");
  if (detail) jobDetail(detail.dataset.detail);
  if (tab) load(tab.dataset.tab);
});

load("dashboard");
