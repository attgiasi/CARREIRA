import fs from "node:fs";
import path from "node:path";
const vaultPath = path.resolve(process.cwd(), "data/privacy-vault.json");
export function savePrivateNote(key, value) {
    fs.mkdirSync(path.dirname(vaultPath), { recursive: true });
    const current = fs.existsSync(vaultPath) ? JSON.parse(fs.readFileSync(vaultPath, "utf8")) : {};
    current[key] = value;
    fs.writeFileSync(vaultPath, JSON.stringify(current, null, 2), "utf8");
}
export function readPrivateNote(key) {
    if (!fs.existsSync(vaultPath))
        return "";
    const current = JSON.parse(fs.readFileSync(vaultPath, "utf8"));
    return current[key] ?? "";
}
