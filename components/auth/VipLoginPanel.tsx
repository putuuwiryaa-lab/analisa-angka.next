"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, MessageCircle, Phone, X } from "lucide-react";
import { useAuth } from "./auth-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const WA_NUMBER = "6285119341538";

const FREE_FEATURES = [
  "Angka Ikut 2D Belakang: semua parameter",
  "BBFS 2D Belakang: semua parameter",
  "Angka Mati: semua parameter",
  "Jumlah Mati 2D Belakang: semua parameter",
  "Shio Mati 2D Belakang: semua parameter",
];

export function VipLoginPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { deviceId, displayCode, login } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const activationUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    `Halo, saya ingin aktivasi VIP Analisa Angka. Nomor WA saya ${phone || "..."}. Device Key saya ${displayCode}`,
  )}`;

  async function submitLogin() {
    if (!phone || !password || loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/account-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password, deviceId, displayCode }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || "Login VIP gagal");
      }

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
              <KeyRound size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary-soft">Login VIP</p>
              <h3 className="display mt-1 text-xl text-text">Nomor WA + Password</h3>
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

        <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/10 p-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-text-soft">Device Key</p>
          <p className="num mt-1 text-lg font-black tracking-[0.25em] text-text">{displayCode}</p>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-black uppercase tracking-wide text-text-soft">Akses Free tetap tersedia</p>
          {FREE_FEATURES.map((feature) => (
            <div key={feature} className="flex gap-2.5 rounded-2xl border border-border-soft bg-black/20 p-3">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-primary-soft" />
              <p className="text-xs font-semibold leading-relaxed text-text-muted">{feature}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
      }
