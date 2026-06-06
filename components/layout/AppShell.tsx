"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { BarChart3, Copy, Check, LogOut, MessageCircle, User } from "lucide-react";
import { useAuth, type Role } from "@/components/auth/auth-context";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

const WA_NUMBER = "6285119341538";

function formatTokenExpiry(token: string | null) {
  try {
    if (!token) return "Masa aktif";
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return "Masa aktif";
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized));
    if (!payload.exp) return "Masa aktif";
    return new Date(payload.exp * 1000).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Masa aktif";
  }
}

function accountInfo(role: Role, token: string | null) {
  const label = role === "MASTER" ? "MASTER" : role === "PRO" ? "VIP" : "TRIAL";
  const sub = role === "MASTER" ? "Admin access" : `Aktif sampai ${formatTokenExpiry(token)}`;
  return { label, sub };
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);

  // Halaman tanpa shell (header/nav disembunyikan), seperti perilaku lama.
  const hideShell = pathname.startsWith("/analyze/") || pathname === "/pantauan-rekap";

  return (
    <div className={cnPad(hideShell)}>
      {!hideShell && <HeroHeader />}

      <main className="min-w-0 flex-1">{children}</main>

      {!hideShell && <BottomNav onOpenAccount={() => setAccountOpen(true)} />}

      <AccountPanel open={accountOpen} onClose={() => setAccountOpen(false)} />
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

function BottomNav({ onOpenAccount }: { onOpenAccount: () => void }) {
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
          onClick={onOpenAccount}
          className="pressable flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border border-border-soft bg-white/[0.035] text-text-muted hover:border-border hover:bg-white/[0.06]"
          aria-label="Akun Saya"
        >
          <User size={19} />
          <span className="text-xs font-semibold">Akun</span>
        </button>
      </div>
    </nav>
  );
}

function AccountPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { role, displayCode, token, logout } = useAuth();
  const [copied, setCopied] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  if (!open) return null;

  const { label, sub } = accountInfo(role, token);
  const adminUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    `Halo, saya ingin bantuan Analisa Angka. Device Key saya ${displayCode}`,
  )}`;

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* abaikan */
    }
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="animate-soft-pop w-full max-w-sm rounded-t-3xl border border-border-soft bg-surface p-5 sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-text-soft">Akun</p>
            <h3 className="display mt-1 text-xl text-text">{label}</h3>
            <p className="mt-1 text-xs text-text-muted">{sub}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>

        <div className="mb-4 rounded-2xl border border-border-soft bg-black/25 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-text-soft">Device Key</p>
          <p className="num mt-2 text-2xl font-black tracking-[0.25em] text-primary-soft">
            {displayCode}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="ghost" onClick={copyKey}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Tersalin" : "Salin Key"}
          </Button>
          <a href={adminUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" className="w-full">
              <MessageCircle size={15} /> Admin
            </Button>
          </a>
        </div>

        {!confirmLogout ? (
          <Button variant="danger" className="mt-3 w-full" onClick={() => setConfirmLogout(true)}>
            <LogOut size={15} /> Keluar
          </Button>
        ) : (
          <div className="animate-soft-pop mt-3 rounded-2xl border border-danger/25 bg-danger/10 p-4 text-center">
            <p className="mb-3 text-sm text-text">Yakin ingin keluar?</p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="ghost" onClick={() => setConfirmLogout(false)}>
                Batal
              </Button>
              <Button variant="danger" onClick={logout}>
                Keluar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
