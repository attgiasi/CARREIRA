import fs from "node:fs";
import path from "node:path";
import { maskObject } from "./piiMasker.js";
export function audit(module, action, result, riskLevel = "baixo", metadata = {}) {
    fs.mkdirSync(path.resolve(process.cwd(), "logs"), { recursive: true });
    const entry = {
        timestamp: new Date().toISOString(),
        module,
        action,
        result,
        riskLevel,
        metadata: maskObject(metadata)
    };
    fs.appendFileSync(path.resolve(process.cwd(), "logs/audit.jsonl"), `${JSON.stringify(entry)}\n`, "utf8");
}
export function logError(module, error, metadata = {}) {
    fs.mkdirSync(path.resolve(process.cwd(), "logs"), { recursive: true });
    const entry = {
        timestamp: new Date().toISOString(),
        module,
        error: error instanceof Error ? error.message : String(error),
        metadata: maskObject(metadata)
    };
    fs.appendFileSync(path.resolve(process.cwd(), "logs/errors.jsonl"), `${JSON.stringify(entry)}\n`, "utf8");
}
