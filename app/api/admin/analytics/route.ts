import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { ga4Config, getAnalyticsSnapshot } from "@/lib/ga4";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DAYS = new Set([7, 28, 90]);

export async function GET(req: NextRequest) {
  if (!isAuthed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ga4Config()) {
    return NextResponse.json({ configured: false }, { status: 200 });
  }
  const raw = Number(req.nextUrl.searchParams.get("days") ?? 28);
  const days = ALLOWED_DAYS.has(raw) ? raw : 28;
  try {
    const snapshot = await getAnalyticsSnapshot(days);
    return NextResponse.json({ configured: true, ...snapshot });
  } catch (e) {
    const message = e instanceof Error ? e.message : "GA4 request failed";
    return NextResponse.json({ configured: true, error: message }, { status: 502 });
  }
}
