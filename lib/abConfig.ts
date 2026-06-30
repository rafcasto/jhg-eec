import { promises as fs } from "fs";
import path from "path";
import type { ABConfig, Variant, VariantKey } from "./types";

/**
 * The editable A/B config lives in a JSON file on the server
 * (data/eec-config.json). The admin panel reads and writes it.
 * Kept server-side only — never imported into client components.
 */
const CONFIG_PATH = path.join(process.cwd(), "data", "eec-config.json");

let cache: { value: ABConfig; mtimeMs: number } | null = null;

export async function readConfig(): Promise<ABConfig> {
  const stat = await fs.stat(CONFIG_PATH);
  if (cache && cache.mtimeMs === stat.mtimeMs) return cache.value;
  const raw = await fs.readFile(CONFIG_PATH, "utf8");
  const value = JSON.parse(raw) as ABConfig;
  cache = { value, mtimeMs: stat.mtimeMs };
  return value;
}

export async function writeConfig(config: ABConfig): Promise<void> {
  config.updatedAt = new Date().toISOString();
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
  cache = null; // bust cache
}

export function getVariant(config: ABConfig, key: VariantKey): Variant {
  return config.variants[key];
}

export const VARIANT_KEYS: VariantKey[] = ["A", "B"];
