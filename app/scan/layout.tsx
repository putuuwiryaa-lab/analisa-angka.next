import { Suspense } from "react";
import Link from "next/link";
import { House, ScanSearch } from "lucide-react";
import { ScanNavigation, ScanNavigationFallback } from "./ScanNavigation";
import styles from "./ScanTheme.module.css";

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${styles.theme} ${styles.pageBackdrop} mx-auto min-h-[calc(100svh-2rem)] w-full max-w-3xl pb-24`}
      data-scan-theme
    >
      <header className="animate-fade-in mb-3 flex items-center justify-between gap-2.5 rounded-2xl border border-border-soft bg-surface/75 p-2.5 backdrop-blur-xl">
        <Link
          href="/"
          prefetch={false}
          className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-soft bg-white/[0.04] text-text-muted hover:border-border hover:text-text"
          aria-label="Ke halaman utama"
        >
          <House size={18} />
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
        <Suspense fallback={<ScanNavigationFallback />}>
          <ScanNavigation />
        </Suspense>
      </nav>
    </div>
  );
}
