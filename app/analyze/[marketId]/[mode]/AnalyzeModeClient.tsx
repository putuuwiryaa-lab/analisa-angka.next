"use client";

import { memo, useCallback } from "react";
import { ParamSelector } from "@/components/analysis/ParamSelector";
import { CustomDigitBuilder } from "@/components/analysis/CustomDigitBuilder";
import { RekapResult } from "@/components/analysis/RekapResult";
import { AnalysisResult } from "@/components/analysis/AnalysisResult";
import { AnalysisPageChrome } from "@/components/analysis/AnalysisPageChrome";
import { MODES, isModeKey, type ModeKey } from "@/components/analysis/modes";
import { useAnalysisController } from "@/components/analysis/useAnalysisController";
import { typeMeta } from "@/lib/analysis/constants";
import { WorkspacePlaceholder } from "@/components/layout/WorkspacePlaceholder";
import {
  AIScopeSelector,
  BBFSScopeSelector,
  RekapFocusSelector,
  TargetPairSelector,
} from "@/components/analysis/ScopeSelectors";

const MemoizedAnalysisPageChrome = memo(AnalysisPageChrome);
const MemoizedCustomDigitBuilder = memo(CustomDigitBuilder);
const MemoizedAnalysisResult = memo(AnalysisResult);
const MemoizedRekapResult = memo(RekapResult);

function StandardAnalyzeModePage({ marketId, type }: { marketId: string; type: ModeKey }) {
  const { title, Icon } = MODES[type];
  const { state, flags, handlers, custom } = useAnalysisController({ type, marketId });
  const { param, targetPair, analysisScope, loading, result, error, customFocus } = state;
  const handleStartAnalyze = useCallback(
    () => handlers.handleAnalyze(param || 1),
    [handlers.handleAnalyze, param],
  );

  return (
    <div data-mode={type} className="animate-rise desktop-workspace pb-8">
      <div className="desktop-controls">
        <MemoizedAnalysisPageChrome
          title={title}
          icon={Icon}
          marketId={marketId}
          isAI={flags.isAI}
          isBBFS={flags.isBBFS}
          isRekapCustom={flags.isRekapCustom}
          needsTargetPair={flags.needsTargetPair}
          analysisScope={analysisScope}
          targetPair={targetPair}
          customFocus={customFocus}
          loading={loading}
          canStartAnalyze={flags.canStartAnalyze}
          onBack={handlers.handleBack}
          onStartAnalyze={handleStartAnalyze}
          onAIScopeReset={handlers.resetScope}
          onTargetPairReset={handlers.handleTargetPairReset}
          onBBFSScopeReset={handlers.resetScope}
          onCustomFocusReset={handlers.handleCustomFocusReset}
        />

        {flags.showAIScopeSelector && <AIScopeSelector onSelect={handlers.handleScopeSelect} />}
        {flags.showTargetPairSelector && (
          <TargetPairSelector onSelect={handlers.handleTargetPairSelect} />
        )}
        {flags.showBBFSScopeSelector && <BBFSScopeSelector onSelect={handlers.handleScopeSelect} />}
        {flags.showRekapFocusSelector && (
          <RekapFocusSelector onSelect={handlers.selectCustomFocus} />
        )}

        {flags.showParamSelector && !flags.autoMode && (
          <ParamSelector
            type={type}
            param={param}
            analysisScope={analysisScope || "default"}
            onAnalyze={handlers.handleAnalyze}
          />
        )}

        {customFocus && (
          <MemoizedCustomDigitBuilder
            show={flags.showCustomDigitBuilder}
            marketId={marketId}
            customFocus={customFocus}
            loading={loading}
            onGenerate={handlers.handleCustomDigitGenerate}
            {...custom}
          />
        )}
      </div>
      <div className="desktop-results">
        {error && (
          <div className="animate-rise my-4 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-center text-xs font-bold text-danger">
            {error}
          </div>
        )}

        {result && type === "rekap" && <MemoizedRekapResult result={result} />}
        {result && type !== "rekap" && (
          <MemoizedAnalysisResult
            type={type}
            result={result}
            param={param}
            marketId={marketId}
            label={typeMeta[type]?.label || ""}
            targetPair={targetPair || "belakang"}
            analysisScope={analysisScope || "default"}
            detailValidationOpen={state.detailValidationOpen}
            setDetailValidationOpen={state.setDetailValidationOpen}
            angkaJadiOpen={state.angkaJadiOpen}
            setAngkaJadiOpen={state.setAngkaJadiOpen}
          />
        )}
        {!result && (
          <WorkspacePlaceholder
            title={loading ? "Memproses analisa…" : "Hasil Analisa"}
            description="Pilih target dan pengaturan di panel kiri. Hasil beserta riwayat evaluasinya akan tampil di sini."
            busy={loading}
          />
        )}
      </div>
    </div>
  );
}

export default function AnalyzeModeClient({ marketId, mode }: { marketId: string; mode: string }) {
  const type = isModeKey(mode) ? mode : "ai";
  return <StandardAnalyzeModePage marketId={marketId} type={type} />;
}
