"use client";

import { FormEvent, useState } from "react";

function safeNextPath() {
  if (typeof window === "undefined") return "/admin";

  const params = new URLSearchParams(window.location.search);
  const next = params.get("next") || "/admin";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
}

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        setError(data.error || "Login admin gagal.");
        return;
      }

      window.location.replace(safeNextPath());
    } catch {
      setError("Login admin gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-[100svh] items-center justify-center px-4 py-8">
      <section className="w-full max-w-md rounded-[2rem] border border-border bg-surface p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-accent">Admin</p>
          <h1 className="mt-3 text-3xl font-black text-text">Login Admin</h1>
          <p className="mt-2 text-sm font-semibold text-text-muted">Masukkan password admin untuk mengelola PIN dan akses device.</p>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="password" className="mb-2 block text-xs font-black uppercase tracking-wide text-text-muted">
              Password Admin
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-border bg-bg px-4 py-4 text-center text-lg font-bold tracking-wide text-text outline-none transition focus:border-accent"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-center text-sm font-bold text-danger">
              {error}
            </div>
          ) : null}

          <button
            className="w-full rounded-2xl bg-accent px-4 py-4 text-sm font-black uppercase tracking-wide text-bg transition disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? "Memeriksa..." : "Masuk Admin"}
          </button>
        </form>
      </section>
    </main>
  );
}
