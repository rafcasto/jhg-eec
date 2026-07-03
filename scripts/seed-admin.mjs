#!/usr/bin/env node
/**
 * Manage admin logins — backed by Supabase Auth (GoTrue) + the public.admins
 * allowlist. Admins sign in to /admin with their Supabase Auth email + password;
 * their email must also be present in public.admins to be authorized.
 *
 *   npm run seed:admin -- --username you@x.com --password 's3cret!!'   create/update
 *   npm run seed:admin -- --list                                       list admins
 *   npm run seed:admin -- --remove you@x.com                           revoke (allowlist)
 *   npm run seed:admin -- --verify -u you@x.com -p 's3cret!!'          test a password
 *
 * "create/update" creates the Supabase Auth user (or resets their password if
 * they already exist) and adds them to the public.admins allowlist.
 *
 * Requires SUPABASE_URL + SUPABASE_SECRET_KEY (read from .env.local). If set,
 * SUPABASE_ANON_KEY is used for the password grant, else the service key.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

const BASE = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE = process.env.SUPABASE_SECRET_KEY || "";
const ANON =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  SERVICE;

function requireEnv() {
  if (!BASE || !SERVICE) {
    console.error(
      "Error: SUPABASE_URL and SUPABASE_SECRET_KEY must be set (in .env.local)."
    );
    process.exit(1);
  }
}

function adminHeaders(extra = {}) {
  return {
    apikey: SERVICE,
    Authorization: `Bearer ${SERVICE}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function ok(res, label) {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${label} failed (${res.status}): ${body || res.statusText}`);
  }
  return res;
}

// ---------- GoTrue (auth.users) ----------
async function findAuthUser(email) {
  const res = await ok(
    await fetch(`${BASE}/auth/v1/admin/users?per_page=1000`, {
      headers: adminHeaders(),
    }),
    "list auth users"
  );
  const data = await res.json();
  const users = Array.isArray(data) ? data : data.users || [];
  return users.find((u) => (u.email || "").toLowerCase() === email) || null;
}

async function createAuthUser(email, password) {
  await ok(
    await fetch(`${BASE}/auth/v1/admin/users`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ email, password, email_confirm: true }),
    }),
    "create auth user"
  );
}

async function updateAuthPassword(id, password) {
  await ok(
    await fetch(`${BASE}/auth/v1/admin/users/${id}`, {
      method: "PUT",
      headers: adminHeaders(),
      body: JSON.stringify({ password, email_confirm: true }),
    }),
    "update auth user"
  );
}

// ---------- allowlist (public.admins) ----------
async function ensureAllowlist(email) {
  await ok(
    await fetch(`${BASE}/rest/v1/admins?on_conflict=email`, {
      method: "POST",
      headers: adminHeaders({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify([{ email }]),
    }),
    "allowlist upsert"
  );
}

async function removeAllowlist(email) {
  const res = await ok(
    await fetch(`${BASE}/rest/v1/admins?email=eq.${encodeURIComponent(email)}`, {
      method: "DELETE",
      headers: adminHeaders({ Prefer: "return=representation" }),
    }),
    "allowlist delete"
  );
  return res.json();
}

async function listAllowlist() {
  const res = await ok(
    await fetch(`${BASE}/rest/v1/admins?select=email&order=email`, {
      headers: adminHeaders(),
    }),
    "allowlist list"
  );
  return res.json();
}

async function passwordGrant(email, password) {
  const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.ok;
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
  console.log(`Manage admin logins (Supabase Auth + public.admins allowlist)

  npm run seed:admin -- --username <email> --password <pass>   create/update + allow
  npm run seed:admin -- --list                                 list allowlisted admins
  npm run seed:admin -- --remove <email>                       revoke (remove from allowlist)
  npm run seed:admin -- --verify -u <email> -p <pass>          test a password

Requires SUPABASE_URL and SUPABASE_SECRET_KEY (read from .env.local).`);
}

// ---------- main ----------
const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}
requireEnv();

try {
  if (args.list) {
    const rows = await listAllowlist();
    if (!rows.length) console.log("No admins in public.admins.");
    else {
      console.log(`Allowlisted admins (${rows.length}):`);
      for (const r of rows) console.log(`  • ${r.email}`);
    }
    process.exit(0);
  }

  if (args.remove) {
    const email = String(args.remove).trim().toLowerCase();
    const rows = await removeAllowlist(email);
    if (!rows.length) {
      console.error(`"${email}" was not in the allowlist.`);
      process.exit(1);
    }
    console.log(
      `Removed "${email}" from public.admins (their Supabase Auth account is kept).`
    );
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
    const okAuth = await passwordGrant(email, pw);
    if (!okAuth) {
      console.error(`FAIL — Supabase Auth rejected "${email}".`);
      process.exit(1);
    }
    const rows = await listAllowlist();
    const allowed = rows.some(
      (r) => (r.email || "").toLowerCase() === email
    );
    console.log(
      allowed
        ? `OK — password valid and "${email}" is an allowlisted admin.`
        : `Password valid, but "${email}" is NOT in public.admins (no /admin access).`
    );
    process.exit(allowed ? 0 : 1);
  }

  // default: create/update
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

  const existing = await findAuthUser(email);
  if (existing) {
    await updateAuthPassword(existing.id, password);
    console.log(`Updated Supabase Auth password for "${email}".`);
  } else {
    await createAuthUser(email, password);
    console.log(`Created Supabase Auth user "${email}".`);
  }
  await ensureAllowlist(email);
  console.log(`Allowlisted "${email}" in public.admins. Done.`);
  process.exit(0);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
