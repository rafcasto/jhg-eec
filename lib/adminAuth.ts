import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Minimal signed-cookie auth for the /admin panel. Not a full IdP — it gates
 * the panel with per-user credentials (see lib/adminUsers.ts) and an
 * HMAC-signed session cookie that carries the signed-in username so it can't be
 * forged client-side.
 */
export const ADMIN_COOKIE = "jhg_admin";

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || "insecure-dev-secret";
}

function hmac(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

/** Build a signed session token for a username. */
export function makeToken(username: string): string {
  const u = Buffer.from(username, "utf8").toString("base64url");
  const payload = `${u}.${Date.now()}`;
  return `${payload}.${hmac(payload)}`;
}

/** Verify + decode a session token. Returns the username, or null if invalid. */
export function readToken(
  token: string | undefined
): { username: string } | null {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = hmac(payload);
  try {
    const ok =
      sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) return null;
  } catch {
    return null;
  }
  const dot = payload.indexOf(".");
  if (dot < 0) return null;
  try {
    const username = Buffer.from(payload.slice(0, dot), "base64url").toString(
      "utf8"
    );
    return { username };
  } catch {
    return null;
  }
}

export function verifyToken(token: string | undefined): boolean {
  return readToken(token) !== null;
}

/** Server-side guard for use in server components / route handlers. */
export function isAuthed(): boolean {
  return verifyToken(cookies().get(ADMIN_COOKIE)?.value);
}

/** The username of the current session, or null when not signed in. */
export function sessionUsername(): string | null {
  return readToken(cookies().get(ADMIN_COOKIE)?.value)?.username ?? null;
}
