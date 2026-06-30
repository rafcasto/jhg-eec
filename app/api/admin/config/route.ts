import { NextRequest, NextResponse } from "next/server";
import { readConfig, writeConfig } from "@/lib/abConfig";
import { isAuthed } from "@/lib/adminAuth";
import type { ABConfig, VariantKey } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  if (!isAuthed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const config = await readConfig();
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  if (!isAuthed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let incoming: ABConfig;
  try {
    incoming = (await req.json()) as ABConfig;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const current = await readConfig();
  const keys: VariantKey[] = ["A", "B"];

  // Merge defensively: keep current structure, apply incoming editable fields.
  const next: ABConfig = { ...current };
  for (const k of keys) {
    const src = incoming.variants?.[k];
    if (!src) continue;
    const cur = current.variants[k];
    next.variants[k] = {
      ...cur,
      name: typeof src.name === "string" ? src.name : cur.name,
      sequence: src.sequence === "kickstarter" || src.sequence === "repairkit" ? src.sequence : cur.sequence,
      eecName: typeof src.eecName === "string" ? src.eecName.trim() : cur.eecName,
      versionLabel: typeof src.versionLabel === "string" ? src.versionLabel.trim() : cur.versionLabel,
      enabled: typeof src.enabled === "boolean" ? src.enabled : cur.enabled,
      weight: clampWeight(src.weight, cur.weight),
      content: { ...cur.content, ...(src.content || {}) },
    };
  }

  await writeConfig(next);
  return NextResponse.json({ ok: true, config: next });
}

function clampWeight(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(100, Math.round(n));
}
