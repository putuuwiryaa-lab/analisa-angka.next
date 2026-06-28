"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { AnalysisPageChrome } from "@/components/analysis/AnalysisPageChrome";
import { TargetPairSelector } from "@/components/analysis/ScopeSelectors";
import {
  MARKETS_GC_TIME,
  MARKETS_QUERY_KEY,
  MARKETS_STALE_TIME,
  extractHistoryData,
  fetchMarkets,
  findMarketByIdOrName,
  parseHistoryTokens,
} from "@/lib/markets/client";
import {
  BBFS7_TRADITIONAL_FORMULAS,
  BBFS7_TRADITIONAL_THRESHOLD,
  BBFS7_TRADITIONAL_WINDOW,
  runBbfs7TraditionalWalkForward,
  type TargetPair,
} from "@/lib/analysis/bbfs7Traditional";

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function Bbfs7TraditionalPage({ marketId }: { marketId: string }) {
  const router = useRouter();
  const { token } = useAuth();
  const decodedMarketId = safeDecode(marketId);
  const [targetPair, setTargetPair] = useState<TargetPair | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const { data: markets = [], isPending, error } = useQuery({
    queryKey: [...MARKETS_QUERY_KEY, "bbfs7-tradisional"],
    queryFn: () => fetchMarkets(token || ""),
    enabled: Boolean(token),
    staleTime: MARKETS_STALE_TIME,
    gcTime: MARKETS_GC_TIME,
    placeholderData: keepPreviousData,
  });

  const formulaCount = BBFS7_TRADITIONAL_FORMULAS.length;
  const market = useMemo(() => findMarketByIdOrName(markets, decodedMarketId), [markets, decodedMarketId]);
  const history = useMemo(() => (market ? parseHistoryTokens(extractHistoryData(market)) : []), [market]);
  const hasEnoughHistory = history.length >= BBFS7_TRADITIONAL_WINDOW + 3;
  const canStart = Boolean(targetPair && market && hasEnoughHistory && !hasRun);
  const result = useMemo(() => {
    if (!hasRun || !targetPair) return null;
    return runBbfs7TraditionalWalkForward(history, targetPair);
  }, [hasRun, history, targetPair]);

  const topRanking = result?.ranking.slice(0, 10) || [];
  const topLolos = result?.lolosFormulas.slice(0, 10) || [];
  const errorMessage = error instanceof Error ? error.message : "";

  return (
    <div data-mode="bbfs7_tradisional" className="animate-rise pb-8">
      <AnalysisPageChrome
        title="UJI COBA BBFS 7D RUMUS TRADISIONAL"
        icon="▧"
        marketId={market?.name || decodedMarketId}
        isAI={false}
        isBBFS={false}
        isRekapCustom={false}
        needsTargetPair
        analysisScope={null}
        targetPair={targetPair}
        customFocus={null}
        loading={isPending}
        canStartAnalyze={canStart}
        onBack={() => router.push(`/analyze/${encodeURIComponent(decodedMarketId)}`)}
        onStartAnalyze={() => setHasRun(true)}
        onAIScopeReset={() => {}}
        onTargetPairReset={() => {
          setTargetPair(null);
          setHasRun(false);
        }}
        onBBFSScopeReset={() => {}}
        onCustomFocusReset={() => {}}
      />

      {errorMessage && (
        <div className="animate-rise my-4 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-center text-xs font-bold text-danger">
          {errorMessage}
        </div>
      )}

      {!targetPair && <TargetPairSelector onSelect={(pair) => setTargetPair(pair)} />}

      {targetPair && !hasRun && (
        <div className="animate-soft-pop depth-1 rounded-3xl border p-4 text-center text-xs font-semibold text-text-muted">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-border-soft p-3">
              <p className="text-[10px] font-black uppercase text-text-soft">Result</p>
              <p className="num mt-1 text-xl font-black text-text">{history.length}</p>
            </div>
            <div className="rounded-2xl border border-border-soft p-3">
              <p className="text-[10px] font-black uppercase text-text-soft">Transisi</p>
              <p className="num mt-1 text-xl font-black text-text">{Math.max(history.length - 3, 0)}</p>
            </div>
            <div className="rounded-2xl border border-border-soft p-3">
              <p className="text-[10px] font-black uppercase text-text-soft">Rumus</p>
              <p className="num mt-1 text-xl font-black text-text">{formulaCount}</p>
            </div>
          </div>
          <p className="mt-4 leading-relaxed">
            Tekan Mulai Analisa. Sistem menguji {formulaCount} rumus tradisional, minimal {BBFS7_TRADITIONAL_THRESHOLD}/{BBFS7_TRADITIONAL_WINDOW} baru masuk voting.
          </p>
          {!market && <p className="mt-3 font-bold text-danger">Pasaran tidak ditemukan.</p>}
          {market && !hasEnoughHistory && (
            <p className="mt-3 font-bold text-danger">
              Minimal butuh {BBFS7_TRADITIONAL_WINDOW + 3} result untuk walk-forward {BBFS7_TRADITIONAL_WINDOW} data.
            </p>
          )}
        </div>
      )}

      {result && result.nextBbfsDigits && (
        <div className="space-y-4">
          <div className="animate-soft-pop depth-accent relative overflow-hidden rounded-3xl border p-4">
            <div className="accent-bg-soft absolute -right-16 -top-16 h-44 w-44 rounded-full blur-3xl" />
            <div className="relative mb-3 flex items-center justify-between gap-3">
              <div className="depth-3 accent-text inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide">
                <Trophy size={12} /> Hasil Utama
              </div>
              <span className="depth-3 accent-text rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide">
                {result.lolosCount}/{result.formulaCount} Lolos
              </span>
            </div>
            <div className="depth-2 relative rounded-3xl border p-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-soft">BBFS 7D Voting</p>
              <p className="num mt-2 text-4xl font-black tracking-[0.14em] text-accent">{result.nextBbfsDigits}</p>
              <p className="mt-2 text-xs font-semibold text-text-muted">
                Walk-forward {result.window} data · threshold {result.threshold}/{result.window} · result terbaru {result.latestResult || "----"}
              </p>
            </div>
          </div>

          <div className="animate-soft-pop depth-1 rounded-3xl border p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-text-soft">Vote Digit</p>
            <div className="grid grid-cols-5 gap-2">
              {result.voteRanking.map((item) => (
                <div key={item.digit} className="rounded-2xl border border-border-soft p-3 text-center">
                  <p className="num text-xl font-black text-text">{item.digit}</p>
                  <p className="mt-1 text-[10px] font-black uppercase text-text-soft">{item.vote} vote</p>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-soft-pop depth-1 rounded-3xl border p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-text-soft">Rumus Lolos</p>
            <div className="space-y-2">
              {topLolos.map((item, index) => (
                <div key={item.formulaCode} className="grid grid-cols-[34px_1fr_auto] items-center gap-2 rounded-2xl border border-border-soft p-3 text-xs">
                  <span className="num font-black text-text-soft">#{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate font-black text-text">{item.formulaCode} — {item.formulaName}</p>
                    <p className="text-text-muted">BBFS {item.bbfsDigits} · zonk max {item.maxZonkStreak} · 7 terbaru {item.latest7Masuk}/7</p>
                  </div>
                  <span className="num font-black text-accent">{item.masuk}/{item.total}</span>
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
                    <p className="text-text-muted">{item.lolos ? "LOLOS" : "TIDAK LOLOS"} · BBFS {item.bbfsDigits}</p>
                  </div>
                  <span className={item.lolos ? "num font-black text-accent" : "num font-black text-text-soft"}>{item.masuk}/{item.total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {result && !result.nextBbfsDigits && (
        <div className="animate-soft-pop rounded-3xl border border-dashed p-6 text-center text-xs font-semibold text-text-muted">
          {result.note}
        </div>
      )}
    </div>
  );
}
