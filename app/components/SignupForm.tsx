"use client";

import { useState } from "react";

interface Props {
  variant: "A" | "B";
  ctaButton: string;
  emailPlaceholder: string;
  successHeadline: string;
  successBody: string;
  /** A unique id so multiple forms on the page don't collide. */
  formId: string;
}

export default function SignupForm({
  variant,
  ctaButton,
  emailPlaceholder,
  successHeadline,
  successBody,
  formId,
}: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setError("");

    // Capture source from the query string; the server falls back to "direct".
    let source: string | null = null;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      source =
        params.get("source") ||
        params.get("utm_source") ||
        params.get("ref") ||
        null;
    }

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, variant, source }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Please try again.");
    }
  }

  if (status === "done") {
    return (
      <div className="signup">
        <div className="success">
          <h3>{successHeadline}</h3>
          <p>{successBody}</p>
        </div>
      </div>
    );
  }

  return (
    <form className="signup" onSubmit={onSubmit}>
      <label htmlFor={`email-${formId}`} style={{ display: "none" }}>
        Email
      </label>
      <input
        id={`email-${formId}`}
        type="email"
        required
        placeholder={emailPlaceholder}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <button className="btn-cta" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Sending…" : ctaButton}
      </button>
      {status === "error" && <p className="form-msg error">{error}</p>}
    </form>
  );
}
