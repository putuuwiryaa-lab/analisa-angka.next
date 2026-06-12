"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type LoginResponse = {
  success?: boolean;
  error?: string;
  role?: string;
  token?: string;
  telegram_user_id?: number;
  expires_at?: string;
  session_id?: string;
};

function formatDate(value?: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Makassar",
  }).format(new Date(value));
}

function saveAuth(json: LoginResponse) {
  if (!json.token) return;

  const role = json.role || "TRIAL";
  const expiresAt = json.expires_at || "";
  const telegramUserId = String(json.telegram_user_id || "");

  localStorage.setItem("aa_token", json.token);
  localStorage.setItem("aa_role", role);
  localStorage.setItem("aa_expires_at", expiresAt);
  localStorage.setItem("aa_telegram_user_id", telegramUserId);

  // Key lama ikut diisi agar komponen lama yang masih membaca supreme_* tetap jalan.
  localStorage.setItem("supreme_token", json.token);
  localStorage.setItem("supreme_role", role);
}

export default function KodeLoginPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LoginResponse | null>(null);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanCode = code.replace(/\D/g, "").slice(0, 6);
    setCode(cleanCode);
    setResult(null);

    if (cleanCode.length !== 6) {
      setResult({ success: false, error: "Kode login harus 6 digit." });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/code-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode }),
      });

      const json = (await response.json().catch(() => ({}))) as LoginResponse;

      if (json.success && json.token) {
        saveAuth(json);
      }

      setResult(json);
    } catch {
      setResult({ success: false, error: "Gagal menghubungi server." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100svh-8rem)] w-full max-w-md flex-col justify-center px-4 py-8">
      <section className="depth-1 rounded-[2rem] border p-5">
        <div className="mb-5 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-accent">Analisa Angka</p>
          <h1 className="mt-2 text-2xl font-black text-text">Login Kode Telegram</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-text-muted">
            Ambil kode dari bot Telegram, lalu masukkan 6 digit kode di bawah.
          </p>
        </div>

        <form onSubmit={submitLogin} className="space-y-4">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="depth-2 h-16 w-full rounded-3xl border bg-transparent text-center text-3xl font-black tracking-[0.35em] text-text outline-none transition focus:border-border-strong"
          />

          <button
            type="submit"
            disabled={loading}
            className="pressable depth-3 h-14 w-full rounded-3xl border bg-white/[0.06] text-sm font-black uppercase tracking-wide text-text disabled:opacity-60"
          >
            {loading ? "Memeriksa..." : "Masuk"}
          </button>
        </form>

        <div className="mt-4 rounded-3xl border border-dashed p-4 text-xs font-bold leading-6 text-text-muted">
          <p>Belum punya kode?</p>
          <p>
            Buka Telegram lalu kirim <span className="text-text">/kode</span> ke bot.
          </p>
        </div>

        {result && (
          <div
            className={`mt-4 rounded-3xl border p-4 text-sm font-bold leading-6 ${
              result.success ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-danger/30 bg-danger/10 text-danger"
            }`}
          >
            {result.success ? (
              <div>
                <p className="text-base font-black">Login berhasil.</p>
                <p>Status: {result.role}</p>
                <p>ID Telegram: {result.telegram_user_id}</p>
                <p>Akses sampai: {formatDate(result.expires_at)}</p>
                <Link href="/" className="mt-3 inline-block underline">
                  Lanjut ke dashboard
                </Link>
              </div>
            ) : (
              <p>{result.error || "Login gagal."}</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
