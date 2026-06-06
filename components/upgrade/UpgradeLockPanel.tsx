"use client";

import { Lock, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/auth/auth-context";

const WA_NUMBER = "6285119341538";

export function UpgradeLockPanel({
  open,
  onClose,
  onOpenPin,
  title = "Akses VIP",
}: {
  open: boolean;
  onClose: () => void;
  onOpenPin: () => void;
  title?: string;
}) {
  const { displayCode } = useAuth();

  if (!open) return null;

  const activationUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    `Halo, saya ingin aktivasi VIP Analisa Angka. Device Key saya ${displayCode}`,
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0">
      <div className="animate-rise depth-1 w-full max-w-sm rounded-3xl border bg-surface p-5 shadow-2xl shadow-black/30">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="depth-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-primary-soft">
              <Lock size={18} />
            </div>
            <div>
              <p className="display text-sm text-text">{title}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-primary-soft">VIP</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pressable rounded-full border border-border-soft bg-white/[0.04] p-2 text-text-muted hover:border-border hover:text-text"
            aria-label="Tutup panel upgrade"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-sm font-medium leading-relaxed text-text-muted">
          Fitur ini dibatasi untuk pengguna Free agar performa server tetap stabil dan akses analisa tetap lancar. Masukkan PIN VIP untuk membuka fitur ini.
        </p>

        <div className="mt-5 grid gap-3">
          <a href={activationUrl} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="w-full whitespace-nowrap">
              <MessageCircle size={16} /> Aktivasi via WhatsApp
            </Button>
          </a>
          <Button variant="ghost" size="lg" className="w-full" onClick={onOpenPin}>
            Masukkan PIN
          </Button>
        </div>
      </div>
    </div>
  );
}
