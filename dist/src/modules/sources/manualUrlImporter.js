import fs from "node:fs";
import path from "node:path";
export function importManualUrls() {
    const file = path.resolve(process.cwd(), "data/manual-urls.txt");
    if (!fs.existsSync(file))
        return [];
    return fs.readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => Boolean(line) && !line.startsWith("#"))
        .map((url, index) => ({
        externalId: `manual-${index}-${url}`,
        title: "Vaga importada manualmente",
        company: "Empresa a confirmar",
        location: "A confirmar",
        source: "manual",
        url,
        description: `Link importado manualmente para análise: ${url}`,
        raw: { url }
    }));
}
