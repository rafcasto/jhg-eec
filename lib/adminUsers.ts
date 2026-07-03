import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Admin credentials for the /admin panel.
 *
 * Primary store: Supabase — the existing `public.admins` table, keyed by
 * `email` (used as the username), with a `password_hash` column added by the
 * 0002 migration. Users are managed with `npm run seed:admin`.
 *
 * Fallbacks (checked only when Supabase has no credential for the user):
 *   - ADMIN_USERS env var  — `username:hash` pairs or a JSON array
 *   - data/admin-users.json — local file (gitignored)
 *   - legacy single ADMIN_PASSWORD (username = ADMIN_USERNAME or "admin")
 *
 * Passwords are scrypt hashes: `scrypt$<saltHex>$<keyHex>`.
 */

export interface AdminUser {
  username: string;
  hash: string;
}

const KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

/** Create a `scrypt$salt$key` hash for a plaintext password. */
export function hashPassword(password: string, salt?: Buffer): string {
  const s = salt ?? crypto.randomBytes(16);
  const key = crypto.scryptSync(password, s, KEYLEN, SCRYPT_PARAMS);
  return `scrypt$${s.toString("hex")}$${key.toString("hex")}`;
}

/** Constant-time verify of a plaintext password against a stored hash. */
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

// ---------------- Supabase (primary) ----------------

function supabaseBase(): string | null {
  const url = process.env.SUPABASE_URL;
  return url ? url.replace(/\/$/, "") : null;
}

/** Look up an admin's password hash in Supabase (public.admins.email). */
async function getSupabaseAdminHash(username: string): Promise<string | null> {
  const base = supabaseBase();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!base || !key) return null;

  const email = username.trim().toLowerCase();
  const url =
    `${base}/rest/v1/admins` +
    `?select=password_hash&email=eq.${encodeURIComponent(email)}&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ password_hash?: string | null }>;
    const hash = Array.isArray(rows) && rows[0] ? rows[0].password_hash : null;
    return hash || null;
  } catch {
    return null;
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

/** Fallback users (file overrides env by username). */
export function listUsers(): AdminUser[] {
  const byName = new Map<string, AdminUser>();
  for (const u of parseEnvUsers()) byName.set(u.username.toLowerCase(), u);
  for (const u of parseFileUsers()) byName.set(u.username.toLowerCase(), u);
  return [...byName.values()];
}

function legacyUsername(): string {
  return (process.env.ADMIN_USERNAME || "admin").trim();
}

/** Verify a username + password. Supabase first, then env/file, then legacy. */
export async function verifyUser(
  username: string,
  password: string
): Promise<boolean> {
  const u = (username || "").trim();
  if (!u || !password) return false;

  // 1. Supabase (primary)
  const sbHash = await getSupabaseAdminHash(u);
  if (sbHash) return verifyHash(password, sbHash);

  // 2. Env / file fallback
  const match = listUsers().find(
    (x) => x.username.toLowerCase() === u.toLowerCase()
  );
  if (match) return verifyHash(password, match.hash);

  // 3. Legacy single password
  const legacyPw = process.env.ADMIN_PASSWORD || "";
  if (legacyPw && u.toLowerCase() === legacyUsername().toLowerCase()) {
    const a = Buffer.from(password);
    const b = Buffer.from(legacyPw);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  return false;
}
