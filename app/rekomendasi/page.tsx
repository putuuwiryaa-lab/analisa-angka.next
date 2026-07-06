"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Coins, Copy, Loader2, RefreshCw, Search, Trophy } from "lucide-react";
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
type InvestPair = { pair: "depan" | "tengah" | "belakang"; pairLabel: string; combos: InvestCombo[] };
type InvestMarket = { marketId: string; marketName: string; hasAny: boolean; pairs: InvestPair[] };
type AngkaJadiResult = { lines?: string[]; latest_result?: string; formula_version?: string };
type AngkaJadiState = { loading?: boolean; error?: string; result?: AngkaJadiResult; copied?: boolean };

async function fetchInvest(): Promise<InvestMarket[]> {
  const res = await fetch("/api/invest", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Gagal memuat rekomendasi");
  return (data.markets || []) as InvestMarket[];
}

function formatAgo(ts: number) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  return `${Math.floor(min / 60)} jam lalu`;
}

function formatScore(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

function formatWins15(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

function comboStrengthLabel(avgWins15: number) {
  if (avgWins15 >= 15) return "Sempurna";
  if (avgWins15 >= 14) return "Kuat";
  if (avgWins15 >= 13) return "Stabil";
  if (avgWins15 >= 12) return "Potensial";
  return "Pantauan";
}

function lineCopyText(lines: string[] = []) {
  return lines.join("*");
}

function lineDisplayText(lines: string[] = []) {
  return lines.join(" * ");
}

function comboKey(marketId: string, pair: InvestPair["pair"], comboId: string) {
  return `${marketId}::${pair}::${comboId}`;
}

export default function RekomendasiPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [angkaJadi, setAngkaJadi] = useState<Record<string, AngkaJadiState>>({});

  const { data: markets = [], isPending, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["invest"],
    queryFn: fetchInvest,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const withRecs = useMemo(() => markets.filter((m) => m.hasAny), [markets]);
  const allComboCount = useMemo(
    () => withRecs.reduce((sum, market) => sum + market.pairs.reduce((pairSum, pair) => pairSum + pair.combos.length, 0), 0),
    [withRecs],
  );
  const topItems = useMemo(
    () =>
      withRecs
        .flatMap((market) =>
          market.pairs.flatMap((pair) =>
            pair.combos
              .filter((combo) => combo.avgWins15 >= 15)
              .slice(0, 1)
              .map((combo) => ({ market, pair, combo })),
          ),
        )
        .slice(0, 12),
    [withRecs],
  );
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return withRecs;
    return withRecs.filter((m) => m.marketId.toLowerCase().includes(q) || m.marketName.toLowerCase().includes(q));
  }, [withRecs, search]);

  const errorMessage = error instanceof Error ? error.message : "";
  const showInitialSkeleton = isPending && markets.length === 0;

  const handleOpenAngkaJadi = async (key: string, marketId: string, pair: InvestPair["pair"], filters: InvestFilter[]) => {
    const existing = angkaJadi[key];
    if (existing?.loading) return;
    if (existing?.result) {
      setAngkaJadi((prev) => ({ ...prev, [key]: { ...prev[key], result: undefined } }));
      return;
    }

    setAngkaJadi((prev) => ({ ...prev, [key]: { loading: true } }));
    try {
      const response = await fetch("/api/invest/angka-jadi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId, pair, filters }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.success) throw new Error(json.error || "Gagal membuat Angka Jadi.");
      setAngkaJadi((prev) => ({ ...prev, [key]: { loading: false, result: json } }));
    } catch (e) {
      setAngkaJadi((prev) => ({ ...prev, [key]: { loading: false, error: e instanceof Error ? e.message : "Gagal membuat Angka Jadi." } }));
    }
  };

  const handleCopyAngkaJadi = async (key: string) => {
    const lines = angkaJadi[key]?.result?.lines || [];
    if (!lines.length) return;
    await navigator.clipboard?.writeText(lineCopyText(lines));
    setAngkaJadi((prev) => ({ ...prev, [key]: { ...prev[key], copied: true } }));
    window.setTimeout(() => setAngkaJadi((prev) => ({ ...prev, [key]: { ...prev[key], copied: false } })), 1200);
  };

  return (
    <div data-mode="invest" className="animate-rise space-y-4 pb-4">
      <Button variant="ghost" size="sm" onClick={() => router.push("/")}> 
        <ArrowLeft size={16} /> Beranda
      </Button>

      <div className="animate-soft-pop depth-accent relative overflow-hidden rounded-3xl border p-5">
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="accent-text flex items-center gap-2 text-[11px] font-black uppercase tracking-wide">
              <Coins size={14} />
              <span>Rekomendasi 2D</span>
            </div>
            <h2 className="display mt-2 text-3xl text-text">Invest Terarah</h2>
            <p className="mt-2 max-w-[42ch] text-xs font-medium leading-snug text-text-muted">
              Pilihan kombinasi terbaik dari hasil terbaru. Klik Angka Jadi untuk menghitung fresh hasil yang siap disalin.
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
        <div className="relative mt-4 grid grid-cols-3 gap-2">
          <SummaryChip label="Pasaran" value={String(withRecs.length)} />
          <SummaryChip label="Pilihan" value={String(allComboCount)} />
          <SummaryChip label="Diperbarui" value={dataUpdatedAt ? formatAgo(dataUpdatedAt) : "-"} compact />
        </div>
      </div>

      {errorMessage && <StateBox text={errorMessage} tone="error" />}

      {!showInitialSkeleton && topItems.length > 0 && !search && (
        <section className="animate-soft-pop space-y-3">
          <SectionHeader icon={<Trophy size={15} />} title="Rekomendasi Sempurna" subtitle="Riwayat 15/15" />
          <div className="grid gap-2.5">
            {topItems.map(({ market, pair, combo }, index) => {
              const key = comboKey(market.marketId, pair.pair, combo.id);
              return (
                <ComboCard
                  key={key}
                  title={market.marketName}
                  subtitle={`${pair.pairLabel} · ${combo.label}`}
                  combo={combo}
                  state={angkaJadi[key]}
                  index={index}
                  onOpen={() => handleOpenAngkaJadi(key, market.marketId, pair.pair, combo.filters)}
                  onCopy={() => handleCopyAngkaJadi(key)}
                />
              );
            })}
          </div>
        </section>
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

      <section className="space-y-3">
        <SectionHeader icon={<Coins size={15} />} title="Semua Pasaran" subtitle={`${filtered.length} pasaran tampil`} />
        <div className="min-h-[40svh] space-y-2.5">
          {showInitialSkeleton ? (
            Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
          ) : filtered.length === 0 ? (
            <StateBox text={search ? "Pasaran tidak ditemukan" : "Belum ada rekomendasi yang memenuhi kriteria"} />
          ) : (
            filtered.map((market, index) => (
              <MarketBlock
                key={market.marketId}
                market={market}
                index={index}
                open={openId === market.marketId}
                onToggle={() => setOpenId((prev) => (prev === market.marketId ? null : market.marketId))}
                angkaJadi={angkaJadi}
                onOpenAngkaJadi={handleOpenAngkaJadi}
                onCopyAngkaJadi={handleCopyAngkaJadi}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryChip({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2 text-center">
      <p className="num accent-text truncate text-sm font-black">{value}</p>
      <p className={`mt-0.5 truncate font-bold uppercase tracking-wide text-text-soft ${compact ? "text-[8px]" : "text-[9px]"}`}>{label}</p>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <div className="flex min-w-0 items-center gap-2">
        <span className="accent-bg-soft accent-text flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10">{icon}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-text">{title}</p>
          <p className="truncate text-[10px] font-semibold text-text-soft">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function StateBox({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "error" }) {
  return (
    <div className={`animate-soft-pop rounded-3xl border p-4 text-center text-xs font-bold ${tone === "error" ? "border-danger/30 bg-danger/10 text-danger" : "border-dashed text-text-muted"}`}>
      {text}
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-border-soft bg-white/[0.035] px-2 py-1 text-[9px] font-black uppercase tracking-wide text-text-soft">
      {label} <span className="text-text-muted">{value}</span>
    </span>
  );
}

function AngkaJadiPanel({ state, onCopy }: { state?: AngkaJadiState; onCopy: () => void }) {
  if (state?.loading) {
    return <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-border-soft bg-black/20 p-4 text-xs font-black uppercase tracking-wide text-text-muted"><Loader2 size={16} className="animate-spin" /> Menghitung Angka Jadi</div>;
  }
  if (state?.error) return <div className="mt-3 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-center text-xs font-bold text-danger">{state.error}</div>;
  const lines = state?.result?.lines || [];
  if (!lines.length) return null;
  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-border-soft bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="display text-xs text-text">Angka Jadi</span>
        <span className="accent-bg-soft accent-text rounded-full px-3 py-1 text-[11px] font-black">{lines.length} LINE</span>
      </div>
      <div className="num accent-text max-h-[220px] overflow-y-auto rounded-2xl border border-border-soft bg-black/30 p-3 text-sm font-bold leading-8">{lineDisplayText(lines)}</div>
      <button type="button" onClick={onCopy} className="accent-bg-soft accent-text flex w-full items-center justify-center gap-2 rounded-2xl p-3 text-xs font-black uppercase tracking-wider">
        <Copy size={16} /> {state?.copied ? "Tersalin" : "Copy Angka Jadi"}
      </button>
    </div>
  );
}

function ComboCard({ title, subtitle, combo, state, index, onOpen, onCopy }: { title: string; subtitle: string; combo: InvestCombo; state?: AngkaJadiState; index: number; onOpen: () => void; onCopy: () => void }) {
  return (
    <div className="animate-soft-pop depth-1 rounded-3xl border p-3.5" style={{ animationDelay: `${Math.min(index, 10) * 24}ms` }}>
      <button type="button" onClick={onOpen} className="pressable w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="accent-bg-soft accent-text rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide">{comboStrengthLabel(combo.avgWins15)}</span>
            </div>
            <p className="display mt-2 truncate text-sm text-text">{title}</p>
            <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug text-text-muted">{subtitle}</p>
          </div>
          <div className="accent-bg-soft accent-text flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-2 text-[10px] font-black uppercase tracking-wide">
            Angka Jadi <ChevronDown size={13} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <MetricChip label="Riwayat" value={`${formatWins15(combo.avgWins15)}/15`} />
          <MetricChip label="Line" value={String(state?.result?.lines?.length || "-")} />
          <MetricChip label="Skor" value={formatScore(combo.avgScore)} />
        </div>
      </button>
      <AngkaJadiPanel state={state} onCopy={onCopy} />
    </div>
  );
}

function MarketBlock({ market, index, open, onToggle, angkaJadi, onOpenAngkaJadi, onCopyAngkaJadi }: { market: InvestMarket; index: number; open: boolean; onToggle: () => void; angkaJadi: Record<string, AngkaJadiState>; onOpenAngkaJadi: (key: string, marketId: string, pair: InvestPair["pair"], filters: InvestFilter[]) => void; onCopyAngkaJadi: (key: string) => void }) {
  const total = market.pairs.reduce((sum, p) => sum + p.combos.length, 0);
  const best = market.pairs.flatMap((p) => p.combos).sort((a, b) => b.avgWins15 - a.avgWins15)[0];
  return (
    <div className="animate-soft-pop depth-1 overflow-hidden rounded-2xl border" style={{ animationDelay: `${Math.min(index, 10) * 24}ms` }}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="pressable flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/[0.04]">
        <div className="min-w-0">
          <h3 className="display truncate text-base text-text">{market.marketName}</h3>
          {best && <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-text-soft">Terbaik {formatWins15(best.avgWins15)}/15</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="num accent-bg-soft accent-text rounded-full px-2.5 py-1 text-[11px] font-black">{total}</span>
          <ChevronDown size={18} className={`text-text-soft transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="animate-fade-in space-y-4 border-t border-border-soft px-4 pb-4 pt-3.5">
          {market.pairs.map((pair) => (
            <div key={pair.pair}>
              <div className="mb-2 flex items-center gap-2">
                <span className="accent-text text-[11px] font-black uppercase tracking-wide">{pair.pairLabel}</span>
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-text-soft">{pair.combos.length ? `${pair.combos.length} pilihan` : ""}</span>
              </div>
              <div className="space-y-2">
                {pair.combos.map((combo) => {
                  const key = comboKey(market.marketId, pair.pair, combo.id);
                  return (
                    <ComboCard
                      key={key}
                      title={combo.label}
                      subtitle={pair.pairLabel}
                      combo={combo}
                      state={angkaJadi[key]}
                      index={0}
                      onOpen={() => onOpenAngkaJadi(key, market.marketId, pair.pair, combo.filters)}
                      onCopy={() => onCopyAngkaJadi(key)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
