import fs from "node:fs";
import path from "node:path";
import { RawJob } from "../../types.js";

export function importManualUrls(): RawJob[] {
  const file = path.resolve(process.cwd(), "data/manual-urls.txt");
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => Boolean(line) && !line.startsWith("#"))
    .flatMap((url) => {
      try {
        const host = new URL(url).hostname.replace(/^www\./, "");
        return [{
          externalId: `manual-${url}`,
          title: `Vaga real importada: ${host}`,
          company: "Empresa a confirmar",
          location: "A confirmar",
          source: "manual",
          url,
          description: `Link importado manualmente para análise: ${url}`,
          raw: { url }
        }];
      } catch {
        return [];
      }
    });
}
