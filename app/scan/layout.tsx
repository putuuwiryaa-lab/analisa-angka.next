"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Layers3, ScanSearch } from "lucide-react";

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const scanActive = pathname === "/scan";
  const batchActive = pathname.startsWith("/scan/batch");

  const navClass = (active: boolean) => [
    "pressable flex h-12 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black uppercase tracking-wide transition-colors",
    active
      ? "border-primary/45 bg-primary/20 text-primary-soft"
      : "border-border-soft bg-surface/85 text-text-muted hover:border-border hover:text-text",
  ].join(" ");

  return (
    <div className="mx-auto min-h-[calc(100svh-2rem)] w-full max-w-3xl pb-24">
      <header className="animate-fade-in mb-3 flex items-center justify-between gap-2.5 rounded-2xl border border-border-soft bg-surface/75 p-2.5 backdrop-blur-xl">
        <Link
          href="/"
          prefetch={false}
          className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-soft bg-white/[0.04] text-text-muted hover:border-border hover:text-text"
          aria-label="Kembali ke Analisa Angka"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.17em] text-primary-soft">Analisa Angka</p>
          <h1 className="display truncate text-lg text-text">Scan Angka</h1>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary-soft">
          <ScanSearch size={19} />
        </div>
      </header>

      {children}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-soft bg-bg-deep/92 backdrop-blur-xl" aria-label="Navigasi Scan Angka">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2 px-3 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-2 sm:px-5">
          <Link href="/scan" prefetch={false} className={navClass(scanActive)} aria-current={scanActive ? "page" : undefined}>
            <ScanSearch size={17} />
            Scan
          </Link>
          <Link href="/scan/batch" prefetch={false} className={navClass(batchActive)} aria-current={batchActive ? "page" : undefined}>
            <Layers3 size={17} />
            Batch
          </Link>
        </div>
      </nav>
    </div>
  );
}
