"use client";

import { FormEvent, useState } from "react";

const DEVICE_KEY = "analisa_device_id";
const ADMIN_CONTACT_URL = process.env.NEXT_PUBLIC_ADMIN_CONTACT_URL || "";

function getDeviceId() {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;

  const next = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  window.localStorage.setItem(DEVICE_KEY, next);
  return next;
}

function deviceName() {
  if (typeof navigator === "undefined") return "Unknown Device";
  return navigator.userAgent.slice(0, 150);
}

function safeNextPath() {
  if (typeof window === "undefined") return "/";

  const params = new URLSearchParams(window.location.search);
  const next = params.get("next") || "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function AdminContactLink() {
  if (!ADMIN_CONTACT_URL) {
    return <p className="text-center text-xs font-bold text-text-muted">Belum punya kode akses? Hubungi admin.</p>;
  }

  return (
    <div className="text-center">
      <p className="text-xs font-bold text-text-muted">Belum punya kode akses?</p>
      <a
        href={ADMIN_CONTACT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center justify-center rounded-2xl border border-border px-4 py-3 text-xs font-black uppercase tracking-wide text-text transition hover:border-accent hover:text-accent"
      >
        Hubungi Admin
      </a>
    </div>
  );
}

export default function PinPage() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const clean = pin.replace(/\D/g, "").slice(0, 8);
    if (clean.length !== 8) {
      setError("Kode akses harus 8 digit.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/pin/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: clean, device_id: getDeviceId(), device_name: deviceName() }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        setError(data.error || "Kode akses tidak bisa digunakan.");
        return;
      }

      window.location.replace(safeNextPath());
    } catch {
      setError("Gagal memeriksa kode akses.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-[100svh] items-start justify-center px-4 pb-8 pt-10 sm:pt-14">
      <section className="w-full max-w-md rounded-[2rem] border border-border bg-surface p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-accent">Akses Aplikasi</p>
          <h1 className="mt-3 text-3xl font-black text-text">Masuk Analisa Angka</h1>
          <p className="mt-2 text-sm font-semibold text-text-muted">Masukkan kode akses 8 digit dari admin.</p>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="pin" className="mb-2 block text-xs font-black uppercase tracking-wide text-text-muted">
              Kode Akses
            </label>
            <input
              id="pin"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="0000-0000"
              value={pin}
              maxLength={9}
              onChange={(event) => {
                const clean = event.target.value.replace(/\D/g, "").slice(0, 8);
                const formatted = clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
                setPin(formatted);
              }}
              className="w-full rounded-2xl border border-border bg-bg px-4 py-4 text-center text-2xl font-black tracking-[0.18em] text-text outline-none transition focus:border-accent"
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
            {loading ? "Memeriksa Kode..." : "Lanjutkan"}
          </button>
        </form>

        <div className="mt-5 border-t border-border pt-5">
          <AdminContactLink />
        </div>
      </section>
    </main>
  );
}
