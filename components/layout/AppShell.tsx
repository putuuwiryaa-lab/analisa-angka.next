"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { BarChart3, Coins } from "lucide-react";
import { InstallAppBanner } from "@/components/install/InstallAppBanner";
import { Logo } from "@/components/ui/Logo";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isStandaloneMenu = pathname === "/rekomendasi" || pathname === "/pantauan-rekap" || pathname === "/share-prediksi" || pathname === "/invest";
  const isAccessRoute = pathname === "/pin" || pathname.startsWith("/admin");
  const isAdminRoute = pathname.startsWith("/admin");

  const hideHeader = isAccessRoute || pathname.startsWith("/analyze/") || isStandaloneMenu;
  const showBottomNav = isHome && !isAccessRoute;

  return (
    <div className={cnPad(hideHeader, showBottomNav, isAccessRoute, isAdminRoute)}>
      {!hideHeader && <HeroHeader />}
      <main className="min-w-0 flex-1">{children}</main>
      {showBottomNav && <BottomNav />}
      {!hideHeader && <InstallAppBanner />}
    </div>
  );
}

function cnPad(hideHeader: boolean, showBottomNav: boolean, isAccessRoute: boolean, isAdminRoute: boolean) {
  if (isAdminRoute) return "admin-route relative min-h-screen w-full";
  if (isAccessRoute) return "relative min-h-screen w-full";

  return [
    "relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 sm:px-6",
    hideHeader ? "pb-6 pt-4" : showBottomNav ? "pb-32 pt-4" : "pb-6 pt-4",
  ].join(" ");
}

function HeroHeader() {
  return (
    <header className="animate-fade-in mb-5 flex items-start justify-between gap-2 pt-3 sm:mb-6 sm:items-center sm:gap-4 sm:pt-4">
      <div className="min-w-0 flex-1 pr-1">
        <h1 className="display max-w-[11.5ch] whitespace-normal break-words text-[2.1rem] uppercase leading-[0.98] text-text sm:max-w-none sm:text-4xl">ANALISA ANGKA</h1>
        <p className="mt-2 text-sm font-medium leading-snug text-text-soft sm:text-base">Prediksi berbasis matematis</p>
      </div>
      <div className="animate-soft-pop relative mr-3 mt-1 flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-[1.7rem] border border-primary/45 bg-primary/18 shadow-[0_0_34px_rgba(124,58,237,0.30),0_0_54px_rgba(40,215,255,0.10)] sm:mr-0 sm:mt-0 sm:h-20 sm:w-20">
        <div className="pointer-events-none absolute inset-[-0.45rem] rounded-[2rem] bg-primary/10 blur-xl" />
        <Logo className="relative h-11 w-11 sm:h-12 sm:w-12" />
      </div>
    </header>
  );
}

function BottomNav() {
  const pill = "pressable accent-bg-soft accent-text accent-border relative flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border px-3 hover:border-border hover:bg-white/[0.075]";
  const softGlow = "0 0 24px color-mix(in srgb, var(--accent) 14%, transparent)";

  return (
    <nav className="animate-fade-in fixed inset-x-0 bottom-0 z-40 border-t border-border-soft bg-bg-deep/90 backdrop-blur-xl">
      <div className="mx-auto grid max-w-3xl grid-cols-2 items-end gap-3 px-4 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-3">
        <Link
          data-mode="statistics"
          href="/pantauan-rekap"
          className={pill}
          style={{ boxShadow: softGlow }}
          aria-label="Statistik Pasaran"
        >
          <BarChart3 size={20} />
          <span className="text-sm font-black uppercase tracking-wide">Statistik</span>
        </Link>

        <Link
          data-mode="invest"
          href="/rekomendasi"
          className={pill}
          style={{ boxShadow: softGlow }}
          aria-label="Rekomendasi 2D"
        >
          <Coins size={20} />
          <span className="text-sm font-black uppercase tracking-wide">Invest</span>
        </Link>
      </div>
    </nav>
  );
}
