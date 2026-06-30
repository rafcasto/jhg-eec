/**
 * Lead tracking in Supabase (public.jobhackers_leads), server-side only.
 *
 * We use the REST endpoint with the service key. Every registration is written
 * with:
 *   - stage  = 'acquisition' (default)
 *   - tag    = EVENT->REGISTRATION->EEC->{EEC_NAME}->{VERSION}
 *   - source = ?source=... from the URL, or 'direct' when empty
 *   - variant = the A/B variant key
 *
 * The table has a UNIQUE (email, tag, stage) constraint, which we lean on for
 * idempotency: a plain INSERT that conflicts returns 409, telling us the lead
 * already exists so we must NOT re-enroll them in the Resend sequence.
 */

export interface RecordLeadInput {
  email: string;
  firstName: string;
  tag: string;
  source: string;
  variant: string;
  stage?: string;
}

export interface RecordLeadResult {
  /** true when a brand-new row was inserted (safe to enroll in Resend). */
  created: boolean;
}

function baseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL is not set");
  return url.replace(/\/$/, "");
}

function headers() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export async function recordLead(
  input: RecordLeadInput
): Promise<RecordLeadResult> {
  const row = {
    email: input.email.trim().toLowerCase(),
    first_name: input.firstName,
    stage: input.stage ?? "acquisition",
    tag: input.tag,
    source: input.source,
    variant: input.variant,
  };

  const res = await fetch(`${baseUrl()}/rest/v1/jobhackers_leads`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify(row),
  });

  if (res.status === 201) return { created: true };

  // 409 = unique violation on (email, tag, stage): already registered.
  if (res.status === 409) return { created: false };

  const detail = await res.text();
  throw new Error(`Supabase lead insert failed (${res.status}): ${detail}`);
}

/**
 * Build the registration tag in the required format:
 *   EVENT->REGISTRATION->EEC->{EEC_NAME}->{VERSION}
 */
export function buildTag(eecName: string, versionLabel: string): string {
  return `EVENT->REGISTRATION->EEC->${eecName}->${versionLabel}`;
}

/** Pull the first name out of an email local part as a fallback. */
export function deriveFirstName(email: string): string {
  const local = email.split("@")[0] || "Friend";
  const token = local.split(/[._\-+]/)[0] || "Friend";
  return token.charAt(0).toUpperCase() + token.slice(1);
}
