export function dashboardHtml(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Career Hunter Agent</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header>
    <h1>Career Hunter Agent</h1>
    <nav>
      <button data-tab="dashboard">Dashboard</button>
      <button data-tab="jobs">Vagas</button>
      <button data-tab="informal">Freelas e Bicos</button>
      <button data-tab="applications">Candidaturas</button>
      <button data-tab="settings">Configurações</button>
      <button data-tab="logs">Logs</button>
    </nav>
  </header>
  <main id="app"></main>
  <script src="/app.js"></script>
</body>
</html>`;
}
