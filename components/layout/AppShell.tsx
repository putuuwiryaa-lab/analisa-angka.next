"use client";

import { type ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { BarChart3, UserRoundCheck } from "lucide-react";
import { VipLoginPanel } from "@/components/auth/VipLoginPanel";
import { InstallAppBanner } from "@/components/install/InstallAppBanner";
import { Logo } from "@/components/ui/Logo";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [loginOpen, setLoginOpen] = useState(false);

  const hideShell = pathname.startsWith("/analyze/") || pathname === "/pantauan-rekap";

  return (
    <div className={cnPad(hideShell)}>
      {!hideShell && <HeroHeader />}

      <main className="min-w-0 flex-1">{children}</main>

      {!hideShell && <BottomNav onOpenFree={() => setLoginOpen(true)} />}
      {!hideShell && <InstallAppBanner />}

      <VipLoginPanel open={loginOpen} onClose={() => setLoginOpen(false)} />
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
  const statsClassName = "pressable relative flex h-15 flex-[1.45] items-center justify-center gap-2 rounded-2xl border px-4";

  return (
    <nav className="animate-fade-in fixed inset-x-0 bottom-0 z-40 border-t border-border-soft bg-bg-deep/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-2.5">
        <Link
          href="/pantauan-rekap"
          className={`${statsClassName} border-emerald-400/35 bg-emerald-500/15 text-emerald-300 shadow-[0_0_28px_rgba(16,185,129,0.18)] hover:bg-emerald-500/20 hover:shadow-[0_0_34px_rgba(16,185,129,0.24)]`}
          aria-label="Statistik Pasaran"
        >
          <BarChart3 size={21} />
          <span className="text-sm font-black uppercase tracking-wide">Statistik</span>
        </Link>
        <button
          type="button"
          onClick={onOpenFree}
          className="pressable flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border border-primary/30 bg-primary/10 text-primary-soft hover:border-primary/50 hover:bg-primary/15"
          aria-label="Akun VIP"
        >
          <UserRoundCheck size={19} />
          <span className="text-xs font-semibold">VIP</span>
        </button>
      </div>
    </nav>
  );
}
