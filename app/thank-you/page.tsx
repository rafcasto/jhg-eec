import type { Metadata } from "next";
import { readConfig } from "@/lib/abConfig";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "You're in! — Job Hackers Global",
  robots: { index: false, follow: false },
};

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const config = await readConfig();
  const key = searchParams.v === "B" ? "B" : "A";
  const c = config.variants[key].content;

  return (
    <main className="ty">
      <section className="ty-card">
        <div className="ty-check" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none">
            <path
              d="M5 12.5l4.2 4.2L19 7"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1>{c.successHeadline}</h1>
        <p className="ty-body">{c.successBody}</p>

        <ol className="ty-steps">
          <li>
            <b>Open your inbox.</b> Your first email is on its way right now.
          </li>
          <li>
            <b>Check spam &amp; promotions.</b> If it&apos;s not there in a
            minute, peek in those folders and mark it &quot;not spam&quot;.
          </li>
          <li>
            <b>Whitelist us</b> so every lesson lands where you&apos;ll see it.
          </li>
        </ol>

        <a className="ty-btn" href="/">
          ← Back to the course page
        </a>
      </section>

      <footer className="ty-footer">
        <img src="/assets/logo-jobhackers.png" alt="Job Hackers Global" />
        <div>© {new Date().getFullYear()} Job Hackers Global. All rights reserved.</div>
      </footer>
    </main>
  );
}
