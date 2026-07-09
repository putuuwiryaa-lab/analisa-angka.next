"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ClipboardCopy, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";

type Pair = "depan" | "tengah" | "belakang";

type InvestFilter = { kind: string; param: number };

type InvestCombo = {
  id: string;
  label: string;
  expectedLines: number;
  cachedLineCount?: number;
  hitRate: number;
  avgWins15: number;
  avgWinsLast5?: number;
  maxLossStreak?: number;
  avgScore: number;
  recommendationScore?: number;
  recommendationStatus?: string;
  riskNote?: string;
  filters: InvestFilter[];
};

type InvestTopCombo = {
  pair: Pair;
  pairLabel: string;
  combo: InvestCombo;
};

type InvestMarketOverview = {
  marketId: string;
  marketName: string;
  hasAny: boolean;
  totalCombos: number;
  bestWins15: number;
  bestScore: number;
  topCombos: InvestTopCombo[];
};

type InvestOverviewResponse = {
  markets: InvestMarketOverview[];
  error?: string;
};

type InvestRow = {
  marketId: string;
  marketName: string;
  pair: Pair;
  pairLabel: string;
  combo: InvestCombo;
};

type AngkaState = {
  loading?: boolean;
  copied?: boolean;
  error?: string;
  lines?: string[];
  latestResult?: string;
};

const PAIR_OPTIONS: Array<{ key: Pair; label: string; short: string }> = [
  { key: "depan", label: "2D Depan", short: "Depan" },
  { key: "tengah", label: "2D Tengah", short: "Tengah" },
  { key: "belakang", label: "2D Belakang", short: "Belakang" },
];

function rowKey(row: InvestRow) {
  return `${row.marketId}:${row.pair}:${row.combo.id}`;
}

function formatWins15(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

function lineCountOf(combo: InvestCombo) {
  return Number(combo.cachedLineCount || combo.expectedLines || 0);
}

function lineText(lines: string[] = []) {
  return lines.join("*");
}

function shortComboLabel(value: string) {
  return value
    .replace(/Mati Kepala/g, "OFF KPL")
    .replace(/Mati Ekor/g, "OFF EKR")
    .replace(/Shio Mati/g, "OFF Shio")
    .replace(/Jumlah Mati/g, "OFF Jumlah")
    .replace(/Ganjil\/Genap/g, "Ganjil Genap")
    .replace(/Besar\/Kecil/g, "Besar Kecil")
    .replace(/\s+/g, " ")
    .trim();
}

function bestRowForPair(market: InvestMarketOverview, pair: Pair): InvestRow | null {
  const item = market.topCombos.find((combo) => combo.pair === pair);
  if (!item?.combo) return null;

  return {
    marketId: market.marketId,
    marketName: market.marketName,
    pair,
    pairLabel: item.pairLabel,
    combo: item.combo,
  };
}

async function fetchInvestOverview(): Promise<InvestOverviewResponse> {
  const response = await fetch("/api/invest", { cache: "no-store" });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(json.error || "Gagal memuat rekomendasi invest.");
  }

  return json as InvestOverviewResponse;
}

async function fetchAngkaJadi(row: InvestRow) {
  const response = await fetch("/api/invest/angka-jadi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      marketId: row.marketId,
      pair: row.pair,
      filters: row.combo.filters,
    }),
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok || !json.success) {
    throw new Error(json.error || "Angka jadi belum bisa ditampilkan.");
  }

  return {
    lines: Array.isArray(json.lines) ? (json.lines as string[]) : [],
    latestResult: String(json.latest_result || "----"),
  };
}

