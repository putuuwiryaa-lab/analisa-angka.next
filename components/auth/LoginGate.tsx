"use client";

import { useState } from "react";
import { KeyRound, Lock, MessageCircle } from "lucide-react";
import { useAuth } from "./auth-context";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const WA_NUMBER = "6285119341538";

export function LoginGate() {
  const { deviceId, displayCode, login } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const activationUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    `Halo, saya ingin aktivasi VIP Analisa Angka. Device Key saya ${displayCode}`,
  )}`;

  async function submitPin() {
    if (!pin) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, deviceId, displayCode }),
      });
      const json = await res.json();
      if (json.success) login(json.role, json.token);
      else setError(json.error || "PIN salah");
    } catch {
      setError("Koneksi server gagal");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start px-5 pb-8 pt-[calc(2rem+env(safe-area-inset-top))] sm:pt-12">
      <div className="w-full max-w-sm animate-rise">
        <div className="animate-soft-pop mb-5 rounded-3xl border border-border bg-white/[0.055] p-6 text-center shadow-xl shadow-black/10 backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-3xl border border-border bg-primary/18 shadow-[0_0_30px_rgba(124,77,255,0.18)]">
            <Logo className="h-12 w-12" />
          </div>
          <h1 className="display text-3xl uppercase text-text">ANALISA ANGKA</h1>
          <p className="mt-3 text-sm text-text-muted">Prediksi berbasis matematis.</p>
        </div>

        <div className="animate-soft-pop rounded-3xl border border-border-soft bg-surface p-5 shadow-xl shadow-black/10 sm:p-6">
          <div className="mb-5 rounded-3xl border border-border-soft bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/12 text-accent">
                <KeyRound size={18} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-text-soft">Device Key</p>
                <p className="mt-0.5 text-xs text-text-muted">Kode perangkat untuk aktivasi VIP</p>
              </div>
            </div>
            <p className="num text-3xl font-black tracking-[0.3em] text-text">{displayCode}</p>
          </div>

          {error && (
            <p className="animate-soft-pop mb-4 rounded-2xl border border-danger/25 bg-danger/10 p-3 text-center text-xs font-bold text-danger">
              {error}
            </p>
          )}

          <div className="animate-rise space-y-4">
            <div>
              <label className="mb-2 ml-1 block text-xs font-bold uppercase tracking-wide text-text-muted">
                PIN VIP / MASTER
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-soft" />
                <Input
                  type="password"
                  value={pin}
                  autoFocus
                  inputMode="numeric"
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitPin()}
                  placeholder="••••••"
                  className="num h-14 pl-12 text-center text-2xl tracking-[0.5em]"
                />
              </div>
            </div>

            <Button onClick={submitPin} disabled={loading || !pin} size="lg" className="w-full">
              {loading ? "Memverifikasi…" : "Buka Akses VIP"}
            </Button>

            <a href={activationUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="lg" className="w-full">
                <MessageCircle size={16} /> Hubungi Admin untuk Aktivasi
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
