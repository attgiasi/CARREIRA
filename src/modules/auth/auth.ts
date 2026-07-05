import crypto from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { CareerDatabase } from "../../database/db.js";

const cookieName = "career_hunter_session";
const sessionDays = 30;

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

function base64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of String(header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${base64Url(salt)}$${base64Url(hash)}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [method, saltRaw, hashRaw] = stored.split("$");
  if (method !== "scrypt" || !saltRaw || !hashRaw) return false;
  const salt = Buffer.from(saltRaw, "base64url");
  const expected = Buffer.from(hashRaw, "base64url");
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

export function publicUser(row: Record<string, unknown>): AuthUser {
  return {
    id: Number(row.id),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    role: String(row.role ?? "user"),
    status: String(row.status ?? "active")
  };
}

export async function createSession(db: CareerDatabase, userId: number, req: Request, res: Response): Promise<void> {
  const token = base64Url(crypto.randomBytes(32));
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);
  db.run(
    "INSERT INTO user_sessions (user_id, token_hash, expires_at, user_agent, ip_address) VALUES (?, ?, ?, ?, ?)",
    [userId, tokenHash(token), expiresAt.toISOString(), String(req.headers["user-agent"] ?? ""), req.ip ?? ""]
  );
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${cookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionDays * 24 * 60 * 60}${secure}`
  );
}

export function clearSessionCookie(res: Response): void {
  res.setHeader("Set-Cookie", `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  const token = parseCookies(req.headers.cookie)[cookieName];
  if (!token) return null;
  const db = await CareerDatabase.open();
  const row = db.query<Record<string, unknown>>(
    `SELECT u.*
     FROM user_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?
       AND s.revoked_at IS NULL
       AND datetime(s.expires_at) > datetime('now')
       AND u.status = 'active'
     LIMIT 1`,
    [tokenHash(token)]
  )[0];
  return row ? publicUser(row) : null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Faça login para continuar." });
    return;
  }
  (req as Request & { user: AuthUser }).user = user;
  next();
}

export function currentUser(req: Request): AuthUser {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user) throw new Error("Usuário não autenticado.");
  return user;
}

export function currentUserId(req: Request): number {
  return currentUser(req).id;
}

export async function revokeCurrentSession(req: Request): Promise<void> {
  const token = parseCookies(req.headers.cookie)[cookieName];
  if (!token) return;
  const db = await CareerDatabase.open();
  db.run("UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?", [tokenHash(token)]);
}

export async function userCount(db: CareerDatabase): Promise<number> {
  return Number(db.query("SELECT COUNT(*) as total FROM users")[0]?.total ?? 0);
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return "Use letras e números na senha.";
  return null;
}
