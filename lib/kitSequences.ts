/**
 * Server-side enrollment into Kit (ConvertKit) sequences.
 *
 * Kit v4 works in two steps:
 *   1. Upsert the subscriber (so we can attach a first name).
 *   2. Add that subscriber to the sequence, which starts the drip.
 *
 * The API key is read from env and used server-side only. Never ship it to the
 * browser.
 */
const KIT_API = "https://api.kit.com/v4";

/** Named Kit sequences, keyed the same way as the Resend sequences. */
export const KIT_SEQUENCE_IDS = {
  /** "EEC — 7 Job-Search Mistakes in the AI Era (7-day + AI bonus)" */
  aiEra: 2833140,
} as const;

export type KitSequence = keyof typeof KIT_SEQUENCE_IDS;

/** Sequence every landing-page signup is enrolled into, overridable via env. */
export function defaultKitSequenceId(): number {
  const fromEnv = process.env.KIT_SEQUENCE_ID;
  const parsed = fromEnv ? Number(fromEnv) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : KIT_SEQUENCE_IDS.aiEra;
}

function headers(apiKey: string) {
  return {
    "X-Kit-Api-Key": apiKey,
    "Content-Type": "application/json",
  };
}

async function kitFetch(
  path: string,
  apiKey: string,
  body: unknown
): Promise<Response> {
  return fetch(`${KIT_API}${path}`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

/**
 * Create-or-update the subscriber, then add them to the sequence.
 * Idempotent: re-running for the same email is a no-op on Kit's side.
 */
export async function enrollInKitSequence(
  email: string,
  opts: { firstName?: string | null; sequenceId?: number } = {}
): Promise<void> {
  const apiKey = process.env.KIT_API_KEY;
  if (!apiKey) throw new Error("KIT_API_KEY is not set");

  const sequenceId = opts.sequenceId ?? defaultKitSequenceId();

  // 1. Upsert the subscriber. Kit returns 200 for existing addresses.
  const createRes = await kitFetch("/subscribers", apiKey, {
    email_address: email,
    first_name: opts.firstName || undefined,
    state: "active",
  });
  if (!createRes.ok) {
    const detail = await createRes.text().catch(() => "");
    throw new Error(`Kit subscriber upsert failed (${createRes.status}): ${detail}`);
  }

  // 2. Start the drip.
  const addRes = await kitFetch(
    `/sequences/${sequenceId}/subscribers`,
    apiKey,
    { email_address: email }
  );
  if (!addRes.ok) {
    const detail = await addRes.text().catch(() => "");
    throw new Error(`Kit sequence enroll failed (${addRes.status}): ${detail}`);
  }
}
