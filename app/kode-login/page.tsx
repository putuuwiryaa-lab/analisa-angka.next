"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Loader2, MessageCircle, Send } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/components/auth/auth-context";
import { getDeviceId } from "@/lib/auth/device";

const TELEGRAM_BOT_URL = "https://t.me/analisaangka_bot";
const ADMIN_WA_NUMBER = "6285119341538";
const ADMIN_CONTACT_URL = `https://wa.me/${ADMIN_WA_NUMBER}?text=${encodeURIComponent(
  "Halo admin, saya butuh bantuan login Analisa Angka.",
)}`;

type LoginResponse = {
  success?: boolean;
  error?: string;
  role?: string;
  token?: string;
  telegram_user_id?: number;
  expires_at?: string;
  session_id?: string;
  device_bound?: boolean;
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
  const { login } = useAuth();
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
        body: JSON.stringify({ code: cleanCode, device_id: getDeviceId() }),
      });

      const json = (await response.json().catch(() => ({}))) as LoginResponse;

      if (json.success && json.token) {
        saveAuth(json);
        login(json.role || "TRIAL", json.token);
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
    <main className="relative -mx-4 -my-4 flex min-h-[100svh] flex-col items-center overflow-hidden px-4 pb-6 pt-7 sm:-mx-6 sm:pt-10">
      <div className="pointer-events-none absolute inset-x-0 top-[-20%] h-[42%] rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-16%] right-[-30%] h-[38%] w-[80%] rounded-full bg-cyan-400/10 blur-3xl" />

      <section className="relative mx-auto w-full max-w-[420px]">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.45rem] border border-primary/35 bg-primary/15 shadow-[0_0_42px_rgba(124,58,237,0.22)]">
            <Logo className="h-9 w-9" />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-accent">Analisa Angka</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-text">Masuk Aplikasi</h1>
          <p className="mx-auto mt-3 max-w-xs text-sm font-semibold leading-6 text-text-muted">
            Gunakan kode dari bot Telegram untuk membuka akses.
          </p>
        </div>

        <div className="depth-1 rounded-[2rem] border bg-bg-deep/60 p-5 backdrop-blur-xl">
          <div className="mb-3 rounded-[1.2rem] border border-cyan-300/25 bg-cyan-300/10 p-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100">Langkah pertama</p>
            <p className="mt-1 text-xs font-bold leading-5 text-cyan-100/80">
              Buka Telegram untuk mengambil kode login.
            </p>
          </div>

          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable relative flex min-h-[4.25rem] items-center justify-center gap-3 overflow-hidden rounded-[1.55rem] border border-cyan-200/50 bg-cyan-300/20 px-4 py-4 text-base font-black text-cyan-50 shadow-[0_0_34px_rgba(34,211,238,0.24)] ring-2 ring-cyan-300/20 animate-pulse"
          >
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-100/30 bg-cyan-300/20">
              <Send size={19} />
            </span>
            <span className="relative flex min-w-0 flex-col items-start leading-tight">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-100/80">Buka Telegram</span>
              <span className="text-base font-black">Ambil Kode Login</span>
            </span>
            <ExternalLink className="relative shrink-0" size={17} />
          </a>

          <a
            href={ADMIN_CONTACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable mt-3 flex min-h-12 items-center justify-center gap-2 rounded-[1.35rem] border border-border-soft bg-white/[0.035] px-4 py-3 text-xs font-black uppercase tracking-wide text-text-muted hover:border-border hover:bg-white/[0.06] hover:text-text"
          >
            <MessageCircle size={16} />
            Hubungi Admin
            <ExternalLink size={14} />
          </a>

          <div className="my-4 rounded-[1.35rem] border border-border-soft bg-white/[0.025] p-4">
            <p className="mb-3 text-xs font-black uppercase tracking-wide text-text-muted">Cara mendapatkan kode</p>
            <div className="space-y-3 text-sm font-bold leading-5 text-text-muted">
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-soft text-[11px] text-text">1</span>
                <p>Buka Telegram.</p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-soft text-[11px] text-text">2</span>
                <p>
                  Kirim perintah <span className="font-black text-text">/kode</span> di bot.
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
