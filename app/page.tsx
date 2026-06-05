"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Clock3, Database, Plus, RefreshCw, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  MARKETS_GC_TIME,
  MARKETS_QUERY_KEY,
  MARKETS_STALE_TIME,
  fetchMarkets,
  formatMarketUpdatedAt,
} from "@/lib/markets/client";

const WA_NUMBER = "6285119341538";

export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const {
    data: markets = [],
    isPending,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: MARKETS_QUERY_KEY,
    queryFn: fetchMarkets,
    staleTime: MARKETS_STALE_TIME,
    gcTime: MARKETS_GC_TIME,
    placeholderData: keepPreviousData,
  });

  const requestMarketUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    "Halo, saya ingin request penambahan pasaran.",
  )}`;

  const latestMarketUpdate = useMemo(() => {
    const times = markets
      .map((m) => new Date(m.updated_at || 0).getTime())
      .filter((t) => Number.isFinite(t) && t > 0);
    return times.length ? new Date(Math.max(...times)).toISOString() : null;
  }, [markets]);

  const filteredMarkets = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return markets;
    return markets.filter(
      (m) => m.id.toLowerCase().includes(q) || (m.name && m.name.toLowerCase().includes(q)),
    );
  }, [markets, search]);

  const errorMessage = error instanceof Error ? error.message : "";
  const showInitialSkeleton = isPending && markets.length === 0;

  return (
    <div className="animate-rise">
      <div className="animate-soft-pop depth-1 mb-4 rounded-3xl border p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-accent">
              <Clock3 size={14} />
              <span className="truncate">Update {formatMarketUpdatedAt(latestMarketUpdate)}</span>
            </div>
            <p className="mt-1 text-xs font-semibold text-text-muted">
              {markets.length} pasaran tersedia{search ? ` · ${filteredMarkets.length} cocok` : ""}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="pressable depth-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-text-muted hover:border-border hover:bg-white/[0.07]"
            aria-label="Refresh data pasaran"
          >
            <RefreshCw size={18} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="animate-soft-pop mb-4 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-center text-xs font-bold text-danger">
          {errorMessage}
        </div>
      )}

      <div className="animate-fade-in relative mb-4">
        <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-soft" />
        <Input
          type="text"
          placeholder="Cari pasaran…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-14 rounded-3xl pl-12 font-bold transition-colors focus:border-border-strong"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 pb-6 sm:grid-cols-3">
        {showInitialSkeleton ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[110px] rounded-3xl" />)
        ) : (
          <>
            {filteredMarkets.map((m, index) => (
              <Link
                key={m.id}
                href={`/analyze/${encodeURIComponent(m.id)}`}
                className="pressable animate-soft-pop depth-1 group flex h-[112px] flex-col overflow-hidden rounded-3xl border text-center hover:border-border hover:bg-surface-2"
                style={{ animationDelay: `${Math.min(index, 10) * 24}ms` }}
              >
                <div className="depth-2 flex min-h-[48px] items-center justify-center border-b border-border-soft px-3 transition-colors group-hover:bg-white/[0.04]">
                  <span className="display line-clamp-2 text-[12px] leading-4 text-text">{m.name || m.id}</span>
                </div>
                <div className="flex flex-1 items-center justify-center">
                  <span className="num text-2xl font-black tracking-[0.08em] text-accent transition-transform duration-150 group-hover:scale-[1.03]">{m.lastResult || "----"}</span>
                </div>
              </Link>
            ))}

            <a
              href={requestMarketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pressable animate-soft-pop depth-2 flex h-[112px] flex-col items-center justify-center rounded-3xl border border-dashed text-center hover:border-border hover:bg-surface"
              aria-label="Request penambahan pasaran via WhatsApp"
            >
              <div className="depth-3 flex h-10 w-10 items-center justify-center rounded-2xl border text-primary-soft">
                <Plus size={22} strokeWidth={3} />
              </div>
              <span className="display mt-2 block text-[11px] text-text">Request Pasaran</span>
              <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-text-soft">
                Hubungi Admin
              </span>
            </a>

            {filteredMarkets.length === 0 && (
              <div className="animate-soft-pop depth-1 col-span-2 rounded-3xl border border-dashed py-12 text-center sm:col-span-3">
                <Database className="mx-auto mb-3 text-text-soft" />
                <p className="text-xs uppercase tracking-wide text-text-muted">Pasaran tidak ditemukan</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
