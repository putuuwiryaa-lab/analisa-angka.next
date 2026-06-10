"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Coins, ChevronRight, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";

type InvestFilter = { kind: string; param: number };

type InvestCombo = {
  id: string;
  label: string;
  access: "FREE" | "VIP";
  expectedLines: number;
  hitRate: number;
  avgWins15: number;
  avgScore: number;
  filters: InvestFilter[];
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
    throw new Error(body.error || "Gagal memuat rekomendasi");
  }
  const data = await res.json();
  return (data.markets || []) as InvestMarket[];
}

function formatAgo(ts: number) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const h = Math.floor(min / 60);
  return `${h} jam lalu`;
}

// Map digit-1/digit-2 pasangan -> posisi mati di builder Rekap
const PAIR_POS: Record<InvestPair["pair"], { d1: string; d2: string }> = {
  depan: { d1: "as", d2: "kop" },
  tengah: { d1: "kop", d2: "kepala" },
  belakang: { d1: "kepala", d2: "ekor" },
};

function buildRekapUrl(marketId: string, pair: InvestPair["pair"], filters: InvestFilter[]) {
  const p = new URLSearchParams();
  p.set("custom_focus", pair);
  p.set("invest", "1");
  const pos = PAIR_POS[pair];
  for (const f of filters) {
    switch (f.kind) {
      case "ai": p.set("iv_ai", String(f.param)); break;
      case "parity": p.set("iv_par", "1"); break;
      case "size": p.set("iv_size", "1"); break;
      case "bbfs": p.set("iv_bbfs", String(f.param)); break;
      case "off_shio": p.set("iv_shio", String(f.param)); break;
      case "off_jumlah": p.set("iv_jml", String(f.param)); break;
      case "off_kepala": p.set(`iv_off_${pos.d1}`, String(f.param)); break;
      case "off_ekor": p.set(`iv_off_${pos.d2}`, String(f.param)); break;
    }
  }
  return `/analyze/${encodeURIComponent(marketId)}/rekap?${p.toString()}`;
}

export default function RekomendasiPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const {
    data: markets = [],
    isPending,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
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
    <div className="animate-rise space-y-4 pb-4">
      <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
        <ArrowLeft size={16} /> Beranda
      </Button>

      <div className="animate-soft-pop depth-accent relative overflow-hidden rounded-3xl border p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-accent">
              <Coins size={14} />
              <span>Rekomendasi Invest</span>
            </div>
            <h2 className="display mt-2 text-3xl text-text">Rekomendasi Invest 2D</h2>
            <p className="mt-2 max-w-[44ch] text-xs font-medium leading-snug text-text-muted">
              Kombinasi yang sedang menunjukkan performa terbaik berdasarkan hasil terbaru. Pilih pasaran untuk melihat kandidat terkuat, lalu buka di Rekap untuk membentuk angka bermain.
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-text-soft">
              <RefreshCw size={12} />
              Analisis berdasarkan hasil terkini
              {dataUpdatedAt ? ` · diperbarui ${formatAgo(dataUpdatedAt)}` : ""}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="pressable depth-3 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-text-muted hover:border-border hover:bg-white/[0.075]"
            aria-label="Perbarui rekomendasi"
          >
            <RefreshCw size={19} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="animate-soft-pop rounded-2xl border border-danger/30 bg-danger/10 p-4 text-center text-xs font-bold text-danger">
          {errorMessage}
        </div>
      )}

      <div className="animate-fade-in relative">
        <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-soft" />
        <Input
          type="text"
          placeholder="Cari nama pasaran…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-14 rounded-3xl pl-12 font-bold transition-colors focus:border-border-strong"
        />
      </div>

      <div className="min-h-[40svh] space-y-2.5">
        {showInitialSkeleton ? (
          Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
        ) : filtered.length === 0 ? (
          <div className="animate-soft-pop depth-1 rounded-3xl border border-dashed py-14 text-center">
            <Coins className="mx-auto mb-3 text-text-soft" />
            <p className="px-6 text-xs uppercase tracking-wide text-text-muted">
              {search ? "Pasaran tidak ditemukan" : "Belum ada rekomendasi yang memenuhi kriteria"}
            </p>
            {!search && (
              <p className="mx-auto mt-1.5 max-w-[38ch] px-6 text-[11px] leading-snug text-text-soft">
                Rekomendasi muncul setelah ditemukan kombinasi dengan performa yang cukup kuat pada hasil terbaru.
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
              onOpenRekap={(pair, filters) => router.push(buildRekapUrl(market.marketId, pair, filters))}
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
  onOpenRekap,
}: {
  market: InvestMarket;
  index: number;
  open: boolean;
  onToggle: () => void;
  onOpenRekap: (pair: InvestPair["pair"], filters: InvestFilter[]) => void;
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
            {total} rekomendasi
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
            <PairBlock key={p.pair} block={p} onOpenRekap={onOpenRekap} />
          ))}
        </div>
      )}
    </div>
  );
}

function PairBlock({
  block,
  onOpenRekap,
}: {
  block: InvestPair;
  onOpenRekap: (pair: InvestPair["pair"], filters: InvestFilter[]) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-black uppercase tracking-wide text-accent">{block.pairLabel}</span>
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-text-soft">
          {block.combos.length ? `${block.combos.length} kandidat` : ""}
        </span>
      </div>

      {block.combos.length === 0 ? (
        <p className="depth-3 rounded-2xl border px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-text-soft">
          Tidak ada rekomendasi saat ini
        </p>
      ) : (
        <div className="space-y-2">
          {block.combos.map((c) => (
            <ComboRow key={c.id} combo={c} onOpen={() => onOpenRekap(block.pair, c.filters)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ComboRow({ combo, onOpen }: { combo: InvestCombo; onOpen: () => void }) {
  const hot = combo.avgWins15 >= 14;
  const akurat = Math.round(combo.avgWins15);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="pressable depth-2 flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left hover:bg-white/[0.05]"
    >
      <div className="min-w-0 flex-1">
        <p className="display text-[12.5px] leading-snug text-text">{combo.label}</p>
        {hot && (
          <span className="mt-1.5 inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-400">
            Sedang Kuat
          </span>
        )}
        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-text-soft">
          Riwayat {akurat}/15
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right">
          <p className="num text-lg font-black leading-none text-accent">~{Math.round(combo.expectedLines)}</p>
          <p className="text-[9px] font-bold uppercase tracking-wide text-text-soft">estimasi</p>
        </div>
        <ChevronRight size={18} className="text-text-soft" />
      </div>
    </button>
  );
}
