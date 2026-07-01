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

function riskClass(value) {
  if (Number(value) >= 60) return "risk-high";
  if (Number(value) >= 35) return "risk-mid";
  return "";
}

async function dashboard() {
  const summary = await json("/api/summary");
  app.innerHTML = `<div class="grid">
    <div class="metric"><strong>${summary.jobs}</strong><span>vagas encontradas</span></div>
    <div class="metric"><strong>${summary.gold}</strong><span>vagas ouro</span></div>
    <div class="metric"><strong>${summary.applications}</strong><span>candidaturas preparadas</span></div>
    <div class="metric"><strong>${summary.informal}</strong><span>freelas encontrados</span></div>
  </div>
  <section><h2>Alertas importantes</h2><p>Dry-run e aprovação obrigatória ficam ligados por padrão. O agente prepara candidaturas, mas não envia sem autorização.</p></section>`;
}

async function jobs() {
  const rows = await json("/api/jobs");
  app.innerHTML = `<table><thead><tr><th>Nota</th><th>Vaga</th><th>Empresa</th><th>Local</th><th>Modelo</th><th>Escolaridade</th><th>Salário</th><th>Risco</th><th>Ação</th></tr></thead>
  <tbody>${rows.map((row) => `<tr>
    <td>${row.fit_score}</td><td>${row.title}<br><small>${row.status}</small></td><td>${row.company}</td><td>${row.location}</td>
    <td>${row.work_model}</td><td>${row.education_required}</td><td>${row.salary}</td>
    <td class="${riskClass(row.risk_score)}">${row.risk_score}<br><small>${row.risk_flags || ""}</small></td>
    <td>${row.url ? `<a class="action" href="${row.url}" target="_blank" rel="noreferrer">Abrir</a>` : "Sem link"}</td>
  </tr>`).join("")}</tbody></table>`;
}

async function informal() {
  const rows = await json("/api/informal");
  app.innerHTML = `<table><thead><tr><th>Score</th><th>Tipo</th><th>Contratante</th><th>Local</th><th>Horário</th><th>Taxa</th><th>Hora</th><th>Risco</th><th>Status</th></tr></thead>
  <tbody>${rows.map((row) => `<tr>
    <td>${row.freela_score}</td><td>${row.title}</td><td>${row.contractor_name}</td><td>${row.location}</td>
    <td>${row.start_time || "-"} - ${row.end_time || "-"}</td><td>R$ ${row.total_pay || 0}</td><td>R$ ${row.hourly_rate || 0}</td>
    <td class="${riskClass(row.risk_score)}">${row.risk_score}<br><small>${row.risk_flags || ""}</small></td><td>${row.status}</td>
  </tr>`).join("")}</tbody></table>`;
}

async function applications() {
  const rows = await json("/api/applications");
  app.innerHTML = `<table><thead><tr><th>ID</th><th>Vaga</th><th>Status</th><th>Aprovação</th><th>CV</th><th>Carta</th></tr></thead>
  <tbody>${rows.map((row) => `<tr><td>${row.id}</td><td>${row.job_id || "-"}</td><td>${row.application_status}</td><td>${row.approval_status}</td><td>${row.generated_resume_path || ""}</td><td>${row.cover_letter_path || ""}</td></tr>`).join("")}</tbody></table>`;
}

async function settings() {
  const data = await json("/api/settings");
  app.innerHTML = `<section><h2>Configurações</h2><textarea id="settings">${JSON.stringify(data, null, 2)}</textarea><p><button id="save">Salvar</button></p></section>`;
  document.querySelector("#save").onclick = async () => {
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: document.querySelector("#settings").value });
    alert("Configurações salvas.");
  };
}

async function logs() {
  app.innerHTML = `<section><h2>Logs</h2><p>Veja os arquivos locais <code>logs/audit.jsonl</code> e <code>logs/errors.jsonl</code>. Tokens e dados pessoais são mascarados.</p></section>`;
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
load("dashboard");
