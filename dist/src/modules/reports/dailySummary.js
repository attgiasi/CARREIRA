import fs from "node:fs";
import path from "node:path";
import { collectMetrics } from "./metrics.js";
export async function generateDailySummary() {
    const metrics = await collectMetrics();
    const content = `# Resumo diário

- Vagas encontradas: ${metrics.jobs}
- Vagas ouro: ${metrics.gold}
- Candidaturas preparadas: ${metrics.prepared}
- Freelas encontrados: ${metrics.informal}
- Ação recomendada: revisar fila de aprovação e priorizar vagas com alta nota e baixo risco.
`;
    const file = path.resolve(process.cwd(), "generated/reports", `daily-${new Date().toISOString().slice(0, 10)}.md`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf8");
    return file;
}
