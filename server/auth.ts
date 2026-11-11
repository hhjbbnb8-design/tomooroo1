import type { Request, Response } from "express";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { parse as parseCookie } from "cookie";
import type { User } from "../drizzle/schema";
import { createSession, deleteSession, getUserBySessionHash } from "./db";

const scrypt = promisify(scryptCb);

export const SESSION_COOKIE = "midad_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 يوماً
export const CSRF_HEADER = "x-midad-client";

/* ------------------------------ كلمات المرور ------------------------------ */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hashHex] = parts;
  try {
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    const expected = Buffer.from(hashHex, "hex");
    if (expected.length !== derived.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/* ------------------------------- الجلسات ------------------------------- */

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await createSession(hashToken(token), userId, expiresAt);
  return { token, expiresAt };
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
  });
}

function readBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

function readCookieToken(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  try {
    return parseCookie(header)[SESSION_COOKIE] ?? null;
  } catch {
    return null;
  }
}

export async function getUserFromRequest(req: Request): Promise<User | null> {
  const token = readBearer(req) ?? readCookieToken(req);
  if (!token) return null;
  try {
    const row = await getUserBySessionHash(hashToken(token));
    if (!row) return null;
    if (!row.user.isActive) return null;
    return row.user;
  } catch {
    return null;
  }
}

export async function revokeRequestSession(req: Request) {
  const token = readBearer(req) ?? readCookieToken(req);
  if (!token) return;
  try {
    await deleteSession(hashToken(token));
  } catch {
    /* ignore */
  }
}

/** حماية بسيطة من طلبات CSRF: كل طلب يغيّر الحالة يجب أن يحمل ترويسة التطبيق. */
export function csrfGuard(req: Request, res: Response, next: () => void) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.path === "/api/health") return next();
  if (req.get(CSRF_HEADER) === "1") return next();
  res.status(403).json({ error: "طلب غير مصرح به" });
}

export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    schoolId: user.schoolId,
    isActive: user.isActive,
  };
}

export type PublicUser = ReturnType<typeof publicUser>;
