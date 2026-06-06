"use client";

import { type ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { BarChart3, CheckCircle2, Gift, KeyRound, MessageCircle } from "lucide-react";
import { PinActivationPanel } from "@/components/auth/PinActivationPanel";
import { useAuth } from "@/components/auth/auth-context";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

const WA_NUMBER = "6285119341538";

const FREE_FEATURES = [
  "Angka Ikut 2D Belakang: parameter 4 dan 6",
  "BBFS 2D Belakang: 9 digit",
  "Angka Mati: parameter 1",
  "Jumlah Mati Belakang: parameter 1",
  "Shio Mati Belakang: parameter 1",
  "Statistik pasaran terbuka penuh",
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [freeOpen, setFreeOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  // Halaman tanpa shell (header/nav disembunyikan), seperti perilaku lama.
  const hideShell = pathname.startsWith("/analyze/") || pathname === "/pantauan-rekap";

  function openPinPanel() {
    setFreeOpen(false);
    setPinOpen(true);
  }

  return (
    <div className={cnPad(hideShell)}>
      {!hideShell && <HeroHeader />}

      <main className="min-w-0 flex-1">{children}</main>

      {!hideShell && <BottomNav onOpenFree={() => setFreeOpen(true)} />}

      <FreeAccessPanel open={freeOpen} onClose={() => setFreeOpen(false)} onOpenPin={openPinPanel} />
      <PinActivationPanel open={pinOpen} onClose={() => setPinOpen(false)} />
    </div>
  );
}

function cnPad(hideShell: boolean) {
  return [
    "relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 sm:px-6",
    hideShell ? "pb-6 pt-4" : "pb-28 pt-4",
  ].join(" ");
}

function HeroHeader() {
  return (
    <header className="animate-fade-in mb-5 flex items-start justify-between gap-2 pt-3 sm:mb-6 sm:items-center sm:gap-4 sm:pt-4">
      <div className="min-w-0 flex-1 pr-1">
        <h1 className="display max-w-[11.5ch] whitespace-normal break-words text-[2.1rem] uppercase leading-[0.98] text-text sm:max-w-none sm:text-4xl">
          ANALISA ANGKA
        </h1>
        <p className="mt-2 text-sm font-medium leading-snug text-text-soft sm:text-base">
          Prediksi berbasis matematis
        </p>
      </div>
      <div className="animate-soft-pop relative mr-3 mt-1 flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-[1.7rem] border border-primary/45 bg-primary/18 shadow-[0_0_34px_rgba(124,58,237,0.30),0_0_54px_rgba(40,215,255,0.10)] sm:mr-0 sm:mt-0 sm:h-20 sm:w-20">
        <div className="pointer-events-none absolute inset-[-0.45rem] rounded-[2rem] bg-primary/10 blur-xl" />
        <Logo className="relative h-11 w-11 sm:h-12 sm:w-12" />
      </div>
    </header>
  );
}

function BottomNav({ onOpenFree }: { onOpenFree: () => void }) {
  return (
    <nav className="animate-fade-in fixed inset-x-0 bottom-0 z-40 border-t border-border-soft bg-bg-deep/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-2.5">
        <Link
          href="/pantauan-rekap"
          className="pressable flex h-15 flex-[1.45] items-center justify-center gap-2 rounded-2xl border border-emerald-400/35 bg-emerald-500/15 px-4 text-emerald-300 shadow-[0_0_28px_rgba(16,185,129,0.18)] hover:bg-emerald-500/20 hover:shadow-[0_0_34px_rgba(16,185,129,0.24)]"
          aria-label="Statistik Pasaran"
        >
          <BarChart3 size={21} />
          <span className="text-sm font-black uppercase tracking-wide">Statistik</span>
        </Link>
        <button
          type="button"
          onClick={onOpenFree}
          className="pressable animate-free-wiggle flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border border-primary/30 bg-primary/10 text-primary-soft hover:border-primary/50 hover:bg-primary/15"
          aria-label="Akses Free"
        >
          <Gift size={19} />
          <span className="text-xs font-semibold">FREE</span>
        </button>
      </div>
    </nav>
  );
}

function FreeAccessPanel({
  open,
  onClose,
  onOpenPin,
}: {
  open: boolean;
  onClose: () => void;
  onOpenPin: () => void;
}) {
  const { displayCode } = useAuth();

  if (!open) return null;

  const activationUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    `Halo, saya ingin aktivasi VIP Analisa Angka. Device Key saya ${displayCode}`,
  )}`;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="animate-soft-pop w-full max-w-sm rounded-t-3xl border border-border-soft bg-surface p-5 sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary-soft">Paket FREE</p>
            <h3 className="display mt-1 text-xl text-text">Akses Gratis</h3>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              Fitur yang bisa dipakai tanpa aktivasi VIP.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>

        <div className="space-y-2.5">
          {FREE_FEATURES.map((feature) => (
            <div key={feature} className="flex gap-2.5 rounded-2xl border border-border-soft bg-black/20 p-3">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary-soft" />
              <p className="text-xs font-semibold leading-relaxed text-text-muted">{feature}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-primary-soft">VIP membuka semua mode</p>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Aktivasi PIN untuk membuka semua mode dan parameter analisa.
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          <a href={activationUrl} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="w-full whitespace-nowrap">
              <MessageCircle size={16} /> Aktivasi via WhatsApp
            </Button>
          </a>
          <Button variant="ghost" size="lg" className="w-full" onClick={onOpenPin}>
            <KeyRound size={16} /> Masukkan PIN
          </Button>
        </div>
      </div>
    </div>
  );
}
