"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ClipboardCopy, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";

type Pair = "depan" | "tengah" | "belakang";

type InvestLineRow = {
  marketId: string;
  marketName: string;
  pair: Pair;
  pairLabel: string;
  comboId: string;
  comboLabel: string;
  avgWins15: number;
  avgWinsLast5: number;
  expectedLines: number;
  actualLines: number;
  avgScore: number;
  recommendationScore: number;
  recommendationStatus: string;
  riskNote: string;
  latestResult: string;
  lines: string[];
  error?: string;
};

type InvestLineResponse = {
  success: boolean;
  pair: Pair;
  pairLabel: string;
  rows: InvestLineRow[];
  count: number;
  generatedAt: string;
  error?: string;
};

const PAIR_OPTIONS: Array<{ key: Pair; label: string; short: string }> = [
  { key: "depan", label: "2D Depan", short: "Depan" },
  { key: "tengah", label: "2D Tengah", short: "Tengah" },
  { key: "belakang", label: "2D Belakang", short: "Belakang" },
];

function formatWins15(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

function formatAgo(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "-";

  const diff = Date.now() - time;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  return `${Math.floor(min / 60)} jam lalu`;
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

async function fetchInvestLines(pair: Pair): Promise<InvestLineResponse> {
  const params = new URLSearchParams({ pair, limit: "120" });
  const response = await fetch(`/api/invest/angka-jadi-list?${params.toString()}`, { cache: "no-store" });
  const json = await response.json().catch(() => ({}));

  if (!response.ok || !json.success) {
    throw new Error(json.error || "Gagal memuat Angka Jadi Invest.");
  }

  return json as InvestLineResponse;
}

export default function RekomendasiPage() {
  const router = useRouter();
  const [pair, setPair] = useState<Pair>("belakang");
  const [search, setSearch] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [copiedAll, setCopiedAll] = useState(false);

  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ["invest-angka-jadi-list", pair],
    queryFn: () => fetchInvestLines(pair),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const rows = data?.rows || [];
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.marketId.toLowerCase().includes(q) || row.marketName.toLowerCase().includes(q));
  }, [rows, search]);

  const activePairLabel = PAIR_OPTIONS.find((item) => item.key === pair)?.label || "2D Belakang";
  const errorMessage = error instanceof Error ? error.message : "";
  const showSkeleton = isPending && rows.length === 0;

  async function copyRow(row: InvestLineRow) {
    if (!row.lines.length) return;
    await navigator.clipboard?.writeText(lineText(row.lines));
    setCopiedKey(row.marketId);
    window.setTimeout(() => setCopiedKey(""), 1200);
  }

  async function copyAll() {
    const text = filteredRows
      .filter((row) => row.lines.length)
      .map((row) => `${row.marketName}\n${lineText(row.lines)}`)
      .join("\n\n");

    if (!text) return;

    await navigator.clipboard?.writeText(text);
    setCopiedAll(true);
    window.setTimeout(() => setCopiedAll(false), 1200);
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
          <p className="accent-text text-[10px] font-black uppercase tracking-[0.22em]">Invest 2D</p>
          <h1 className="display mt-2 text-3xl text-text">Angka Jadi</h1>
          <p className="mx-auto mt-2 max-w-[34ch] text-xs font-semibold leading-relaxed text-text-muted">
            Pilih posisi, lihat pasaran, lalu copy angka jadi terbaik.
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
                  setCopiedKey("");
                  setCopiedAll(false);
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

        <div className="mt-4 grid grid-cols-3 gap-2">
          <SummaryChip label="Posisi" value={activePairLabel.replace("2D ", "")} />
          <SummaryChip label="Pasaran" value={String(filteredRows.length)} />
          <SummaryChip label="Update" value={data?.generatedAt ? formatAgo(data.generatedAt) : "-"} compact />
        </div>
      </section>

      {errorMessage ? <StateBox text={errorMessage} tone="error" /> : null}

      <div className="grid grid-cols-[1fr_auto] gap-2">
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
        <button
          type="button"
          onClick={copyAll}
          disabled={!filteredRows.some((row) => row.lines.length)}
          className="pressable depth-3 min-h-12 rounded-2xl border px-3 text-[10px] font-black uppercase tracking-wide text-text-muted disabled:opacity-45"
        >
          {copiedAll ? "Tersalin" : "Copy Semua"}
        </button>
      </div>

      <section className="min-h-[50svh] space-y-2.5">
        {showSkeleton ? (
          Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-[172px] rounded-3xl" />)
        ) : filteredRows.length === 0 ? (
          <StateBox text={search ? "Pasaran tidak ditemukan." : "Belum ada Angka Jadi untuk posisi ini."} />
        ) : (
          filteredRows.map((row, index) => (
            <InvestLineCard
              key={`${row.marketId}-${row.pair}-${row.comboId}`}
              row={row}
              index={index}
              copied={copiedKey === row.marketId}
              onCopy={() => copyRow(row)}
            />
          ))
        )}
      </section>
    </div>
  );
}

function SummaryChip({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 px-2 py-2 text-center">
      <p className="num accent-text truncate text-sm font-black">{value}</p>
      <p className={`mt-0.5 truncate font-bold uppercase tracking-wide text-text-soft ${compact ? "text-[8px]" : "text-[9px]"}`}>{label}</p>
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

function InvestLineCard({ row, index, copied, onCopy }: { row: InvestLineRow; index: number; copied: boolean; onCopy: () => void }) {
  const hasLines = row.lines.length > 0;

  return (
    <article className="animate-soft-pop depth-1 rounded-3xl border p-3.5" style={{ animationDelay: `${Math.min(index, 10) * 22}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="display truncate text-base text-text">{row.marketName}</h2>
          <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug text-text-muted">{shortComboLabel(row.comboLabel)}</p>
        </div>
        <span className="accent-bg-soft accent-text shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide">
          {formatWins15(row.avgWins15)}/15
        </span>
      </div>

      {row.error ? (
        <div className="mt-3 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-center text-xs font-bold text-danger">{row.error}</div>
      ) : (
        <>
          <div className="num accent-text mt-3 max-h-[150px] overflow-y-auto rounded-2xl border border-border-soft bg-black/25 p-3 text-[13px] font-black leading-7">
            {hasLines ? lineText(row.lines) : "-"}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <MetricChip label="Line" value={String(row.actualLines || row.expectedLines || "-")} />
            <MetricChip label="Estimasi" value={String(row.expectedLines || "-")} />
            <MetricChip label="Last" value={row.latestResult || "----"} />
          </div>

          <button
            type="button"
            onClick={onCopy}
            disabled={!hasLines}
            className="pressable accent-bg-soft accent-text mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-wide disabled:opacity-45"
          >
            {copied ? <Check size={16} /> : <ClipboardCopy size={16} />}
            {copied ? "Tersalin" : "Copy Angka"}
          </button>
        </>
      )}
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