export default function RekomendasiPage() {
  const router = useRouter();
  const [pair, setPair] = useState<Pair>("belakang");
  const [search, setSearch] = useState("");
  const [angkaByKey, setAngkaByKey] = useState<Record<string, AngkaState>>({});

  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ["invest-overview-lite"],
    queryFn: fetchInvestOverview,
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.markets || [])
      .map((market) => bestRowForPair(market, pair))
      .filter(Boolean)
      .filter((row) => {
        if (!row) return false;
        if (!q) return true;
        return row.marketId.toLowerCase().includes(q) || row.marketName.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (!a || !b) return 0;
        return (
          b.combo.avgWins15 - a.combo.avgWins15 ||
          Number(b.combo.recommendationScore || 0) - Number(a.combo.recommendationScore || 0) ||
          b.combo.avgScore - a.combo.avgScore ||
          a.marketName.localeCompare(b.marketName)
        );
      }) as InvestRow[];
  }, [data?.markets, pair, search]);

  const activePairLabel = PAIR_OPTIONS.find((item) => item.key === pair)?.label || "2D Belakang";
  const errorMessage = error instanceof Error ? error.message : "";
  const showSkeleton = isPending && !data;

  async function handleGenerate(row: InvestRow) {
    const key = rowKey(row);
    const current = angkaByKey[key];
    if (current?.loading) return;

    setAngkaByKey((prev) => ({ ...prev, [key]: { ...prev[key], loading: true, error: undefined } }));

    try {
      const result = await fetchAngkaJadi(row);
      setAngkaByKey((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          loading: false,
          lines: result.lines,
          latestResult: result.latestResult,
        },
      }));
    } catch (e) {
      setAngkaByKey((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          loading: false,
          error: e instanceof Error ? e.message : "Angka jadi belum bisa ditampilkan.",
        },
      }));
    }
  }

  async function copyRow(row: InvestRow) {
    const key = rowKey(row);
    const lines = angkaByKey[key]?.lines || [];
    if (!lines.length) return;

    await navigator.clipboard?.writeText(lineText(lines));
    setAngkaByKey((prev) => ({ ...prev, [key]: { ...prev[key], copied: true } }));
    window.setTimeout(() => {
      setAngkaByKey((prev) => ({ ...prev, [key]: { ...prev[key], copied: false } }));
    }, 1200);
  }

  return (
    <div data-mode="invest" className="animate-rise space-y-4 pb-5">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
          <ArrowLeft size={16} /> Beranda
        </Button>
        <button
          type="button"
          onClick={() => void refetch()}
          className="pressable depth-3 flex h-11 w-11 items-center justify-center rounded-2xl border text-text-muted hover:border-border hover:bg-white/[0.075]"
          aria-label="Perbarui Invest"
        >
          <RefreshCw size={17} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      <section className="depth-accent animate-soft-pop rounded-3xl border p-4">
        <div className="text-center">
          <p className="accent-text text-[10px] font-black uppercase tracking-[0.22em]">Rekomendasi Invest</p>
          <h1 className="display mt-2 text-3xl text-text">Invest 2D</h1>
          <p className="mx-auto mt-2 max-w-[34ch] text-xs font-semibold leading-relaxed text-text-muted">
            Pilih posisi dan pasaran, lalu lihat angka jadi terbaik.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {PAIR_OPTIONS.map((item) => {
            const active = item.key === pair;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setPair(item.key);
                  setSearch("");
                }}
                className={
                  active
                    ? "pressable accent-bg-soft accent-border min-h-12 rounded-2xl border px-2 text-center text-[11px] font-black uppercase tracking-wide text-text"
                    : "pressable depth-3 min-h-12 rounded-2xl border px-2 text-center text-[11px] font-black uppercase tracking-wide text-text-muted hover:border-border hover:bg-white/[0.06]"
                }
              >
                {item.short}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <SummaryChip label="Posisi" value={activePairLabel.replace("2D ", "")} />
          <SummaryChip label="Pasaran" value={String(rows.length)} />
        </div>
      </section>

      {errorMessage ? <StateBox text={errorMessage} tone="error" /> : null}

      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-soft" />
        <Input
          type="text"
          placeholder="Cari pasaran…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-14 rounded-3xl pl-11 text-sm font-bold"
        />
      </div>

      <section className="min-h-[50svh] space-y-2.5">
        {showSkeleton ? (
          Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-[132px] rounded-3xl" />)
        ) : rows.length === 0 ? (
          <StateBox text={search ? "Pasaran tidak ditemukan." : "Belum ada rekomendasi untuk posisi ini."} />
        ) : (
          rows.map((row, index) => {
            const state = angkaByKey[rowKey(row)] || {};
            return (
              <InvestLiteCard
                key={rowKey(row)}
                row={row}
                index={index}
                state={state}
                onGenerate={() => handleGenerate(row)}
                onCopy={() => copyRow(row)}
              />
            );
          })
        )}
      </section>
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 px-2 py-2 text-center">
      <p className="num accent-text truncate text-sm font-black">{value}</p>
      <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wide text-text-soft">{label}</p>
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

function InvestLiteCard({
  row,
  index,
  state,
  onGenerate,
  onCopy,
}: {
  row: InvestRow;
  index: number;
  state: AngkaState;
  onGenerate: () => void;
  onCopy: () => void;
}) {
  const lines = state.lines || [];
  const hasLines = lines.length > 0;

  return (
    <article className="animate-soft-pop depth-1 rounded-3xl border p-3.5" style={{ animationDelay: `${Math.min(index, 10) * 22}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="display truncate text-base text-text">{row.marketName}</h2>
          <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug text-text-muted">{shortComboLabel(row.combo.label)}</p>
        </div>
        <span className="accent-bg-soft accent-text shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide">
          {formatWins15(row.combo.avgWins15)}/15
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <MetricChip label="Estimasi" value={`${lineCountOf(row.combo) || "-"} line`} />
        <MetricChip label="Posisi" value={row.pairLabel.replace("2D ", "")} />
        {state.latestResult ? <MetricChip label="Last" value={state.latestResult} /> : null}
      </div>

      {state.error ? (
        <div className="mt-3 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-center text-xs font-bold text-danger">{state.error}</div>
      ) : null}

      {hasLines ? (
        <div className="num accent-text mt-3 max-h-[150px] overflow-y-auto rounded-2xl border border-border-soft bg-black/25 p-3 text-[13px] font-black leading-7">
          {lineText(lines)}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={state.loading}
          className="pressable depth-3 min-h-11 rounded-2xl border px-3 text-[11px] font-black uppercase tracking-wide text-text-muted disabled:opacity-45"
        >
          {state.loading ? "Menghitung…" : hasLines ? "Lihat Ulang" : "Lihat Angka"}
        </button>
        <button
          type="button"
          onClick={onCopy}
          disabled={!hasLines}
          className="pressable accent-bg-soft accent-text flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 text-[11px] font-black uppercase tracking-wide disabled:opacity-45"
        >
          {state.copied ? <Check size={15} /> : <ClipboardCopy size={15} />}
          {state.copied ? "Tersalin" : "Copy"}
        </button>
      </div>
    </article>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-border-soft bg-white/[0.035] px-2 py-1 text-[9px] font-black uppercase tracking-wide text-text-soft">
      {label} <span className="text-text-muted">{value}</span>
    </span>
  );
}
