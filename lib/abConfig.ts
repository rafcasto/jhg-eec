import { promises as fs } from "fs";
import path from "path";
import type { ABConfig, Variant, VariantKey } from "./types";

/**
 * The editable A/B / landing config.
 *
 * Primary store: Supabase (public.eec_config, a single row id='default' holding
 * the whole ABConfig as JSONB). This is required on serverless hosts (Vercel),
 * where the app filesystem is read-only and data/eec-config.json can't be
 * written.
 *
 * The bundled data/eec-config.json is used only as a read-only default/seed
 * (e.g. before the first save, or for local dev without Supabase).
 * Kept server-side only — never imported into client components.
 */
const CONFIG_PATH = path.join(process.cwd(), "data", "eec-config.json");
const TABLE = "eec_config";
const ROW_ID = "default";
const CACHE_TTL_MS = 15_000;

let cache: { value: ABConfig; at: number } | null = null;

function supabaseBase(): string | null {
  const url = process.env.SUPABASE_URL;
  return url ? url.replace(/\/$/, "") : null;
}

function serviceKey(): string | null {
  return process.env.SUPABASE_SECRET_KEY || null;
}

function supabaseConfigured(): boolean {
  return Boolean(supabaseBase() && serviceKey());
}

function sbHeaders(extra: Record<string, string> = {}) {
  const key = serviceKey() as string;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function fetchFromSupabase(): Promise<ABConfig | null> {
  const base = supabaseBase();
  if (!base || !serviceKey()) return null;
  try {
    const res = await fetch(
      `${base}/rest/v1/${TABLE}?id=eq.${ROW_ID}&select=config&limit=1`,
      { headers: sbHeaders(), cache: "no-store" }
    );
    if (!res.ok) return null; // table missing / not seeded yet -> use default
    const rows = (await res.json()) as Array<{ config?: ABConfig }>;
    return Array.isArray(rows) && rows[0]?.config ? rows[0].config : null;
  } catch {
    return null;
  }
}

async function saveToSupabase(config: ABConfig): Promise<void> {
  const base = supabaseBase();
  const res = await fetch(`${base}/rest/v1/${TABLE}?on_conflict=id`, {
    method: "POST",
    headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify([
      { id: ROW_ID, config, updated_at: config.updatedAt },
    ]),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Could not save config to Supabase (${res.status}). ${
        body || ""
      } — has the eec_config table been created?`
    );
  }
}

async function readFileDefault(): Promise<ABConfig> {
  const raw = await fs.readFile(CONFIG_PATH, "utf8");
  return JSON.parse(raw) as ABConfig;
}

export async function readConfig(): Promise<ABConfig> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.value;

  const fromDb = supabaseConfigured() ? await fetchFromSupabase() : null;
  const value = fromDb ?? (await readFileDefault());
  cache = { value, at: now };
  return value;
}

export async function writeConfig(config: ABConfig): Promise<void> {
  config.updatedAt = new Date().toISOString();

  if (supabaseConfigured()) {
    await saveToSupabase(config);
  } else {
    // Local dev without Supabase — persist to the JSON file.
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
  }

  cache = { value: config, at: Date.now() };
}

export function getVariant(config: ABConfig, key: VariantKey): Variant {
  return config.variants[key];
}

export const VARIANT_KEYS: VariantKey[] = ["A", "B"];
