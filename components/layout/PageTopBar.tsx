"use client";

import { ArrowLeft, RefreshCw } from "lucide-react";

export function PageTopBar({
  title,
  onBack,
  backLabel = "Beranda",
  onRefresh,
  refreshing = false,
  refreshLabel = "Perbarui halaman",
}: {
  title: string;
  onBack: () => void;
  backLabel?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshLabel?: string;
}) {
  return (
    <div className="grid min-h-11 grid-cols-[auto_1fr_auto] items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="pressable depth-3 inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 text-xs font-black uppercase tracking-wide text-text-muted hover:border-border"
      >
        <ArrowLeft size={15} /> {backLabel}
      </button>

      <p className="truncate text-center text-[10px] font-black uppercase tracking-[0.18em] text-text-soft">
        {title}
      </p>

      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="pressable depth-3 flex h-11 w-11 items-center justify-center rounded-2xl border text-text-muted hover:border-border disabled:opacity-45"
          aria-label={refreshLabel}
        >
          <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
        </button>
      ) : (
        <span className="h-11 w-11" aria-hidden="true" />
      )}
    </div>
  );
}
