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

  const market = useMemo(() => findMarketByIdOrName(markets, decodedMarketId), [markets, decodedMarketId]);
  const history = useMemo(() => (market ? parseHistoryTokens(extractHistoryData(market)) : []), [market]);
  const hasEnoughHistory = history.length >= BBFS7_TRADITIONAL_WINDOW + 3;
  const result = useMemo(() => {
    if (!targetPair || !market || !hasEnoughHistory) return null;
    return runBbfs7TraditionalWalkForward(history, targetPair);
  }, [targetPair, market, hasEnoughHistory, history]);

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
        title="BBFS 7D TRADISIONAL"
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
        canStartAnalyze={false}
        onBack={() => router.push(`/analyze/${encodeURIComponent(decodedMarketId)}`)}
        onStartAnalyze={() => {}}
        onAIScopeReset={() => {}}
        onTargetPairReset={() => {
          setTargetPair(null);
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

      {targetPair && market && !hasEnoughHistory && (
        <div className="animate-soft-pop rounded-3xl border border-dashed p-6 text-center text-xs font-semibold text-text-muted">
          Minimal butuh {BBFS7_TRADITIONAL_WINDOW + 3} result untuk walk-forward {BBFS7_TRADITIONAL_WINDOW} data.
        </div>
      )}

      {targetPair && !market && !isPending && (
        <div className="animate-soft-pop rounded-3xl border border-dashed p-6 text-center text-xs font-semibold text-text-muted">
          Pasaran tidak ditemukan.
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
          setOpen={setAngkaJadiOpen as never}
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
