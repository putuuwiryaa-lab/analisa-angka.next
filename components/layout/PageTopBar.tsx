"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, Clock3, RefreshCw } from "lucide-react";

function formatInvestUpdatedAt(value: string | null) {
  if (!value) return "Waktu update belum tersedia";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Waktu update belum tersedia";

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  const pathname = usePathname();
  const isInvestPage = pathname === "/rekomendasi";
  const [investUpdatedAt, setInvestUpdatedAt] = useState<string | null>(null);
  const [investStatusLoading, setInvestStatusLoading] = useState(false);

  useEffect(() => {
    if (!isInvestPage || refreshing) return;

    const controller = new AbortController();
    setInvestStatusLoading(true);

    fetch("/api/invest/status", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error || "Gagal memuat waktu update Invest.");
        setInvestUpdatedAt(typeof json.updatedAt === "string" ? json.updatedAt : null);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setInvestUpdatedAt(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setInvestStatusLoading(false);
      });

    return () => controller.abort();
  }, [isInvestPage, refreshing]);

  return (
    <div className="space-y-2.5">
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

      {isInvestPage ? (
        <section className="depth-1 rounded-2xl border border-border-soft px-3.5 py-3">
          <p className="text-[11px] font-semibold leading-5 text-text-muted">
            Setiap pasaran memakai kombinasi metode terbaiknya sendiri, dipilih berdasarkan riwayat performa,
            kestabilan hasil, dan efisiensi jumlah line.
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-text-soft">
            <Clock3 size={13} strokeWidth={2} />
            <span>
              {investStatusLoading ? "Memuat waktu update…" : `Update data: ${formatInvestUpdatedAt(investUpdatedAt)}`}
            </span>
          </div>
        </section>
      ) : null}
    </div>
  );
}
