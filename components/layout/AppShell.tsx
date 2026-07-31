"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { BarChart3, Coins, ScanSearch } from "lucide-react";
import { AccessGuard } from "@/components/access/AccessGuard";
import { InstallAppBanner } from "@/components/install/InstallAppBanner";
import { Logo } from "@/components/ui/Logo";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isStandaloneMenu = pathname === "/rekomendasi" || pathname === "/pantauan-rekap" || pathname === "/share-prediksi" || pathname === "/invest";
  const isAccessRoute = pathname === "/pin" || pathname.startsWith("/admin");
  const isAdminRoute = pathname.startsWith("/admin");
  const isScanRoute = pathname === "/scan" || pathname.startsWith("/scan/");

  const hideHeader = isAccessRoute || pathname.startsWith("/analyze/") || isStandaloneMenu || isScanRoute;
  const showBottomNav = isHome && !isAccessRoute;

  return (
    <div className={cnPad(hideHeader, showBottomNav, isAccessRoute, isAdminRoute)}>
      {!isAccessRoute && <AccessGuard />}
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
    <header className="animate-fade-in mb-5 flex items-start justify-between gap-3 pt-3 sm:mb-6 sm:items-center sm:gap-4 sm:pt-4">
      <div className="min-w-0 flex-1 pr-1">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">Dashboard Analisis</p>
        <h1 className="display max-w-[11.5ch] whitespace-normal break-words text-[2.1rem] uppercase leading-[0.98] text-text sm:max-w-none sm:text-4xl">ANALISA ANGKA</h1>
        <p className="mt-2 text-sm font-medium leading-snug text-text-soft sm:text-base">Prediksi berbasis matematis</p>
      </div>
      <div className="animate-soft-pop relative mr-1 mt-1 flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-[1.45rem] border border-primary/15 bg-white/90 shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:mr-0 sm:mt-0 sm:h-20 sm:w-20">
        <div className="pointer-events-none absolute inset-2 rounded-[1rem] bg-primary/[0.055]" />
        <Logo className="relative h-11 w-11 sm:h-12 sm:w-12" />
      </div>
    </header>
  );
}

function BottomNav() {
  const pill = "pressable accent-bg-soft accent-text accent-border relative flex h-14 flex-1 items-center justify-center gap-1.5 rounded-2xl border px-2 hover:bg-surface-2";
  const softGlow = "0 8px 20px color-mix(in srgb, var(--accent) 9%, transparent)";

  return (
    <nav className="animate-fade-in fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg-deep/92 backdrop-blur-xl">
      <div className="mx-auto grid max-w-3xl grid-cols-3 items-end gap-2 px-4 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-3 sm:gap-3">
        <Link
          data-mode="statistics"
          href="/pantauan-rekap"
          className={pill}
          style={{ boxShadow: softGlow }}
          aria-label="Statistik Pasaran"
        >
          <BarChart3 size={19} />
          <span className="text-[11px] font-black uppercase tracking-wide sm:text-sm">Statistik</span>
        </Link>

        <Link
          data-mode="scan"
          href="/scan"
          className={pill}
          style={{ boxShadow: softGlow }}
          aria-label="Scan Angka"
        >
          <ScanSearch size={19} />
          <span className="text-[11px] font-black uppercase tracking-wide sm:text-sm">Scan</span>
        </Link>

        <Link
          data-mode="invest"
          href="/rekomendasi"
          className={pill}
          style={{ boxShadow: softGlow }}
          aria-label="Rekomendasi 2D"
        >
          <Coins size={19} />
          <span className="text-[11px] font-black uppercase tracking-wide sm:text-sm">Invest</span>
        </Link>
      </div>
    </nav>
  );
}
