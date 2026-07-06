"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Grid3X3, Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  MARKETS_GC_TIME,
  MARKETS_QUERY_KEY,
  MARKETS_STALE_TIME,
  fetchMarkets,
  formatMarketUpdatedAt,
} from "@/lib/markets/client";

type MarketLike = {
  id: string;
  name?: string | null;
  lastResult?: string | null;
  updated_at?: string | null;
};

export default function InvestBbfs7Page() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const {
    data: markets = [],
    isPending,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [...MARKETS_QUERY_KEY, "invest-bbfs7"],
    queryFn: () => fetchMarkets(),
    staleTime: MARKETS_STALE_TIME,
    gcTime: MARKETS_GC_TIME,
    placeholderData: keepPreviousData,
  });

  const latestMarketUpdate = useMemo(() => {
    const times = markets
      .map((m: MarketLike) => new Date(m.updated_at || 0).getTime())
      .filter((t: number) => Number.isFinite(t) && t > 0);
    return times.length ? new Date(Math.max(...times)).toISOString() : null;
  }, [markets]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return markets as MarketLike[];
    return (markets as MarketLike[]).filter(
      (m) => m.id.toLowerCase().includes(q) || (m.name && m.name.toLowerCase().includes(q)),
    );
  }, [markets, search]);

  const errorMessage = error instanceof Error ? error.message : "";
  const showInitialSkeleton = isPending && markets.length === 0;

  return (
    <div data-mode="bbfs7_trial" className="animate-rise space-y-4 pb-4">
      <Button variant="ghost" size="sm" onClick={() => router.push("/invest")}> 
        <ArrowLeft size={16} /> Invest
      </Button>

      <section className="animate-soft-pop depth-accent relative overflow-hidden rounded-3xl border p-5">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full blur-3xl"
          style={{ backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)" }}
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="accent-text flex items-center gap-2 text-[11px] font-black uppercase tracking-wide">
              <Grid3X3 size={14} />
              <span>BBFS 7D</span>
            </div>
            <h2 className="display mt-2 text-3xl text-text">Pilih Pasaran</h2>
            <p className="mt-2 max-w-[42ch] text-xs font-medium leading-snug text-text-muted">
              Buka pasaran untuk menghitung BBFS 7 digit berdasarkan walk-forward rumus.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="pressable depth-3 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-text-muted hover:border-border hover:bg-white/[0.075] disabled:opacity-50"
            aria-label="Perbarui data pasaran"
          >
            <RefreshCw size={19} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-2">
          <SummaryChip label="Pasaran" value={String(markets.length)} />
          <SummaryChip label="Update" value={formatMarketUpdatedAt(latestMarketUpdate)} />
        </div>
      </section>

      {errorMessage && (
        <div className="animate-soft-pop rounded-2xl border border-danger/30 bg-danger/10 p-4 text-center text-xs font-bold text-danger">
          {errorMessage}
        </div>
      )}

      <div className="animate-fade-in relative">
        <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-soft" />
        <Input
          type="text"
          placeholder="Cari pasaran…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-14 rounded-3xl pl-12 font-bold transition-colors focus:border-border-strong"
        />
      </div>

      <section className="min-h-[40svh] space-y-2.5">
        {showInitialSkeleton ? (
          Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
        ) : filtered.length === 0 ? (
          <div className="animate-soft-pop depth-1 rounded-3xl border border-dashed py-14 text-center">
            <Grid3X3 className="mx-auto mb-3 text-text-soft" />
            <p className="px-6 text-xs uppercase tracking-wide text-text-muted">Pasaran tidak ditemukan</p>
          </div>
        ) : (
          filtered.map((market, index) => (
            <Link
              key={market.id}
              href={`/analyze/${encodeURIComponent(market.id)}/bbfs7_trial`}
              className="pressable animate-soft-pop depth-1 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 hover:border-border hover:bg-surface-2"
              style={{ animationDelay: `${Math.min(index, 10) * 24}ms` }}
            >
              <div className="min-w-0">
                <h3 className="display truncate text-base text-text">{market.name || market.id}</h3>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-text-soft">Result terakhir {market.lastResult || "----"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="accent-bg-soft accent-text rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide">BBFS 7D</span>
                <ChevronRight size={18} className="text-text-soft" />
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2 text-center">
      <p className="num accent-text truncate text-sm font-black">{value}</p>
      <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wide text-text-soft">{label}</p>
    </div>
  );
}
