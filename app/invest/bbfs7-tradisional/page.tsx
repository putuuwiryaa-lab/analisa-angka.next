"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Grid3X3, Search } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { MARKETS_GC_TIME, MARKETS_QUERY_KEY, MARKETS_STALE_TIME, fetchMarkets } from "@/lib/markets/client";

type MarketLike = { id: string; name?: string | null; lastResult?: string | null };

export default function InvestBbfs7TraditionalPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const { data: markets = [], isPending, error } = useQuery({
    queryKey: [...MARKETS_QUERY_KEY, "bbfs7-tradisional"],
    queryFn: () => fetchMarkets(token || ""),
    enabled: Boolean(token),
    staleTime: MARKETS_STALE_TIME,
    gcTime: MARKETS_GC_TIME,
    placeholderData: keepPreviousData,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return markets as MarketLike[];
    return (markets as MarketLike[]).filter((m) => m.id.toLowerCase().includes(q) || (m.name && m.name.toLowerCase().includes(q)));
  }, [markets, search]);
  const errorMessage = error instanceof Error ? error.message : "";

  return (
    <div data-mode="bbfs7_tradisional" className="animate-rise space-y-4 pb-4">
      <Button variant="ghost" size="sm" onClick={() => router.push("/invest")}>
        <ArrowLeft size={16} /> Invest
      </Button>
      <section className="animate-soft-pop depth-accent rounded-3xl border p-5">
        <div className="accent-text flex items-center gap-2 text-[11px] font-black uppercase tracking-wide">
          <Grid3X3 size={14} />
          <span>Uji Coba BBFS 7D</span>
        </div>
        <h2 className="display mt-2 text-3xl text-text">Rumus Tradisional</h2>
        <p className="mt-2 text-xs font-medium leading-snug text-text-muted">Walk-forward 14 data. Rumus minimal 12/14 baru masuk voting.</p>
      </section>
      {errorMessage && <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-center text-xs font-bold text-danger">{errorMessage}</div>}
      <div className="relative">
        <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-soft" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari pasaran…" className="h-14 rounded-3xl pl-12 font-bold" />
      </div>
      <section className="space-y-2.5">
        {isPending && markets.length === 0 ? (
          Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
        ) : filtered.length === 0 ? (
          <div className="depth-1 rounded-3xl border border-dashed py-14 text-center text-xs uppercase tracking-wide text-text-muted">Pasaran tidak ditemukan</div>
        ) : (
          filtered.map((market, index) => (
            <Link
              key={market.id}
              href={`/analyze/${encodeURIComponent(market.id)}/bbfs7_tradisional`}
              className="pressable animate-soft-pop depth-1 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 hover:border-border hover:bg-surface-2"
              style={{ animationDelay: `${Math.min(index, 10) * 24}ms` }}
            >
              <div className="min-w-0">
                <h3 className="display truncate text-base text-text">{market.name || market.id}</h3>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-text-soft">Terakhir {market.lastResult || "----"}</p>
              </div>
              <ChevronRight size={18} className="text-text-soft" />
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
