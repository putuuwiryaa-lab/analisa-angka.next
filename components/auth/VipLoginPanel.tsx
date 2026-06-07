"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, LogOut, MessageCircle, Phone, ShieldCheck, UserRoundCheck, X } from "lucide-react";
import { useAuth } from "./auth-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const WA_NUMBER = "6285119341538";
const PENALTY_UNTIL_KEY = "vip_penalty_until";
const PENALTY_MESSAGE_KEY = "vip_penalty_message";
const DEFAULT_PENALTY_MESSAGE =
  "Akses VIP akun ini sedang dikunci sementara karena terlalu banyak pergantian sesi dalam 24 jam. Silakan coba kembali setelah masa kunci berakhir. Jika Anda merasa ini terjadi karena kesalahan, hubungi admin.";

const FREE_FEATURES = [
  "Angka Ikut 2D Belakang: semua parameter",
  "Angka Mati: semua parameter",
  "Menu dan fitur VIP tetap terlihat, tetapi akses penuh tersedia untuk akun VIP",
];

type PenaltyState = {
  message: string;
  until?: string | null;
};

function formatPenaltyTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStoredPenalty(): PenaltyState | null {
  if (typeof window === "undefined") return null;
  const until = localStorage.getItem(PENALTY_UNTIL_KEY) || "";
  const message = localStorage.getItem(PENALTY_MESSAGE_KEY) || DEFAULT_PENALTY_MESSAGE;
  if (!until) return null;

  if (new Date(until).getTime() <= Date.now()) {
    localStorage.removeItem(PENALTY_UNTIL_KEY);
    localStorage.removeItem(PENALTY_MESSAGE_KEY);
    return null;
  }

  return { message, until };
}

export function VipLoginPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { role, login, logout } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [penalty, setPenalty] = useState<PenaltyState | null>(null);

  const isVip = role === "PRO" || role === "MASTER";

  useEffect(() => {
    if (open) setPenalty(getStoredPenalty());
  }, [open]);

  if (!open) return null;

  const activationUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    `Halo, saya ingin aktivasi VIP Analisa Angka. Nomor WA saya ${phone || "..."}`,
  )}`;
  const adminUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    "Halo Admin, saya pengguna VIP Analisa Angka. Saya ingin request fitur / melaporkan kendala.",
  )}`;

  function storePenalty(nextPenalty: PenaltyState) {
    setPenalty(nextPenalty);
    if (nextPenalty.until) localStorage.setItem(PENALTY_UNTIL_KEY, nextPenalty.until);
    localStorage.setItem(PENALTY_MESSAGE_KEY, nextPenalty.message);
  }

  async function submitLogin() {
    if (!phone || !password || loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/account-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });

      const json = await response.json();

      if (response.status === 423) {
        storePenalty({
          message: json.error || DEFAULT_PENALTY_MESSAGE,
          until: json.penalty_until || null,
        });
        setPassword("");
        return;
      }

      if (!response.ok || !json.success) {
        throw new Error(json.error || "Login VIP gagal");
      }

      localStorage.removeItem(PENALTY_UNTIL_KEY);
      localStorage.removeItem(PENALTY_MESSAGE_KEY);
      login(json.role, json.token);
      setPassword("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login VIP gagal");
    }

    setLoading(false);
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="animate-soft-pop max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl border border-border-soft bg-surface p-5 sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="depth-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-primary-soft">
              {isVip ? <UserRoundCheck size={18} /> : penalty ? <AlertTriangle size={18} /> : <KeyRound size={18} />}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary-soft">{isVip ? "Akun VIP" : penalty ? "Akses Dikunci" : "Login VIP"}</p>
              <h3 className="display mt-1 text-xl text-text">{isVip ? "VIP Aktif" : penalty ? "Kunci Sementara" : "Nomor WA + Password"}</h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="pressable rounded-full border border-border-soft bg-white/[0.04] p-2 text-text-muted hover:border-border hover:text-text"
            aria-label="Tutup login VIP"
          >
            <X size={16} />
          </button>
        </div>

        {isVip ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-primary/25 bg-primary/10 p-4 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary-soft">
                <ShieldCheck size={22} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-wide text-primary-soft">{role}</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-text-muted">
                Akun Anda sudah aktif sebagai VIP. Semua fitur analisa dapat digunakan tanpa batasan akses Free.
              </p>
            </div>

            <p className="rounded-3xl border border-border-soft bg-black/20 p-4 text-sm font-medium leading-relaxed text-text-muted">
              Terima kasih telah mendukung layanan ini. Dukungan Anda membantu menjaga performa server dan keberlanjutan pengembangan fitur.
              <br />
              <br />
              Jika ingin request fitur baru atau menemukan kendala, silakan hubungi admin.
            </p>

            <a href={adminUrl} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="w-full whitespace-nowrap">
                <MessageCircle size={16} /> Kontak Admin
              </Button>
            </a>
            <Button variant="ghost" size="lg" className="w-full" onClick={logout}>
              <LogOut size={16} /> Keluar VIP
            </Button>
          </div>
        ) : penalty ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-danger/25 bg-danger/10 p-4 text-center text-danger">
              <AlertTriangle className="mx-auto mb-3" size={24} />
              <p className="text-sm font-bold leading-relaxed">{penalty.message}</p>
              {penalty.until && (
                <p className="mt-3 rounded-2xl border border-danger/20 bg-black/15 p-3 text-xs font-black uppercase tracking-wide">
                  Coba kembali setelah: {formatPenaltyTime(penalty.until)}
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            {error && (
              <p className="animate-soft-pop mb-4 rounded-2xl border border-danger/25 bg-danger/10 p-3 text-center text-xs font-bold text-danger">
                {error}
              </p>
            )}

            <div className="space-y-3">
              <div>
                <label className="mb-2 ml-1 block text-xs font-bold uppercase tracking-wide text-text-muted">
                  Nomor WhatsApp
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-soft" />
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    placeholder="081234567890"
                    className="pl-11"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 ml-1 block text-xs font-bold uppercase tracking-wide text-text-muted">
                  Password VIP
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-soft" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitLogin()}
                    placeholder="Password dari admin"
                    className="pl-11"
                  />
                </div>
              </div>
            </div>

            <Button onClick={submitLogin} disabled={loading || !phone || !password} size="lg" className="mt-5 w-full">
              {loading ? "Memverifikasi…" : "Masuk VIP"}
            </Button>

            <a href={activationUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="lg" className="mt-3 w-full whitespace-nowrap">
                <MessageCircle size={16} /> Aktivasi via WhatsApp
              </Button>
            </a>

            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wide text-text-soft">Akses Free tetap tersedia</p>
              {FREE_FEATURES.map((feature) => (
                <div key={feature} className="flex gap-2.5 rounded-2xl border border-border-soft bg-black/20 p-3">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-primary-soft" />
                  <p className="text-xs font-semibold leading-relaxed text-text-muted">{feature}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
