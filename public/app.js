const app = document.querySelector("#app");
const tabs = [
  ["dashboard", "Dashboard"],
  ["jobs", "Vagas"],
  ["informal", "Freelas e Bicos"],
  ["applications", "Candidaturas"],
  ["settings", "Configurações"],
  ["logs", "Logs"]
];

document.querySelector("nav").innerHTML = tabs.map(([id, label]) => `<button data-tab="${id}">${label}</button>`).join("");

async function json(url) {
  const response = await fetch(url);
  return response.json();
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

function checkboxGrid(title, group, values) {
  return `<div class="field-block"><label>${title}</label><div class="choice-grid">${Object.entries(values || {}).map(([key, value]) => `
    <label class="check-pill"><input type="checkbox" data-path="${group}.${key}" ${value ? "checked" : ""}> <span>${labelize(key)}</span></label>
  `).join("")}</div></div>`;
}

function labelize(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace("Cnh", "CNH")
    .replace("Pj", "PJ")
    .replace("Clt", "CLT")
    .replace("Sac", "SAC");
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

function shortDescription(value, max = 170) {
  const clean = String(value || "Sem descrição informada.").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function scoreBadge(row) {
  return `<div class="score-stack">
    <strong>${row.fit_score ?? "-"}</strong>
    <span>${escapeHtml(row.status || row.job_status || "Sem classificação")}</span>
    <small>Risco ${row.risk_score ?? "-"}</small>
  </div>`;
}

function applicationState(row) {
  if (Number(row.sent_by_agent) === 1 || row.application_status === "Candidatura enviada") {
    return { label: "Candidatado", tone: "success", detail: row.applied_at ? `Enviado em ${row.applied_at}` : "Envio registrado" };
  }
  if (row.application_status === "Pronta para envio assistido") {
    return { label: "Pronta", tone: "ready", detail: "Abrir fonte oficial" };
  }
  if (row.application_status === "Aguardando vaga real da fonte") {
    return { label: "Precisa vaga real", tone: "warning", detail: "Busca assistida" };
  }
  if (row.application_status === "Aguardando canal de candidatura") {
    return { label: "Sem canal", tone: "warning", detail: "Confirmar link/e-mail" };
  }
  if (row.approval_status === "aprovado_pelo_usuario") {
    return { label: "Aprovada", tone: "ready", detail: "Pode iniciar candidatura" };
  }
  if (row.application_id || row.id) {
    return { label: "Preparada", tone: "info", detail: "Aguardando aprovação" };
  }
  return { label: "Não preparada", tone: "muted", detail: "Selecione para preparar" };
}

function stateChip(row) {
  const state = applicationState(row);
  return `<span class="state-chip ${state.tone}">${state.label}</span><small>${escapeHtml(state.detail)}</small>`;
}

function sourceBadge(source) {
  return `<span class="source-badge">${escapeHtml(source || "Fonte")}</span>`;
}

async function dashboard() {
  const summary = await json("/api/summary");
  app.innerHTML = `<div class="hero-panel">
    <div>
      <span class="eyebrow">Radar de carreira</span>
      <h2>Pipeline de oportunidades do Giasi</h2>
      <p>Busca ativa, triagem por risco, materiais personalizados e candidatura assistida com controle de aprovação.</p>
    </div>
    <div class="hero-actions">
      <button data-tab="jobs" class="primary">Ver vagas</button>
      <button data-tab="applications">Ver candidaturas</button>
    </div>
  </div>

  <div class="grid executive-grid">
    <div class="metric premium"><strong>${summary.jobs}</strong><span>vagas no radar</span></div>
    <div class="metric premium"><strong>${summary.gold}</strong><span>vagas ouro</span></div>
    <div class="metric premium"><strong>${summary.applications}</strong><span>candidaturas preparadas</span></div>
    <div class="metric premium"><strong>${summary.approved}</strong><span>aprovadas por você</span></div>
    <div class="metric premium"><strong>${summary.ready}</strong><span>prontas para assistência</span></div>
    <div class="metric premium"><strong>${summary.waitingRealJob}</strong><span>precisam vaga real</span></div>
    <div class="metric premium"><strong>${summary.sent}</strong><span>candidatadas</span></div>
    <div class="metric premium"><strong>${summary.informal}</strong><span>freelas encontrados</span></div>
  </div>

  <div class="two-column">
    <section>
      <h2>Melhores oportunidades agora</h2>
      <div class="stack-list">${(summary.topJobs || []).map((row) => `<div class="stack-item">
        <div><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.company || "Empresa a confirmar")} · ${escapeHtml(row.source)}</small></div>
        <div>${scoreBadge(row)}</div>
      </div>`).join("") || "<p>Nenhuma vaga ranqueada ainda.</p>"}</div>
    </section>
    <section>
      <h2>Fontes mais ativas</h2>
      <div class="stack-list">${(summary.bySource || []).map((row) => `<div class="stack-item">
        <div>${sourceBadge(row.source)}</div>
        <strong>${row.total}</strong>
      </div>`).join("") || "<p>Nenhuma fonte registrada.</p>"}</div>
    </section>
  </div>

  <section class="notice-panel">
    <h2>Status do processo</h2>
    <p>Se uma candidatura não virar “Candidatado”, o painel agora mostra o motivo: precisa aprovação, precisa vaga real, falta canal oficial ou está pronta para formulário assistido.</p>
  </section>`;
}

async function jobs() {
  const rows = await json("/api/jobs");
  app.innerHTML = `<section>
    <div class="toolbar">
      <div>
        <h2>Vagas encontradas</h2>
        <p>Selecione vagas reais ou promissoras para preparar currículo, carta e candidatura.</p>
      </div>
      <div class="toolbar-actions">
        <button id="selectAllJobs">Selecionar todas</button>
        <button id="clearJobs">Limpar seleção</button>
        <button id="prepareSelectedJobs" class="primary">Preparar candidatura</button>
      </div>
    </div>
    <div id="jobActionResult" class="note hidden"></div>
    <table class="data-table"><thead><tr>
      <th></th>
      <th>Nome da vaga</th>
      <th>Salário</th>
      <th>Local</th>
      <th>Tipo de trabalho</th>
      <th>Descrição resumida</th>
      <th>Fonte</th>
      <th>Nota</th>
      <th>Status candidatura</th>
      <th>Ação</th>
    </tr></thead>
    <tbody>${rows.map((row) => `<tr>
      <td><input class="job-check" type="checkbox" value="${row.id}"></td>
      <td><strong>${escapeHtml(row.title)}</strong><br><small>${escapeHtml(row.company || "Empresa a confirmar")}</small></td>
      <td>${escapeHtml(row.salary || "Não informado")}</td>
      <td>${escapeHtml(row.location || "A confirmar")}</td>
      <td>${escapeHtml(row.work_model || "A confirmar")}</td>
      <td>${escapeHtml(shortDescription(row.description))}</td>
      <td>${sourceBadge(row.source)}</td>
      <td>${scoreBadge(row)}</td>
      <td>${stateChip(row)}</td>
      <td><button data-detail="${row.id}">Detalhes</button>${row.url ? `<a class="action" href="${row.url}" target="_blank" rel="noreferrer">Abrir fonte</a>` : ""}</td>
    </tr>`).join("")}</tbody></table>
  </section>`;

  const selectedJobIds = () => [...document.querySelectorAll(".job-check:checked")].map((input) => Number(input.value));
  const resultBox = document.querySelector("#jobActionResult");
  const showResult = (message) => {
    resultBox.classList.remove("hidden");
    resultBox.innerHTML = message;
  };
  document.querySelector("#selectAllJobs").onclick = () => document.querySelectorAll(".job-check").forEach((input) => input.checked = true);
  document.querySelector("#clearJobs").onclick = () => document.querySelectorAll(".job-check").forEach((input) => input.checked = false);
  document.querySelector("#prepareSelectedJobs").onclick = async () => {
    const ids = selectedJobIds();
    if (!ids.length) return showResult("Selecione pelo menos uma vaga.");
    const response = await fetch("/api/jobs/prepare-selected", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    const data = await response.json();
    const skipped = (data.skipped || []).map((item) => `<li>#${item.id}: ${escapeHtml(item.reason)}</li>`).join("");
    const message = response.ok ? `<strong>${data.prepared} candidatura(s) preparada(s).</strong> ${skipped ? `<ul>${skipped}</ul>` : ""}<p>Agora vá para a aba <strong>Candidaturas</strong>, aprove e clique em <strong>Candidatar-se com IA</strong>.</p>` : escapeHtml(data.error || "Erro ao preparar.");
    showResult(message);
    toast(message, response.ok ? "success" : "error");
    await jobs();
  };
}

function applicationGuidance(row) {
  if (row.source === "google-assisted-search") return "Abra a busca do Google, escolha a vaga real na página de resultados e importe o link específico em data/manual-urls.txt para o agente analisar em detalhe.";
  if (["sine", "infojobs", "jobs99", "rh-agencies-curitiba"].includes(row.source)) return "Esta é uma busca assistida em fonte de vagas. Abra o link, escolha uma vaga real, confirme empresa/salário/local e importe o link específico se quiser gerar candidatura personalizada.";
  if (row.url) return `Abra o link oficial da fonte (${row.source}) e revise os dados antes de se candidatar. O agente pode preparar currículo/carta, mas o envio depende de aprovação.`;
  if (row.source === "companyHunter") return "Sem link porque é uma prospecção ativa. O próximo passo é pesquisar contatos da empresa-alvo, página Trabalhe Conosco ou e-mail de RH/comercial.";
  if (String(row.source).includes("whatsapp")) return "Sem link no WhatsApp. Peça detalhes por mensagem: empresa, local, horário, remuneração, função, contato responsável e forma oficial de candidatura.";
  return "Sem link encontrado. Confirme a fonte original, procure a empresa pelo nome e evite enviar dados pessoais antes de validar a oportunidade.";
}

async function jobDetail(id) {
  const row = await json(`/api/jobs/${id}`);
  app.innerHTML = `<section>
    <p><button data-tab="jobs">Voltar</button></p>
    <h2>${row.title}</h2>
    <p><strong>Empresa:</strong> ${row.company || "A confirmar"}</p>
    <p><strong>Fonte:</strong> ${row.source || "A confirmar"} ${row.url ? `| <a href="${row.url}" target="_blank" rel="noreferrer">abrir link</a>` : "| sem link"}</p>
    <p><strong>Local/modelo:</strong> ${row.location || "A confirmar"} | ${row.work_model || "A confirmar"}</p>
    <p><strong>Salário:</strong> ${row.salary || "Não informado"}</p>
    <p><strong>Nível:</strong> ${row.seniority_level || "A confirmar"} | <strong>Escolaridade:</strong> ${row.education_required || "Não informada"}</p>
    <p><strong>CNH:</strong> ${row.driver_license_required ? `exige ${row.driver_license_categories || ""}` : "não detectado"} | <strong>Veículo próprio:</strong> ${row.own_vehicle_required ? "sim" : "não detectado"}</p>
    <div class="grid">
      <div class="metric"><strong>${row.fit_score}</strong><span>Fit Score</span></div>
      <div class="metric"><strong>${row.hire_chance_score}</strong><span>Hire Chance</span></div>
      <div class="metric"><strong>${row.job_quality_score}</strong><span>Qualidade</span></div>
      <div class="metric"><strong>${row.risk_score}</strong><span>Risco</span></div>
    </div>
    <h3>Por que apareceu</h3>
    <p>${row.fit_reason || "Sem justificativa registrada."}</p>
    <h3>Chance de contratação</h3>
    <p>${row.hire_chance_reason || "A confirmar após leitura completa da vaga."}</p>
    <h3>Riscos</h3>
    <p class="${riskClass(row.risk_score)}">${row.risk_flags || "Nenhum risco crítico detectado."}</p>
    <h3>Como se candidatar ou saber mais</h3>
    <p>${applicationGuidance(row)}</p>
    <h3>Descrição</h3>
    <pre>${row.description || "Sem descrição."}</pre>
  </section>`;
}

async function informal() {
  const rows = await json("/api/informal");
  app.innerHTML = `<section>
    <div class="toolbar">
      <div>
        <h2>Freelas e bicos</h2>
        <p>Eventos, taxas e oportunidades informais com cálculo de valor/hora e risco.</p>
      </div>
    </div>
    <table class="data-table"><thead><tr><th>Score</th><th>Tipo</th><th>Contratante</th><th>Local</th><th>Horário</th><th>Taxa</th><th>Hora</th><th>Risco</th><th>Status</th></tr></thead>
  <tbody>${rows.map((row) => `<tr>
    <td>${row.freela_score}</td><td>${row.title}</td><td>${row.contractor_name}</td><td>${row.location}</td>
    <td>${row.start_time || "-"} - ${row.end_time || "-"}</td><td>R$ ${row.total_pay || 0}</td><td>R$ ${row.hourly_rate || 0}</td>
    <td class="${riskClass(row.risk_score)}">${row.risk_score}<br><small>${row.risk_flags || ""}</small></td><td>${row.status}</td>
  </tr>`).join("")}</tbody></table>
  </section>`;
}

async function applications(initialMessage = "") {
  const rows = await json("/api/applications");
  app.innerHTML = `<section>
    <div class="toolbar">
      <div>
        <h2>Candidaturas</h2>
        <p>Selecione as candidaturas que você quer aprovar. O agente só avança com as aprovadas.</p>
      </div>
      <div class="toolbar-actions">
        <button id="selectAllApplications">Selecionar todas</button>
        <button id="clearApplications">Limpar seleção</button>
        <button id="approveApplications" class="primary">Aprovar selecionadas</button>
        <button id="assistedApplyApplications">Candidatar-se com IA</button>
        <button id="rejectApplications">Rejeitar</button>
      </div>
    </div>
    <div id="applicationActionResult" class="note ${initialMessage ? "" : "hidden"}">${initialMessage}</div>
    <table class="data-table"><thead><tr>
      <th></th>
      <th>Nome da vaga</th>
      <th>Salário</th>
      <th>Local</th>
      <th>Tipo de trabalho</th>
      <th>Descrição resumida</th>
      <th>Fonte</th>
      <th>Nota</th>
      <th>Status</th>
      <th>Currículo/Carta</th>
      <th>Ação</th>
    </tr></thead>
    <tbody>${rows.map((row) => `<tr>
      <td><input class="application-check" type="checkbox" value="${row.id}"></td>
      <td><strong>${escapeHtml(row.title || `Vaga ${row.job_id || ""}`)}</strong><br><small>${escapeHtml(row.company || "Empresa a confirmar")}</small></td>
      <td>${escapeHtml(row.salary || "Não informado")}</td>
      <td>${escapeHtml(row.location || "A confirmar")}</td>
      <td>${escapeHtml(row.work_model || "A confirmar")}</td>
      <td>${escapeHtml(shortDescription(row.description))}</td>
      <td>${sourceBadge(row.source)}<br><small>${row.url ? "tem link" : "sem link"}</small></td>
      <td>${scoreBadge(row)}</td>
      <td>${stateChip(row)}<br><small>${escapeHtml(row.application_status || "-")}</small></td>
      <td><small>CV: ${escapeHtml(row.generated_resume_path || "")}</small><br><small>Carta: ${escapeHtml(row.cover_letter_path || "")}</small></td>
      <td>${row.url ? `<a class="action" href="${row.url}" target="_blank" rel="noreferrer">Abrir fonte</a>` : ""}${row.job_id ? `<button data-detail="${row.job_id}">Detalhes</button>` : ""}</td>
    </tr>`).join("")}</tbody></table>
  </section>`;

  const selectedIds = () => [...document.querySelectorAll(".application-check:checked")].map((input) => Number(input.value));
  const resultBox = document.querySelector("#applicationActionResult");
  const showResult = (message) => {
    resultBox.classList.remove("hidden");
    resultBox.innerHTML = message;
  };
  document.querySelector("#selectAllApplications").onclick = () => document.querySelectorAll(".application-check").forEach((input) => input.checked = true);
  document.querySelector("#clearApplications").onclick = () => document.querySelectorAll(".application-check").forEach((input) => input.checked = false);
  document.querySelector("#approveApplications").onclick = async () => {
    const ids = selectedIds();
    if (!ids.length) return showResult("Selecione pelo menos uma candidatura.");
    const response = await fetch("/api/applications/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    const data = await response.json();
    const message = response.ok ? `<strong>${data.approved} candidatura(s) aprovada(s).</strong> Agora clique em <strong>Candidatar-se com IA</strong>.` : escapeHtml(data.error || "Erro ao aprovar.");
    toast(message, response.ok ? "success" : "error");
    await applications(message);
  };
  document.querySelector("#rejectApplications").onclick = async () => {
    const ids = selectedIds();
    if (!ids.length) return showResult("Selecione pelo menos uma candidatura.");
    const response = await fetch("/api/applications/reject", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    const data = await response.json();
    const message = response.ok ? `<strong>${data.rejected} candidatura(s) rejeitada(s).</strong>` : escapeHtml(data.error || "Erro ao rejeitar.");
    toast(message, response.ok ? "success" : "error");
    await applications(message);
  };
  document.querySelector("#assistedApplyApplications").onclick = async () => {
    const ids = selectedIds();
    if (!ids.length) return showResult("Selecione pelo menos uma candidatura aprovada.");
    const response = await fetch("/api/applications/assisted-apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    const data = await response.json();
    const lines = (data.actions || []).map((action) => `<li><strong>#${action.id}</strong> <span class="state-chip ${action.status === "pronta_para_formulario" ? "ready" : action.status === "bloqueada" ? "warning" : "info"}">${escapeHtml(action.status)}</span>: ${escapeHtml(action.message)}<br><small>${escapeHtml(action.nextStep || "")}</small> ${action.url ? `<a href="${action.url}" target="_blank" rel="noreferrer">abrir fonte</a>` : ""}</li>`).join("");
    const message = response.ok ? `<strong>Resultado da candidatura assistida</strong><ul>${lines}</ul>` : escapeHtml(data.error || "Erro na candidatura assistida.");
    toast(response.ok ? "Candidatura assistida processada. Veja os detalhes no painel." : message, response.ok ? "info" : "error");
    await applications(message);
  };
}

async function settings() {
  const data = await json("/api/settings");
  const resumes = await json("/api/resumes");
  const careerLevels = getPath(data, "jobSearchPreferences.careerLevels", {});
  const workStyles = getPath(data, "jobSearchPreferences.workStyles", {});
  const schedules = getPath(data, "jobSearchPreferences.schedulePreferences", {});
  const contracts = getPath(data, "jobSearchPreferences.contractTypes", {});
  const education = getPath(data, "jobSearchPreferences.educationFilters", {});
  const license = getPath(data, "jobSearchPreferences.driverLicenseFilters", {});
  const sources = getPath(data, "sources", {});
  const tracks = getPath(data, "careerTracks", {});
  const informal = getPath(data, "informalWork", {});

  app.innerHTML = `<div class="settings-shell">
    <aside class="settings-nav">
      <button data-jump="perfil">Perfil</button>
      <button data-jump="busca">Busca</button>
      <button data-jump="local">Local e Modelo</button>
      <button data-jump="salario">Salário</button>
      <button data-jump="freelas">Freelas</button>
      <button data-jump="fontes">Fontes</button>
      <button data-jump="seguranca">Segurança</button>
      <button data-jump="codigo">Código</button>
    </aside>

    <section class="settings-panel">
      <div class="settings-head">
        <div>
          <h2>Configuração do agente</h2>
          <p>Preencha como um formulário. No final, o código JSON é atualizado automaticamente com suas escolhas.</p>
        </div>
        <div class="save-box">
          <button id="saveVisualSettings" class="primary">Salvar configurações</button>
          <span id="saveStatus"></span>
        </div>
      </div>

      <div class="config-section" id="perfil">
        <h3>Perfil e currículos</h3>
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

      <div class="config-section" id="busca">
        <h3>O que buscar</h3>
        ${textareaField("Cargos e palavras-chave, um por linha", "jobSearchPreferences.targetRoles", getPath(data, "jobSearchPreferences.targetRoles", []), "Inclua cargos formais e termos de vagas informais.")}
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
        ${checkboxGrid("Tipos aceitos", "informalWork", Object.fromEntries(Object.entries(informal).filter(([, value]) => typeof value === "boolean")))}
        <div class="form-grid">
          ${numberInput("Valor/hora mínimo", "informalWork.minimumHourlyRate", informal.minimumHourlyRate)}
          ${numberInput("Diária mínima", "informalWork.minimumDailyRate", informal.minimumDailyRate)}
          ${numberInput("Diária desejada", "informalWork.desiredDailyRate", informal.desiredDailyRate)}
          ${numberInput("Taxa mínima de evento", "informalWork.minimumEventRate", informal.minimumEventRate)}
          ${numberInput("Distância máxima em km", "informalWork.maxDistanceKm", informal.maxDistanceKm)}
          ${numberInput("Prazo máximo para pagamento", "informalWork.maximumPaymentDelayDays", informal.maximumPaymentDelayDays)}
        </div>
      </div>

      <div class="config-section" id="fontes">
        <h3>Fontes de busca</h3>
        ${checkboxGrid("Fontes ativas", "sources", sources)}
        <div class="note"><strong>WhatsApp:</strong> cole mensagens em <code>data/whatsapp-vagas.txt</code> e rode o scan. Monitoramento em tempo real exige integração oficial/API ou encaminhamento das mensagens; automação de WhatsApp Web não é recomendada.</div>
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
          <label class="check-pill"><input type="checkbox" data-path="agent.enabled" ${data.agent.enabled ? "checked" : ""}> Agente ativo</label>
          <label class="check-pill"><input type="checkbox" data-path="agent.paused" ${data.agent.paused ? "checked" : ""}> Pausar agente</label>
          <label class="check-pill"><input type="checkbox" data-path="agent.dryRun" ${data.agent.dryRun ? "checked" : ""}> Modo seguro/dry-run</label>
          <label class="check-pill"><input type="checkbox" data-path="applications.prepareApplications" ${getPath(data, "applications.prepareApplications") ? "checked" : ""}> Preparar candidaturas</label>
          <label class="check-pill"><input type="checkbox" data-path="applications.autoApply" ${getPath(data, "applications.autoApply") ? "checked" : ""}> Auto apply</label>
          <label class="check-pill"><input type="checkbox" data-path="applications.requireApprovalBeforeApply" ${getPath(data, "applications.requireApprovalBeforeApply") ? "checked" : ""}> Exigir aprovação antes de aplicar</label>
          <label class="check-pill"><input type="checkbox" data-path="applications.requireApprovalBeforeSendingEmail" ${getPath(data, "applications.requireApprovalBeforeSendingEmail") ? "checked" : ""}> Exigir aprovação para e-mail</label>
        </div>
      </div>

      <div class="config-section" id="codigo">
        <h3>Código gerado pelas suas escolhas</h3>
        <p>Este é o arquivo <code>agent-settings.json</code> que o agente usa por trás do painel.</p>
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
      document.querySelector("#saveStatus").textContent = "Código ainda não é JSON válido.";
    }
  });
  document.querySelector("#saveVisualSettings").onclick = async () => {
    syncCode();
    const response = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: code.value });
    document.querySelector("#saveStatus").textContent = response.ok ? "Configurações salvas." : "Não foi possível salvar.";
  };
  syncCode();
}

async function logs() {
  app.innerHTML = `<section class="notice-panel">
    <h2>Logs e auditoria</h2>
    <p>Veja os arquivos locais <code>logs/audit.jsonl</code> e <code>logs/errors.jsonl</code>. Tokens e dados pessoais são mascarados.</p>
    <div class="grid">
      <div class="metric premium"><strong>JSONL</strong><span>auditoria de ações</span></div>
      <div class="metric premium"><strong>Seguro</strong><span>PII mascarada</span></div>
      <div class="metric premium"><strong>Local</strong><span>dados no seu computador</span></div>
    </div>
  </section>`;
}

async function load(tab) {
  document.querySelectorAll("nav button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  if (tab === "jobs") return jobs();
  if (tab === "informal") return informal();
  if (tab === "applications") return applications();
  if (tab === "settings") return settings();
  if (tab === "logs") return logs();
  return dashboard();
}

document.querySelector("nav").addEventListener("click", (event) => {
  if (event.target.matches("button")) load(event.target.dataset.tab);
});
app.addEventListener("click", (event) => {
  if (event.target.matches("[data-detail]")) jobDetail(event.target.dataset.detail);
  if (event.target.matches("[data-tab]")) load(event.target.dataset.tab);
});
load("dashboard");
