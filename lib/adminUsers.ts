import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Admin authentication for the /admin panel.
 *
 * Primary: **Supabase Auth (GoTrue)**. Admins sign in with their Supabase Auth
 * email + password (the password grant). Authorization is gated by the existing
 * `public.admins` allowlist table — only emails present there may enter /admin.
 *
 * Fallback (used only when Supabase isn't configured, e.g. pure local dev):
 *   - ADMIN_USERS env var  — `username:scryptHash` pairs or a JSON array
 *   - data/admin-users.json — local file (gitignored)
 *   - legacy single ADMIN_PASSWORD (username = ADMIN_USERNAME or "admin")
 */

export interface AdminUser {
  username: string;
  hash: string;
}

const KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

/** Create a `scrypt$salt$key` hash (used by the env/file fallback only). */
export function hashPassword(password: string, salt?: Buffer): string {
  const s = salt ?? crypto.randomBytes(16);
  const key = crypto.scryptSync(password, s, KEYLEN, SCRYPT_PARAMS);
  return `scrypt$${s.toString("hex")}$${key.toString("hex")}`;
}

/** Constant-time verify against a `scrypt$salt$key` hash. */
export function verifyHash(password: string, stored: string): boolean {
  const parts = (stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[1], "hex");
    expected = Buffer.from(parts[2], "hex");
  } catch {
    return false;
  }
  if (expected.length === 0) return false;
  let key: Buffer;
  try {
    key = crypto.scryptSync(password, salt, expected.length, SCRYPT_PARAMS);
  } catch {
    return false;
  }
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

// ---------------- Supabase Auth (primary) ----------------

function supabaseBase(): string | null {
  const url = process.env.SUPABASE_URL;
  return url ? url.replace(/\/$/, "") : null;
}

/** apikey for public GoTrue calls: anon/publishable key if set, else service. */
function apiKey(): string | null {
  return (
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    null
  );
}

function serviceKey(): string | null {
  return process.env.SUPABASE_SECRET_KEY || null;
}

/** True when we can talk to Supabase Auth + the admins allowlist. */
export function supabaseAuthEnabled(): boolean {
  return Boolean(supabaseBase() && serviceKey());
}

/** Verify email + password against Supabase Auth (password grant). */
async function supabaseSignIn(email: string, password: string): Promise<boolean> {
  const base = supabaseBase();
  const key = apiKey();
  if (!base || !key) return false;
  try {
    const res = await fetch(`${base}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    return res.ok; // 200 => valid credentials
  } catch {
    return false;
  }
}

/** True when the email is present in the public.admins allowlist. */
async function isAllowlistedAdmin(email: string): Promise<boolean> {
  const base = supabaseBase();
  const key = serviceKey();
  if (!base || !key) return false;
  const e = email.trim().toLowerCase();
  try {
    const res = await fetch(
      `${base}/rest/v1/admins?select=email&email=eq.${encodeURIComponent(e)}&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as unknown[];
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

// ---------------- Env + file (fallback) ----------------

function parseEnvUsers(): AdminUser[] {
  const raw = process.env.ADMIN_USERS?.trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr
        .map((u: any) => ({
          username: String(u.username || "").trim(),
          hash: String(u.hash || "").trim(),
        }))
        .filter((u) => u.username && u.hash);
    } catch {
      return [];
    }
  }
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf(":");
      if (i < 0) return { username: "", hash: "" };
      return { username: pair.slice(0, i).trim(), hash: pair.slice(i + 1).trim() };
    })
    .filter((u) => u.username && u.hash);
}

function parseFileUsers(): AdminUser[] {
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "data", "admin-users.json"),
      "utf8"
    );
    const data = JSON.parse(raw);
    const list = Array.isArray(data) ? data : data.users;
    if (!Array.isArray(list)) return [];
    return list
      .map((u: any) => ({
        username: String(u.username || "").trim(),
        hash: String(u.hash || "").trim(),
      }))
      .filter((u) => u.username && u.hash);
  } catch {
    return [];
  }
}

function listUsers(): AdminUser[] {
  const byName = new Map<string, AdminUser>();
  for (const u of parseEnvUsers()) byName.set(u.username.toLowerCase(), u);
  for (const u of parseFileUsers()) byName.set(u.username.toLowerCase(), u);
  return [...byName.values()];
}

function legacyUsername(): string {
  return (process.env.ADMIN_USERNAME || "admin").trim();
}

/**
 * Verify a login. When Supabase is configured, authenticate against Supabase
 * Auth and require the email to be in the admins allowlist. Otherwise, fall
 * back to env/file/legacy credentials for local development.
 */
export async function verifyUser(
  username: string,
  password: string
): Promise<boolean> {
  const u = (username || "").trim();
  if (!u || !password) return false;

  if (supabaseAuthEnabled()) {
    const signedIn = await supabaseSignIn(u, password);
    if (!signedIn) return false;
    return isAllowlistedAdmin(u);
  }

  // Fallback (local dev without Supabase)
  const match = listUsers().find(
    (x) => x.username.toLowerCase() === u.toLowerCase()
  );
  if (match) return verifyHash(password, match.hash);

  const legacyPw = process.env.ADMIN_PASSWORD || "";
  if (legacyPw && u.toLowerCase() === legacyUsername().toLowerCase()) {
    const a = Buffer.from(password);
    const b = Buffer.from(legacyPw);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  return false;
}
