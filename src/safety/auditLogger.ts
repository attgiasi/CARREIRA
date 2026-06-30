import fs from "node:fs";
import path from "node:path";
import { maskObject } from "./piiMasker.js";

export type RiskLevel = "baixo" | "medio" | "alto";

export function audit(module: string, action: string, result: string, riskLevel: RiskLevel = "baixo", metadata: unknown = {}): void {
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

export function logError(module: string, error: unknown, metadata: unknown = {}): void {
  fs.mkdirSync(path.resolve(process.cwd(), "logs"), { recursive: true });
  const entry = {
    timestamp: new Date().toISOString(),
    module,
    error: error instanceof Error ? error.message : String(error),
    metadata: maskObject(metadata)
  };
  fs.appendFileSync(path.resolve(process.cwd(), "logs/errors.jsonl"), `${JSON.stringify(entry)}\n`, "utf8");
}
