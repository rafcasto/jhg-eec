#!/usr/bin/env node
/**
 * Seed / manage admin users for the /admin panel — stored in Supabase.
 *
 * Credentials live on the existing `public.admins` table (email = username)
 * in a `password_hash` column (added by migration 0002). This script talks to
 * Supabase over the REST API using SUPABASE_URL + SUPABASE_SECRET_KEY, which are
 * read from .env.local automatically.
 *
 *   npm run seed:admin -- --username alice@x.com --password 's3cret!!'   add/update
 *   npm run seed:admin -- --list                                         list admins
 *   npm run seed:admin -- --remove alice@x.com                           revoke login
 *   npm run seed:admin -- --verify -u alice@x.com -p 's3cret!!'          test password
 *   npm run seed:admin -- --migrate-file                                 import users
 *                        from data/admin-users.json into Supabase (keeps hashes)
 *
 * Credentials may also come from SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USERS_FILE = path.join(ROOT, "data", "admin-users.json");

const KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const SEP = "$";

// ---------- tiny .env loader ----------
function loadEnv(file) {
  try {
    const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let [, k, v] = m;
      v = v.replace(/^['"]|['"]$/g, "");
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* no env file — fine */
  }
}
loadEnv(".env.local");
loadEnv(".env");

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || "";

function requireSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      "Error: SUPABASE_URL and SUPABASE_SECRET_KEY must be set (in .env.local)."
    );
    process.exit(1);
  }
}

function sbHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function sbFetch(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${body || res.statusText}`);
  }
  return res;
}

// ---------- crypto ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, KEYLEN, SCRYPT_PARAMS);
  return ["scrypt", salt.toString("hex"), key.toString("hex")].join(SEP);
}

function verifyHash(password, stored) {
  const parts = String(stored || "").split(SEP);
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (expected.length === 0) return false;
  const key = crypto.scryptSync(password, salt, expected.length, SCRYPT_PARAMS);
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

// ---------- Supabase admins ----------
async function upsertAdmin(email, hash) {
  const url = `${SUPABASE_URL}/rest/v1/admins?on_conflict=email`;
  await sbFetch(url, {
    method: "POST",
    headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify([{ email, password_hash: hash }]),
  });
}

async function listAdmins() {
  const url = `${SUPABASE_URL}/rest/v1/admins?select=email,password_hash&order=email`;
  const res = await sbFetch(url, { headers: sbHeaders() });
  return res.json();
}

async function getAdminHash(email) {
  const url = `${SUPABASE_URL}/rest/v1/admins?select=password_hash&email=eq.${encodeURIComponent(
    email
  )}&limit=1`;
  const res = await sbFetch(url, { headers: sbHeaders() });
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0].password_hash : null;
}

async function revokeAdmin(email) {
  const url = `${SUPABASE_URL}/rest/v1/admins?email=eq.${encodeURIComponent(email)}`;
  const res = await sbFetch(url, {
    method: "PATCH",
    headers: sbHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify({ password_hash: null }),
  });
  return res.json();
}

// ---------- args ----------
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const take = () => argv[++i];
    switch (a) {
      case "--username":
      case "-u":
        out.username = take();
        break;
      case "--password":
      case "-p":
        out.password = take();
        break;
      case "--remove":
        out.remove = take();
        break;
      case "--list":
        out.list = true;
        break;
      case "--verify":
        out.verify = true;
        break;
      case "--migrate-file":
        out.migrateFile = true;
        break;
      case "--help":
      case "-h":
        out.help = true;
        break;
      default:
        out._.push(a);
    }
  }
  return out;
}

function usage() {
  console.log(`Seed / manage admin users (Supabase public.admins)

  npm run seed:admin -- --username <email> --password <pass>   add or update
  npm run seed:admin -- --list                                 list admins
  npm run seed:admin -- --remove <email>                       revoke login
  npm run seed:admin -- --verify -u <email> -p <pass>          test a password
  npm run seed:admin -- --migrate-file                         import data/admin-users.json

Requires SUPABASE_URL and SUPABASE_SECRET_KEY (read from .env.local).`);
}

// ---------- main ----------
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  usage();
  process.exit(0);
}

requireSupabase();

try {
  if (args.list) {
    const rows = await listAdmins();
    if (!rows.length) {
      console.log("No rows in public.admins.");
    } else {
      console.log(`Admins (${rows.length}):`);
      for (const r of rows) {
        console.log(`  • ${r.email}${r.password_hash ? "" : "  (no password — can't log in)"}`);
      }
    }
    process.exit(0);
  }

  if (args.remove) {
    const email = String(args.remove).trim().toLowerCase();
    const rows = await revokeAdmin(email);
    if (!rows.length) {
      console.error(`No admin "${email}" found.`);
      process.exit(1);
    }
    console.log(`Revoked login for "${email}" (row kept in public.admins).`);
    process.exit(0);
  }

  if (args.verify) {
    const email = (args.username || process.env.SEED_ADMIN_USERNAME || "")
      .trim()
      .toLowerCase();
    const pw = args.password || process.env.SEED_ADMIN_PASSWORD || "";
    if (!email || !pw) {
      console.error("Error: --verify needs --username and --password.");
      process.exit(1);
    }
    const hash = await getAdminHash(email);
    if (!hash) {
      console.error(`No password set for "${email}" in public.admins.`);
      process.exit(1);
    }
    if (verifyHash(pw, hash)) {
      console.log(`OK — password matches for "${email}".`);
      process.exit(0);
    }
    console.error(`FAIL — password does not match for "${email}".`);
    process.exit(1);
  }

  if (args.migrateFile) {
    let users = [];
    try {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
      users = Array.isArray(data) ? data : data.users || [];
    } catch {
      console.error(`Could not read ${USERS_FILE}.`);
      process.exit(1);
    }
    if (!users.length) {
      console.log("No users in data/admin-users.json to migrate.");
      process.exit(0);
    }
    for (const u of users) {
      const email = String(u.username || "").trim().toLowerCase();
      if (!email || !u.hash) continue;
      await upsertAdmin(email, u.hash);
      console.log(`  ✓ migrated ${email}`);
    }
    console.log(`Migrated ${users.length} user(s) into public.admins.`);
    process.exit(0);
  }

  // default: add / update a user
  const email = (args.username || process.env.SEED_ADMIN_USERNAME || "")
    .trim()
    .toLowerCase();
  const password = args.password || process.env.SEED_ADMIN_PASSWORD || "";
  if (!email || !password) {
    console.error("Error: a username (email) and password are required.\n");
    usage();
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Error: password must be at least 8 characters.");
    process.exit(1);
  }
  await upsertAdmin(email, hashPassword(password));
  console.log(`Saved admin "${email}" to public.admins.`);
  process.exit(0);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
