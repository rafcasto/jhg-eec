import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "@/lib/abConfig";
import {
  recordLead,
  buildTag,
  deriveFirstName,
} from "@/lib/supabaseLeads";
import { enrollInSequence } from "@/lib/resendSequences";
import { enrollInKitSequence } from "@/lib/kitSequences";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: { email?: string; variant?: string; source?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const variantKey = body.variant === "A" || body.variant === "B" ? body.variant : null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }
  if (!variantKey) {
    return NextResponse.json({ error: "Unknown variant." }, { status: 400 });
  }

  const config = await readConfig();
  const variant = config.variants[variantKey];

  // Source: from the client-provided query value, else "direct".
  const source = (body.source && String(body.source).trim()) || "direct";

  // Tag: EVENT->REGISTRATION->EEC->{EEC_NAME}->{VERSION}
  const tag = buildTag(variant.eecName, variant.versionLabel);
  const firstName = deriveFirstName(email);

  try {
    // 1. Persist the lead (idempotent via UNIQUE(email, tag, stage)).
    const { created } = await recordLead({
      email,
      firstName,
      tag,
      source,
      variant: variant.key,
      stage: "acquisition",
    });

    // 2. Enroll in the email sequences — only for genuinely new registrations,
    //    so the same person never enters the same sequence twice. Each provider
    //    fails independently: a broken one must not cost us the signup.
    let enrolled = false;
    let kitEnrolled = false;
    if (created) {
      try {
        await enrollInSequence(email, variant.sequence);
        enrolled = true;
      } catch (err) {
        // Lead is saved; log and continue so we don't lose the signup.
        console.error("[subscribe] Resend enroll failed:", err);
      }

      try {
        await enrollInKitSequence(email, { firstName });
        kitEnrolled = true;
      } catch (err) {
        console.error("[subscribe] Kit enroll failed:", err);
      }
    }

    return NextResponse.json({ ok: true, created, enrolled, kitEnrolled });
  } catch (err) {
    console.error("[subscribe] failed:", err);
    return NextResponse.json(
      { error: "We couldn't save your signup. Please try again." },
      { status: 500 }
    );
  }
}
