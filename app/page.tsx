"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Clock3, Database, Plus, RefreshCw, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";

const WA_NUMBER = "6285119341538";

type Market = {
  id: string;
  name?: string | null;
  order?: number | null;
  updated_at?: string | null;
  history_data?: string | null;
  lastResult?: string;
};

function getLastResult(historyData: string | null | undefined) {
  const tokens = String(historyData || "")
    .trim()
    .split(/[\s\n\r\t,]+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (/^\d{4}$/.test(tokens[i])) return tokens[i];
  }
  return "----";
}

function formatMarketUpdatedAt(value: string | null) {
  if (!value) return "Belum ada info";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Info tidak valid";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchMarkets(): Promise<Market[]> {
  const response = await fetch("/api/markets", { cache: "no-store" });
  const json = await response.json();

  if (!response.ok) {
    throw new Error(json?.error || "Gagal memuat data pasaran.");
  }
  if (!Array.isArray(json)) {
    throw new Error("Format data pasaran dari server tidak valid.");
  }

  return json
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .map((m) => ({ ...m, lastResult: getLastResult(m.history_data) }));
}

export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const { data: markets = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["markets"],
    queryFn: fetchMarkets,
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

  return (
    <div className="animate-rise">
      <div className="mb-4 rounded-3xl border border-border-soft bg-surface/80 p-3 shadow-xl shadow-black/10">
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
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border-soft bg-white/[0.045] text-text-muted active:scale-95"
            aria-label="Refresh data pasaran"
          >
            <RefreshCw size={18} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-center text-xs font-bold text-danger">
          {errorMessage}
        </div>
      )}

      <div className="relative mb-4">
        <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-soft" />
        <Input
          type="text"
          placeholder="Cari pasaran…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-14 rounded-3xl pl-12 font-bold"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 pb-6 sm:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[110px] rounded-3xl" />)
        ) : (
          <>
            {filteredMarkets.map((m) => (
              <Link
                key={m.id}
                href={`/analyze/${encodeURIComponent(m.id)}`}
                className="group flex h-[112px] flex-col overflow-hidden rounded-3xl border border-border-soft bg-surface text-center transition active:scale-[0.985] hover:border-border"
              >
                <div className="flex min-h-[48px] items-center justify-center border-b border-border-soft bg-white/[0.025] px-3">
                  <span className="display line-clamp-2 text-[12px] leading-4 text-text">{m.name || m.id}</span>
                </div>
                <div className="flex flex-1 flex-col items-center justify-center gap-1">
                  <span className="num text-2xl font-black tracking-[0.08em] text-accent">{m.lastResult || "----"}</span>
                  <span className="text-[9px] font-black uppercase tracking-wide text-text-soft">Result terakhir</span>
                </div>
              </Link>
            ))}

            <a
              href={requestMarketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-[112px] flex-col items-center justify-center rounded-3xl border border-dashed border-border-soft bg-surface/70 text-center transition active:scale-[0.985] hover:border-border"
              aria-label="Request penambahan pasaran via WhatsApp"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/[0.06] text-primary-soft">
                <Plus size={22} strokeWidth={3} />
              </div>
              <span className="display mt-2 block text-[11px] text-text">Request Pasaran</span>
              <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-text-soft">
                Hubungi Admin
              </span>
            </a>

            {filteredMarkets.length === 0 && (
              <div className="col-span-2 rounded-3xl border border-dashed border-border bg-white/5 py-12 text-center sm:col-span-3">
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
