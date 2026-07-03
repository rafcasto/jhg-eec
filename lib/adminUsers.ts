import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Admin user store for the /admin panel.
 *
 * Users can come from two places (merged, file takes precedence over env):
 *   1. ADMIN_USERS env var  — best for serverless (Vercel). Format is a
 *      comma/newline separated list of `username:hash` pairs, or a JSON array
 *      of { "username", "hash" }.
 *   2. data/admin-users.json — best for a local/single Node server. Written by
 *      `npm run seed:admin`. Gitignored so password hashes never hit the repo.
 *
 * Passwords are stored as scrypt hashes: `scrypt$<saltHex>$<keyHex>`.
 * A legacy single ADMIN_PASSWORD (username defaults to ADMIN_USERNAME or
 * "admin") still works when no matching user is configured, so existing
 * deployments keep functioning.
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

  // Compact form: "alice:scrypt$..,bob:scrypt$.." (comma or newline separated).
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

function usersFilePath(): string {
  return path.join(process.cwd(), "data", "admin-users.json");
}

function parseFileUsers(): AdminUser[] {
  try {
    const raw = fs.readFileSync(usersFilePath(), "utf8");
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

/** All configured users (file entries override env entries by username). */
export function listUsers(): AdminUser[] {
  const byName = new Map<string, AdminUser>();
  for (const u of parseEnvUsers()) byName.set(u.username.toLowerCase(), u);
  for (const u of parseFileUsers()) byName.set(u.username.toLowerCase(), u);
  return [...byName.values()];
}

function legacyUsername(): string {
  return (process.env.ADMIN_USERNAME || "admin").trim();
}

/** Verify a username + password against configured users (constant-time-ish). */
export function verifyUser(username: string, password: string): boolean {
  const u = (username || "").trim();
  if (!u || !password) return false;

  const match = listUsers().find(
    (x) => x.username.toLowerCase() === u.toLowerCase()
  );
  if (match) return verifyHash(password, match.hash);

  // Legacy single-password fallback (only when no explicit user matched).
  const legacyPw = process.env.ADMIN_PASSWORD || "";
  if (legacyPw && u.toLowerCase() === legacyUsername().toLowerCase()) {
    const a = Buffer.from(password);
    const b = Buffer.from(legacyPw);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  return false;
}

/** True when at least one login credential is configured (users or legacy). */
export function hasAnyCredential(): boolean {
  return listUsers().length > 0 || Boolean(process.env.ADMIN_PASSWORD);
}
