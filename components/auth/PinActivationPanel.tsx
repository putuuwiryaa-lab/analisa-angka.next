"use client";

import { useState } from "react";
import { KeyRound, Lock, X } from "lucide-react";
import { useAuth } from "./auth-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function PinActivationPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { deviceId, displayCode, login } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function submitPin() {
    if (!pin || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, deviceId, displayCode }),
      });
      const json = await res.json();
      if (json.success) {
        login(json.role, json.token);
        setPin("");
        onClose();
      } else {
        setError(json.error || "PIN salah");
      }
    } catch {
      setError("Koneksi server gagal");
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0">
      <div className="animate-rise depth-1 w-full max-w-sm rounded-3xl border bg-surface p-5 shadow-2xl shadow-black/30">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="depth-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-primary-soft">
              <KeyRound size={18} />
            </div>
            <div>
              <p className="display text-sm text-text">Masukkan PIN</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-text-soft">Device Key {displayCode}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pressable rounded-full border border-border-soft bg-white/[0.04] p-2 text-text-muted hover:border-border hover:text-text"
            aria-label="Tutup panel PIN"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <p className="animate-soft-pop mb-4 rounded-2xl border border-danger/25 bg-danger/10 p-3 text-center text-xs font-bold text-danger">
            {error}
          </p>
        )}

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

        <Button onClick={submitPin} disabled={loading || !pin} size="lg" className="mt-5 w-full">
          {loading ? "Memverifikasi…" : "Buka Akses VIP"}
        </Button>
      </div>
    </div>
  );
}
