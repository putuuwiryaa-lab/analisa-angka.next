"use client";

import { useState } from "react";
import { KeyRound, Lock, MessageCircle } from "lucide-react";
import { useAuth } from "./auth-context";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const WA_NUMBER = "6285119341538";

function getTrialFingerprint() {
  return {
    userAgent: navigator.userAgent || "",
    platform: navigator.platform || "",
    language: navigator.language || "",
    languages: Array.isArray(navigator.languages) ? navigator.languages.join(",") : "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    screen: `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
    availScreen: `${window.screen.availWidth}x${window.screen.availHeight}`,
    pixelRatio: String(window.devicePixelRatio || ""),
    hardwareConcurrency: String(navigator.hardwareConcurrency || ""),
    deviceMemory: String((navigator as Navigator & { deviceMemory?: number }).deviceMemory || ""),
    maxTouchPoints: String(navigator.maxTouchPoints || 0),
    vendor: navigator.vendor || "",
  };
}

export function LoginGate() {
  const { deviceId, displayCode, login } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const activationUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    `Halo, saya ingin aktivasi VIP Analisa Angka. Device Key saya ${displayCode}`,
  )}`;

  async function startTrial() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, displayCode, fingerprint: getTrialFingerprint() }),
      });
      const json = await res.json();
      if (json.success) login(json.role, json.token);
      else setError(json.error || "Trial tidak bisa diaktifkan");
    } catch {
      setError("Koneksi server gagal");
    }
    setLoading(false);
  }

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
        {/* Header */}
        <div className="mb-5 rounded-3xl border border-border bg-white/[0.05] p-6 text-center backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-3xl border border-border bg-primary/20">
            <Logo className="h-12 w-12" />
          </div>
          <h1 className="display text-3xl text-text">Analisa Angka</h1>
          <p className="mt-3 text-sm text-text-muted">
            Mulai trial gratis atau masuk dengan PIN VIP.
          </p>
        </div>

        {/* Panel */}
        <div className="rounded-3xl border border-border-soft bg-surface p-5 sm:p-6">
          {/* Device key */}
          <div className="mb-5 rounded-2xl border border-border-soft bg-black/25 p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
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
            <p className="mb-4 rounded-2xl border border-danger/25 bg-danger/10 p-3 text-center text-xs font-bold text-danger">
              {error}
            </p>
          )}

          {!showPin ? (
            <div className="space-y-3">
              <Button
                onClick={startTrial}
                disabled={loading || !deviceId || !displayCode}
                size="lg"
                className="w-full"
              >
                {loading ? "Mengaktifkan…" : "Mulai Trial Gratis"}
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="w-full"
                onClick={() => {
                  setError("");
                  setShowPin(true);
                }}
              >
                Saya Punya PIN VIP
              </Button>
              <a href={activationUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="lg" className="w-full">
                  <MessageCircle size={16} /> Hubungi Admin
                </Button>
              </a>
            </div>
          ) : (
            <div className="space-y-4">
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
              <Button
                onClick={submitPin}
                disabled={loading || !pin}
                size="lg"
                className="w-full"
              >
                {loading ? "Memverifikasi…" : "Buka Akses VIP"}
              </Button>
              <div className="grid gap-3 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setError("");
                    setShowPin(false);
                  }}
                >
                  Kembali ke Trial Gratis
                </Button>
                <a
                  href={activationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-primary-soft underline underline-offset-4"
                >
                  Hubungi Admin untuk Aktivasi VIP
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
