"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { AnalysisPageChrome } from "@/components/analysis/AnalysisPageChrome";
import { AnalysisResult } from "@/components/analysis/AnalysisResult";
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

function scopeFromPair(pair: TargetPair) {
  if (pair === "depan") return "2d_depan" as const;
  if (pair === "tengah") return "2d_tengah" as const;
  return "2d_belakang" as const;
}

export function Bbfs7TraditionalPage({ marketId }: { marketId: string }) {
  const router = useRouter();
  const { token } = useAuth();
  const decodedMarketId = safeDecode(marketId);
  const [targetPair, setTargetPair] = useState<TargetPair | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [detailValidationOpen, setDetailValidationOpen] = useState(false);
  const [angkaJadiOpen, setAngkaJadiOpen] = useState(false);

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

  const analysisResult = useMemo(() => {
    if (!result?.nextBbfsDigits || !targetPair) return null;
    return {
      result: result.nextBbfsDigits.split("").map(Number),
      stats: result.ranking.map((item) => ({
        name: `${item.formulaCode} — ${item.formulaName}${item.lolos ? "" : " (TIDAK LOLOS)"}`,
        hits: item.masuk,
      })),
      elitCount: result.lolosCount,
      analysis_scope: scopeFromPair(targetPair),
      targetPair,
      evaluationMode: "bbfs7_tradisional",
      evaluationParam: 7,
    };
  }, [result, targetPair]);

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
          setDetailValidationOpen(false);
          setAngkaJadiOpen(false);
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

      {analysisResult && targetPair && (
        <AnalysisResult
          type="bbfs7_tradisional"
          result={analysisResult}
          param={7}
          marketId={decodedMarketId}
          label="UJI COBA BBFS 7D RUMUS TRADISIONAL"
          targetPair={targetPair}
          analysisScope={scopeFromPair(targetPair)}
          detailValidationOpen={detailValidationOpen}
          setDetailValidationOpen={setDetailValidationOpen}
          angkaJadiOpen={angkaJadiOpen}
          setAngkaJadiOpen={setAngkaJadiOpen}
        />
      )}

      {result && !result.nextBbfsDigits && (
        <div className="animate-soft-pop rounded-3xl border border-dashed p-6 text-center text-xs font-semibold text-text-muted">
          {result.note}
        </div>
      )}
    </div>
  );
}
