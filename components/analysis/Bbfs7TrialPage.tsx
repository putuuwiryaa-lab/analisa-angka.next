"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Loader2, Play, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/Button";
import {
  MARKETS_GC_TIME,
  MARKETS_QUERY_KEY,
  MARKETS_STALE_TIME,
  extractHistoryData,
  fetchMarkets,
  findMarketByIdOrName,
  parseHistoryTokens,
} from "@/lib/markets/client";
import { BBFS7_FORMULAS, runBbfs7WalkForward, type TargetPair } from "@/lib/analysis/bbfs7Trial";

const TARGET_OPTIONS: Array<{ key: TargetPair; label: string }> = [
  { key: "depan", label: "2D Depan" },
  { key: "tengah", label: "2D Tengah" },
  { key: "belakang", label: "2D Belakang" },
];

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function percent(value: number) {
  return `${value.toFixed(2)}%`;
}

export function Bbfs7TrialPage({ marketId }: { marketId: string }) {
  const router = useRouter();
  const { token } = useAuth();
  const decodedMarketId = safeDecode(marketId);
  const [targetPair, setTargetPair] = useState<TargetPair>("belakang");
  const [hasRun, setHasRun] = useState(false);

  const { data: markets = [], isPending, error } = useQuery({
    queryKey: [...MARKETS_QUERY_KEY, "bbfs7"],
    queryFn: () => fetchMarkets(token || ""),
    enabled: Boolean(token),
    staleTime: MARKETS_STALE_TIME,
    gcTime: MARKETS_GC_TIME,
    placeholderData: keepPreviousData,
  });

  const formulaCount = BBFS7_FORMULAS.length;
  const market = useMemo(() => findMarketByIdOrName(markets, decodedMarketId), [markets, decodedMarketId]);
  const history = useMemo(() => (market ? parseHistoryTokens(extractHistoryData(market)) : []), [market]);
  const result = useMemo(() => {
    if (!hasRun) return null;
    return runBbfs7WalkForward(history, targetPair, { startWindow: 14, step: 7, maxWindow: 140 });
  }, [hasRun, history, targetPair]);

  const selected = result?.selectedFormula || null;
  const latestWindow = result?.windows[result.windows.length - 1] || null;
  const topRanking = latestWindow?.ranking.slice(0, 10) || [];
  const errorMessage = error instanceof Error ? error.message : "";

  return (
    <div data-mode="bbfs7_trial" className="animate-rise pb-8">
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => router.push("/rekomendasi")}>
        <ArrowLeft size={16} /> Invest
      </Button>

      <div className="animate-soft-pop depth-1 mb-5 rounded-3xl border p-4">
        <div className="depth-2 rounded-3xl border px-4 py-6 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-accent">BBFS 7D</p>
          <h3 className="display mt-2 break-words text-2xl text-text sm:text-3xl">{market?.name || decodedMarketId}</h3>
          <p className="mt-2 text-xs font-semibold text-text-muted">{formulaCount} rumus · walk-forward 14, 21, 28, ...</p>
        </div>
      </div>

      {errorMessage && (
        <div className="animate-rise my-4 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-center text-xs font-bold text-danger">
          {errorMessage}
        </div>
      )}

      <div className="animate-soft-pop depth-1 mb-4 rounded-3xl border p-4">
        <span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-text-soft">Posisi Target</span>
        <div className="grid grid-cols-3 gap-2">
          {TARGET_OPTIONS.map((option) => {
            const active = option.key === targetPair;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  setTargetPair(option.key);
                  setHasRun(false);
                }}
                className={
                  active
                    ? "pressable accent-bg-soft accent-text min-h-12 rounded-2xl border px-2 text-xs font-black"
                    : "pressable min-h-12 rounded-2xl border px-2 text-xs font-bold text-text-muted hover:bg-white/[0.06] hover:text-text"
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-border-soft p-3">
            <p className="text-[10px] font-black uppercase text-text-soft">Result</p>
            <p className="num mt-1 text-xl font-black text-text">{history.length}</p>
          </div>
          <div className="rounded-2xl border border-border-soft p-3">
            <p className="text-[10px] font-black uppercase text-text-soft">Transisi</p>
            <p className="num mt-1 text-xl font-black text-text">{Math.max(history.length - 1, 0)}</p>
          </div>
          <div className="rounded-2xl border border-border-soft p-3">
            <p className="text-[10px] font-black uppercase text-text-soft">Rumus</p>
            <p className="num mt-1 text-xl font-black text-text">{formulaCount}</p>
          </div>
        </div>

        <Button className="mt-4 h-13 w-full rounded-2xl font-black" disabled={isPending || !market || history.length < 15} onClick={() => setHasRun(true)}>
          {isPending ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />} Hitung BBFS 7D
        </Button>
        {!market && !isPending && <p className="mt-3 text-center text-xs font-bold text-danger">Pasaran tidak ditemukan.</p>}
        {market && history.length < 15 && <p className="mt-3 text-center text-xs font-bold text-danger">Minimal butuh 15 result untuk hitung 14 transisi.</p>}
      </div>

      {!hasRun && (
        <div className="animate-soft-pop rounded-3xl border border-dashed p-6 text-center text-xs font-semibold text-text-muted">
          Pilih posisi, lalu tekan Hitung BBFS 7D. Sistem akan mengevaluasi {formulaCount} rumus di pasaran ini.
        </div>
      )}

      {result && selected && (
        <div className="space-y-4">
          <div className="animate-soft-pop depth-1 rounded-3xl border p-4">
            <div className="flex items-start gap-3">
              <div className="depth-3 accent-text flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border">
                <Trophy size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-text-soft">Rumus Terpilih</p>
                <h3 className="mt-1 text-base font-black text-text">{selected.formulaCode} — {selected.formulaName}</h3>
                <p className="mt-1 text-xs font-semibold text-text-muted">Window {result.selectedWindow} transisi · {selected.masuk}/{selected.total} MASUK</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-border-soft p-3">
                <p className="text-[10px] font-black uppercase text-text-soft">MASUK</p>
                <p className="num mt-1 text-2xl font-black text-accent">{selected.masuk}</p>
              </div>
              <div className="rounded-2xl border border-border-soft p-3">
                <p className="text-[10px] font-black uppercase text-text-soft">ZONK</p>
                <p className="num mt-1 text-2xl font-black text-text">{selected.zonk}</p>
              </div>
              <div className="rounded-2xl border border-border-soft p-3">
                <p className="text-[10px] font-black uppercase text-text-soft">Winrate</p>
                <p className="num mt-1 text-2xl font-black text-accent">{percent(selected.winrate)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-border-soft p-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-soft">BBFS 7D Berikutnya</p>
              <p className="num mt-2 text-4xl font-black tracking-[0.14em] text-accent">{result.nextBbfsDigits}</p>
              <p className="mt-2 text-xs font-semibold text-text-muted">Dasar result terbaru: {result.latestResult || "----"}</p>
            </div>
          </div>

          <div className="animate-soft-pop depth-1 rounded-3xl border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-text-soft">Walk Forward</p>
                <p className="mt-1 text-xs font-semibold text-text-muted">Naik 14 → 21 → 28 sampai rumus tidak seri.</p>
              </div>
              <ChevronDown size={18} className="text-text-soft" />
            </div>
            <div className="space-y-2">
              {result.windows.map((window) => (
                <div key={window.window} className="rounded-2xl border border-border-soft p-3 text-xs">
                  <div className="flex items-center justify-between gap-3 font-black text-text">
                    <span>Window {window.window}</span>
                    <span className={window.isTie ? "text-text-muted" : "text-accent"}>{window.isTie ? "SERI" : "TERPILIH"}</span>
                  </div>
                  <p className="mt-1 text-text-muted">
                    Top: {window.ranking[0]?.formulaCode || "-"} · {window.ranking[0]?.masuk || 0}/{window.ranking[0]?.total || 0} MASUK
                    {window.isTie ? ` · seri ${window.tiedFormulaCodes.slice(0, 6).join(", ")}${window.tiedFormulaCodes.length > 6 ? "..." : ""}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-soft-pop depth-1 rounded-3xl border p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-text-soft">Ranking Top 10</p>
            <div className="space-y-2">
              {topRanking.map((item, index) => (
                <div key={item.formulaCode} className="grid grid-cols-[34px_1fr_auto] items-center gap-2 rounded-2xl border border-border-soft p-3 text-xs">
                  <span className="num font-black text-text-soft">#{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate font-black text-text">{item.formulaCode} — {item.formulaName}</p>
                    <p className="text-text-muted">Streak zonk max: {item.maxZonkStreak} · 7 terbaru: {item.latest7Masuk}/7</p>
                  </div>
                  <span className="num font-black text-accent">{item.masuk}/{item.total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {result && !selected && (
        <div className="animate-soft-pop rounded-3xl border border-dashed p-6 text-center text-xs font-semibold text-text-muted">
          {result.note}
        </div>
      )}
    </div>
  );
}
