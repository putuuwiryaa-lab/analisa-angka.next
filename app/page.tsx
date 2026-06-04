"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Database, Plus, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
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
  if (!value) return "Belum ada info update";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Info update tidak valid";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchMarkets(): Promise<Market[]> {
  const { data, error } = await supabase.from("markets").select("*");
  if (error) throw error;
  return (data || [])
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .map((m) => ({ ...m, lastResult: getLastResult(m.history_data) }));
}

export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const { data: markets = [], isLoading, refetch, isFetching } = useQuery({
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
    const q = search.toLowerCase();
    return markets.filter(
      (m) => m.id.toLowerCase().includes(q) || (m.name && m.name.toLowerCase().includes(q)),
    );
  }, [markets, search]);

  return (
    <div className="animate-rise">
      <div className="mb-4 flex items-center justify-between gap-3 px-1">
        <div className="inline-flex min-w-0 rounded-full border border-border-soft bg-white/[0.04] px-3 py-2">
          <span className="truncate text-[11px] font-bold uppercase tracking-wide text-accent">
            Data pasar diperbarui: {formatMarketUpdatedAt(latestMarketUpdate)}
          </span>
        </div>
        <button
          onClick={() => refetch()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-soft text-text-muted active:scale-95"
          aria-label="Refresh data pasaran"
        >
          <RefreshCw size={18} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="relative mb-5">
        <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-soft" />
        <Input
          type="text"
          placeholder="Cari pasaran…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-14 pl-12 font-bold"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 pb-6 sm:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-2xl" />)
        ) : (
          <>
            {filteredMarkets.map((m) => (
              <Link
                key={m.id}
                href={`/analyze/${m.id}`}
                className="flex h-[104px] flex-col overflow-hidden rounded-2xl border border-border-soft bg-surface text-center transition active:scale-[0.985] hover:border-border"
              >
                <div className="border-b border-border-soft bg-white/[0.02] px-2 py-2.5">
                  <span className="display block truncate text-[12px] text-text">{m.name || m.id}</span>
                </div>
                <div className="flex flex-1 items-center justify-center">
                  <span className="num text-lg font-black text-accent">{m.lastResult || "----"}</span>
                </div>
              </Link>
            ))}

            <a
              href={requestMarketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-[104px] flex-col items-center justify-center rounded-2xl border border-border-soft bg-surface text-center transition active:scale-[0.985] hover:border-border"
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
              <div className="col-span-2 rounded-2xl border border-dashed border-border bg-white/5 py-12 text-center sm:col-span-3">
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
