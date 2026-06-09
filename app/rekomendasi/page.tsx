"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, Coins, Flame, RefreshCw, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";

type InvestCombo = {
  id: string;
  label: string;
  access: "FREE" | "VIP";
  expectedLines: number;
  hitRate: number;
  avgWins15: number;
  avgScore: number;
};

type InvestPair = {
  pair: "depan" | "tengah" | "belakang";
  pairLabel: string;
  combos: InvestCombo[];
};

type InvestMarket = {
  marketId: string;
  marketName: string;
  hasAny: boolean;
  pairs: InvestPair[];
};

async function fetchInvest(): Promise<InvestMarket[]> {
  const res = await fetch("/api/invest");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Gagal memuat rekomendasi invest");
  }
  const data = await res.json();
  return (data.markets || []) as InvestMarket[];
}

export default function RekomendasiPage() {
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const {
    data: markets = [],
    isPending,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["invest"],
    queryFn: fetchInvest,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const withRecs = useMemo(() => markets.filter((m) => m.hasAny), [markets]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return withRecs;
    return withRecs.filter(
      (m) => m.marketId.toLowerCase().includes(q) || m.marketName.toLowerCase().includes(q),
    );
  }, [withRecs, search]);

  const errorMessage = error instanceof Error ? error.message : "";
  const showInitialSkeleton = isPending && markets.length === 0;

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <div className="animate-rise pb-4">
      {/* Intro */}
      <div className="animate-soft-pop depth-accent relative mb-4 overflow-hidden rounded-3xl border p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-accent">
              <Coins size={14} />
              <span>Rekomendasi Invest</span>
            </div>
            <h2 className="display mt-2 text-3xl text-text">Invest 2D</h2>
            <p className="mt-2 max-w-[42ch] text-xs font-medium leading-snug text-text-muted">
              Kombinasi analisa yang lagi bagus (menang ≥13/15) untuk invest 2D di kisaran 55–65 line. Tap pasaran untuk lihat combo-nya, lalu generate angka di Rekap Custom.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="pressable depth-3 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-text-muted hover:border-border hover:bg-white/[0.075]"
            aria-label="Muat ulang rekomendasi"
          >
            <RefreshCw size={19} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="animate-soft-pop mb-4 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-center text-xs font-bold text-danger">
          {errorMessage}
        </div>
      )}

      {/* Search */}
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

      {/* List pasaran */}
      <div className="min-h-[40svh] space-y-2.5">
        {showInitialSkeleton ? (
          Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
        ) : filtered.length === 0 ? (
          <div className="animate-soft-pop depth-1 rounded-3xl border border-dashed py-14 text-center">
            <Coins className="mx-auto mb-3 text-text-soft" />
            <p className="text-xs uppercase tracking-wide text-text-muted">
              {search ? "Pasaran tidak ditemukan" : "Belum ada rekomendasi invest"}
            </p>
            {!search && (
              <p className="mx-auto mt-1 max-w-[34ch] text-[11px] text-text-soft">
                Muncul saat ada kombinasi yang menang ≥13/15 dari 15 hasil terakhir.
              </p>
            )}
          </div>
        ) : (
          filtered.map((market, index) => (
            <MarketRow
              key={market.marketId}
              market={market}
              index={index}
              open={openId === market.marketId}
              onToggle={() => toggle(market.marketId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MarketRow({
  market,
  index,
  open,
  onToggle,
}: {
  market: InvestMarket;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const total = market.pairs.reduce((sum, p) => sum + p.combos.length, 0);

  return (
    <div
      className="animate-soft-pop depth-1 overflow-hidden rounded-2xl border"
      style={{ animationDelay: `${Math.min(index, 10) * 24}ms` }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="pressable flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/[0.04]"
      >
        <h3 className="display truncate text-base text-text">{market.marketName}</h3>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="num rounded-full bg-accent/12 px-2.5 py-1 text-[11px] font-black text-accent">
            {total} combo
          </span>
          <ChevronDown
            size={18}
            className={`text-text-soft transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="animate-fade-in space-y-4 border-t border-border-soft px-4 pb-4 pt-3.5">
          {market.pairs.map((p) => (
            <PairBlock key={p.pair} block={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function PairBlock({ block }: { block: InvestPair }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-black uppercase tracking-wide text-accent">{block.pairLabel}</span>
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-text-soft">
          {block.combos.length ? `${block.combos.length} combo` : ""}
        </span>
      </div>

      {block.combos.length === 0 ? (
        <p className="depth-3 rounded-2xl border px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-text-soft">
          Belum ada
        </p>
      ) : (
        <div className="space-y-2">
          {block.combos.map((c) => (
            <ComboRow key={c.id} combo={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function ComboRow({ combo }: { combo: InvestCombo }) {
  const hot = combo.avgWins15 >= 14;

  return (
    <div className="depth-2 flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {hot && <Flame size={13} className="shrink-0 text-amber-400" />}
          <p className="display truncate text-[12.5px] leading-tight text-text">{combo.label}</p>
        </div>
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-text-soft">
          menang {combo.avgWins15}/15
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="num text-lg font-black leading-none text-accent">~{Math.round(combo.expectedLines)}</p>
        <p className="text-[9px] font-bold uppercase tracking-wide text-text-soft">line</p>
      </div>
    </div>
  );
      }
