"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Layers3, ScanSearch } from "lucide-react";

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const scanActive = pathname === "/scan";
  const batchActive = pathname.startsWith("/scan/batch");

  const navClass = (active: boolean) => [
    "pressable flex h-14 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black uppercase tracking-wide transition-colors",
    active
      ? "border-primary/45 bg-primary/20 text-primary-soft"
      : "border-border-soft bg-surface/85 text-text-muted hover:border-border hover:text-text",
  ].join(" ");

  return (
    <div className="mx-auto min-h-[calc(100svh-2rem)] w-full max-w-3xl pb-28">
      <header className="animate-fade-in mb-5 flex items-center justify-between gap-3 rounded-3xl border border-border-soft bg-surface/75 p-3 backdrop-blur-xl">
        <Link
          href="/"
          className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border-soft bg-white/[0.04] text-text-muted hover:border-border hover:text-text"
          aria-label="Kembali ke Analisa Angka"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary-soft">Analisa Angka</p>
          <h1 className="display truncate text-xl text-text">Scan Angka</h1>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 text-primary-soft">
          <ScanSearch size={21} />
        </div>
      </header>

      {children}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-soft bg-bg-deep/92 backdrop-blur-xl" aria-label="Navigasi Scan Angka">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 px-4 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-3 sm:px-6">
          <Link href="/scan" className={navClass(scanActive)} aria-current={scanActive ? "page" : undefined}>
            <ScanSearch size={19} />
            Scan
          </Link>
          <Link href="/scan/batch" className={navClass(batchActive)} aria-current={batchActive ? "page" : undefined}>
            <Layers3 size={19} />
            Batch
          </Link>
        </div>
      </nav>
    </div>
  );
}
