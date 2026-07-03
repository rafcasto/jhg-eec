#!/usr/bin/env node
/**
 * Seed / manage admin users for the /admin panel.
 *
 * Credentials come from CLI flags or from the environment (.env.local is
 * loaded automatically):
 *   --username, -u   username     (or env SEED_ADMIN_USERNAME)
 *   --password, -p   password     (or env SEED_ADMIN_PASSWORD)
 *
 * Actions:
 *   npm run seed:admin -- --username alice --password 's3cret'    add/update user
 *   npm run seed:admin -- --list                                  list usernames
 *   npm run seed:admin -- --remove alice                          remove a user
 *   npm run seed:admin -- --verify -u alice -p 's3cret'           test a password
 *   npm run seed:admin -- -u alice -p x --print                   also print the
 *                        ADMIN_USERS env value (for serverless/Vercel).
 *
 * Users are stored (scrypt-hashed) in data/admin-users.json, which is
 * gitignored so hashes never land in the repo. For serverless hosts where the
 * file isn't present, copy the `--print` output into the ADMIN_USERS env var.
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

// ---------- tiny .env loader (no dependency) ----------
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
      case "--print":
      case "--env":
        out.print = true;
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

function readUsers() {
  try {
    const data = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    const list = Array.isArray(data) ? data : data.users;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2) + "\n");
}

function envValue(users) {
  return users.map((u) => `${u.username}:${u.hash}`).join(",");
}

function usage() {
  console.log(`Seed / manage admin users

  npm run seed:admin -- --username <name> --password <pass>   add or update a user
  npm run seed:admin -- --list                                list usernames
  npm run seed:admin -- --remove <name>                       remove a user
  npm run seed:admin -- --verify -u <name> -p <pass>          test a password
  add --print to an add command to also output the ADMIN_USERS env value

Credentials may also come from SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD
(in .env.local or the shell environment).`);
}

// ---------- main ----------
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  usage();
  process.exit(0);
}

if (args.list) {
  const users = readUsers();
  if (!users.length) {
    console.log("No users in data/admin-users.json.");
  } else {
    console.log(`Admin users (${users.length}):`);
    for (const u of users) console.log(`  • ${u.username}`);
  }
  process.exit(0);
}

if (args.remove) {
  const users = readUsers();
  const next = users.filter(
    (u) => u.username.toLowerCase() !== String(args.remove).toLowerCase()
  );
  if (next.length === users.length) {
    console.error(`User "${args.remove}" not found.`);
    process.exit(1);
  }
  writeUsers(next);
  console.log(`Removed "${args.remove}". ${next.length} user(s) remain.`);
  process.exit(0);
}

if (args.verify) {
  const u = (args.username || process.env.SEED_ADMIN_USERNAME || "").trim();
  const pw = args.password || process.env.SEED_ADMIN_PASSWORD || "";
  if (!u || !pw) {
    console.error("Error: --verify needs --username and --password.");
    process.exit(1);
  }
  const match = readUsers().find(
    (x) => x.username.toLowerCase() === u.toLowerCase()
  );
  if (!match) {
    console.error(`No user "${u}" in data/admin-users.json.`);
    process.exit(1);
  }
  if (verifyHash(pw, match.hash)) {
    console.log(`OK — password matches for "${u}".`);
    process.exit(0);
  }
  console.error(`FAIL — password does not match for "${u}".`);
  process.exit(1);
}

const username = (args.username || process.env.SEED_ADMIN_USERNAME || "").trim();
const password = args.password || process.env.SEED_ADMIN_PASSWORD || "";

if (!username || !password) {
  console.error("Error: a username and password are required.\n");
  usage();
  process.exit(1);
}
if (password.length < 8) {
  console.error("Error: password must be at least 8 characters.");
  process.exit(1);
}

const users = readUsers();
const idx = users.findIndex(
  (u) => u.username.toLowerCase() === username.toLowerCase()
);
const entry = { username, hash: hashPassword(password) };
if (idx >= 0) {
  users[idx] = entry;
  console.log(`Updated password for "${username}".`);
} else {
  users.push(entry);
  console.log(`Added admin user "${username}".`);
}
writeUsers(users);
console.log(`Saved ${users.length} user(s) to data/admin-users.json`);

if (args.print) {
  console.log("\nFor serverless hosts, set this environment variable instead:\n");
  console.log(`ADMIN_USERS=${envValue(users)}`);
}
