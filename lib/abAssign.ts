import type { ABConfig, VariantKey } from "./types";
import { VARIANT_KEYS } from "./abConfig";

/**
 * Pick a variant for a brand-new visitor using a weighted random split
 * across the *enabled* variants only.
 *
 * - 100% traffic to one version  → disable the other (or set its weight to 0).
 * - 75/25, 50/50, etc.           → set the weights accordingly.
 *
 * Returns null if no variant is enabled (caller should show a fallback).
 */
export function pickVariant(config: ABConfig): VariantKey | null {
  const enabled = VARIANT_KEYS.filter(
    (k) => config.variants[k].enabled && config.variants[k].weight > 0
  );
  if (enabled.length === 0) {
    // Fall back to any enabled variant ignoring weight, else null.
    const anyEnabled = VARIANT_KEYS.filter((k) => config.variants[k].enabled);
    return anyEnabled[0] ?? null;
  }
  if (enabled.length === 1) return enabled[0];

  const total = enabled.reduce((sum, k) => sum + config.variants[k].weight, 0);
  let roll = Math.random() * total;
  for (const k of enabled) {
    roll -= config.variants[k].weight;
    if (roll <= 0) return k;
  }
  return enabled[enabled.length - 1];
}

/**
 * Resolve the variant for a request: honor a sticky cookie if it points to a
 * still-enabled variant; otherwise assign a fresh one.
 */
export function resolveVariant(
  config: ABConfig,
  cookieVariant: string | undefined
): { key: VariantKey; isNew: boolean } {
  if (
    cookieVariant === "A" ||
    cookieVariant === "B"
  ) {
    if (config.variants[cookieVariant].enabled) {
      return { key: cookieVariant, isNew: false };
    }
  }
  const picked = pickVariant(config);
  // If literally nothing is enabled, default to A so the page still renders.
  return { key: picked ?? "A", isNew: true };
}
