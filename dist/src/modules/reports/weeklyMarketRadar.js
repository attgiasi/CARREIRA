import fs from "node:fs";
import path from "node:path";
import { CareerDatabase } from "../../database/db.js";
export async function generateWeeklyMarketRadar() {
    const db = await CareerDatabase.open();
    const top = db.query("SELECT career_track, COUNT(*) as total FROM jobs GROUP BY career_track ORDER BY total DESC");
    const content = `# Radar semanal

## Trilhas mais encontradas
${top.map((row) => `- ${row.career_track}: ${row.total}`).join("\n") || "- Ainda não há dados suficientes."}

## Recomendações
- Reforçar currículos por trilha.
- Revisar lacunas frequentes em vagas boas.
- Evitar oportunidades com risco alto, taxa de cadastro ou remuneração confusa.
`;
    const file = path.resolve(process.cwd(), "generated/reports", `weekly-${new Date().toISOString().slice(0, 10)}.md`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf8");
    return file;
}
