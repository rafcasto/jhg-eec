import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Minimal signed-cookie auth for the /admin panel. Not a full IdP — it gates
 * the panel with a shared password (ADMIN_PASSWORD) and an HMAC-signed session
 * cookie so the value can't be forged client-side.
 */
export const ADMIN_COOKIE = "jhg_admin";

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || "insecure-dev-secret";
}

export function makeToken(): string {
  const payload = `admin.${Date.now()}`;
  const sig = crypto
    .createHmac("sha256", secret())
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const idx = token.lastIndexOf(".");
  if (idx < 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto
    .createHmac("sha256", secret())
    .update(payload)
    .digest("hex");
  try {
    return (
      sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    );
  } catch {
    return false;
  }
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Server-side guard for use in server components / route handlers. */
export function isAuthed(): boolean {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  return verifyToken(token);
}
