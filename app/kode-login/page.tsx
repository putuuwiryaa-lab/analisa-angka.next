"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Loader2, Send, ShieldCheck } from "lucide-react";

const TELEGRAM_BOT_URL = "https://t.me/analisaangka_bot";

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

  localStorage.setItem("aa_token", json.token);
  localStorage.setItem("aa_role", json.role || "TRIAL");
  localStorage.setItem("aa_expires_at", json.expires_at || "");
  localStorage.setItem("aa_telegram_user_id", String(json.telegram_user_id || ""));
}

export default function KodeLoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LoginResponse | null>(null);

  const cleanCode = useMemo(() => code.replace(/\D/g, "").slice(0, 6), [code]);
  const isComplete = cleanCode.length === 6;

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setCode(cleanCode);
    setResult(null);

    if (!isComplete) {
      setResult({ success: false, error: "Masukkan 6 digit kode dari Telegram." });
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
        setResult(json);

        window.setTimeout(() => {
          const params = new URLSearchParams(window.location.search);
          const from = params.get("from") || "/";
          router.replace(from.startsWith("/") ? from : "/");
        }, 900);

        return;
      }

      setResult(json);
    } catch {
      setResult({ success: false, error: "Tidak bisa tersambung. Coba lagi sebentar." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative -mx-4 -my-4 flex min-h-[100svh] flex-col justify-center overflow-hidden px-4 py-6 sm:-mx-6">
      <div className="pointer-events-none absolute inset-x-0 top-[-20%] h-[42%] rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-16%] right-[-30%] h-[38%] w-[80%] rounded-full bg-cyan-400/10 blur-3xl" />

      <section className="relative mx-auto w-full max-w-[420px]">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.45rem] border border-primary/35 bg-primary/15 shadow-[0_0_42px_rgba(124,58,237,0.22)]">
            <ShieldCheck className="text-accent" size={30} strokeWidth={2.7} />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-accent">Analisa Angka</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-text">Masuk Aplikasi</h1>
          <p className="mx-auto mt-3 max-w-xs text-sm font-semibold leading-6 text-text-muted">
            Gunakan kode dari bot Telegram untuk membuka akses teman teman.
          </p>
        </div>

        <div className="depth-1 rounded-[2rem] border bg-bg-deep/60 p-5 backdrop-blur-xl">
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable mb-4 flex h-13 min-h-13 items-center justify-center gap-2 rounded-[1.35rem] border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-100"
          >
            <Send size={18} />
            Buka Bot Telegram
            <ExternalLink size={16} />
          </a>

          <div className="mb-4 rounded-[1.35rem] border border-border-soft bg-white/[0.025] p-4">
            <p className="mb-3 text-xs font-black uppercase tracking-wide text-text-muted">Cara mendapatkan kode</p>
            <div className="space-y-3 text-sm font-bold leading-5 text-text-muted">
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-soft text-[11px] text-text">1</span>
                <p>Buka bot Telegram Analisa Angka.</p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-soft text-[11px] text-text">2</span>
                <p>
                  Kirim perintah <span className="font-black text-text">/kode</span>.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-soft text-[11px] text-text">3</span>
                <p>Salin 6 digit kode, lalu masukkan di bawah.</p>
              </div>
            </div>
          </div>

          <form onSubmit={submitLogin} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-text-muted">Masukkan Kode</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={cleanCode}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                className="depth-2 h-[4.7rem] w-full rounded-[1.55rem] border bg-black/10 text-center text-[2rem] font-black tracking-[0.42em] text-text outline-none transition placeholder:tracking-[0.25em] placeholder:text-text-soft focus:border-border-strong focus:bg-white/[0.035]"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="pressable depth-3 flex h-14 w-full items-center justify-center gap-2 rounded-[1.45rem] border bg-white/[0.07] text-sm font-black uppercase tracking-wide text-text disabled:opacity-60"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "Memeriksa" : "Masuk"}
            </button>
          </form>

          {result && (
            <div
              className={`mt-4 rounded-[1.35rem] border p-4 text-sm font-bold leading-6 ${
                result.success
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                  : "border-danger/30 bg-danger/10 text-danger"
              }`}
            >
              {result.success ? (
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 shrink-0" size={20} />
                  <div>
                    <p className="font-black">Berhasil masuk.</p>
                    <p>Status akses: {result.role}</p>
                    <p>Berlaku sampai: {formatDate(result.expires_at)}</p>
                    <p className="mt-2 text-xs opacity-80">Membuka aplikasi...</p>
                  </div>
                </div>
              ) : (
                <p>{result.error || "Kode belum bisa digunakan."}</p>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
