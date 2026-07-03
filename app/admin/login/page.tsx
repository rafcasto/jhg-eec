"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Login failed");
      }
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="admin-login">
      <form className="admin-login__card" onSubmit={onSubmit}>
        <img src="/assets/logo-jobhackers.png" alt="Job Hackers Global" className="admin-login__logo" />
        <h1>EEC Admin</h1>
        <p>Sign in to manage the A/B test and edit content.</p>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        {error && <div className="admin-login__error">{error}</div>}
      </form>
      <AdminLoginStyles />
    </div>
  );
}

function AdminLoginStyles() {
  return (
    <style>{`
      .admin-login {
        min-height: 100vh; display: flex; align-items: center; justify-content: center;
        background: var(--jh-ink); padding: 24px;
      }
      .admin-login__card {
        background: #fff; border-radius: 18px; padding: 36px; width: 100%; max-width: 380px;
        box-shadow: 0 20px 60px rgba(0,0,0,.4); display: flex; flex-direction: column; gap: 12px;
        text-align: center;
      }
      .admin-login__logo { height: 30px; width: auto; margin: 0 auto 6px; }
      .admin-login__card h1 { font-family: var(--font-display); font-size: 26px; margin: 0; }
      .admin-login__card p { font-size: 14px; color: var(--fg-3); margin: 0 0 8px; }
      .admin-login__card input {
        font-family: var(--font-body); font-size: 15px; padding: 12px 14px;
        border: 1.5px solid var(--jh-line-2); border-radius: 10px; outline: none;
      }
      .admin-login__card input:focus { border-color: var(--jh-red); box-shadow: 0 0 0 4px rgba(194,0,31,.12); }
      .admin-login__card button {
        font-family: var(--font-display); font-weight: 600; font-size: 15px; color: #fff;
        background: var(--jh-red); border: 0; border-radius: 10px; padding: 13px; cursor: pointer;
      }
      .admin-login__card button:disabled { opacity: .6; }
      .admin-login__error { color: var(--jh-red); font-size: 13px; }
    `}</style>
  );
}
