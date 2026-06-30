/**
 * Server-side enrollment into the Job Hackers Resend sequences.
 *
 * Two sequences are live in Resend as event-triggered Automations. To enroll a
 * user we fire that sequence's trigger event; Resend then drips the emails.
 * Firing the event *is* the enrollment — there is no "add to list" step.
 *
 * The API key is read from env and used server-side only. Never ship it to the
 * browser.
 */
const EVENTS = {
  kickstarter: "jobhacker.kickstarter.subscribed",
  repairkit: "jobhacker.repairkit.subscribed",
} as const;

export type Sequence = keyof typeof EVENTS;

export const AUTOMATION_IDS: Record<Sequence, string> = {
  kickstarter: "019f1814-16f3-76c2-83f7-bcda28a28dbf",
  repairkit: "019f1824-13a8-729f-8e39-68c441f22428",
};

export async function enrollInSequence(
  email: string,
  sequence: Sequence
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const res = await fetch("https://api.resend.com/events/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event: EVENTS[sequence], email }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend enroll failed (${res.status}): ${detail}`);
  }
}
