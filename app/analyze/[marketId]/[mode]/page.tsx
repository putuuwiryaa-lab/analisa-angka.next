"use client";

import { use } from "react";
import { ParamSelector } from "@/components/analysis/ParamSelector";
import { CustomDigitBuilder } from "@/components/analysis/CustomDigitBuilder";
import { RekapResult } from "@/components/analysis/RekapResult";
import { AnalysisResult } from "@/components/analysis/AnalysisResult";
import { AnalysisPageChrome } from "@/components/analysis/AnalysisPageChrome";
import { MODES, isModeKey } from "@/components/analysis/modes";
import { useAnalysisController } from "@/components/analysis/useAnalysisController";
import { typeMeta } from "@/lib/analysis/constants";
import {
  AIScopeSelector,
  BBFSScopeSelector,
  RekapFocusSelector,
  TargetPairSelector,
} from "@/components/analysis/ScopeSelectors";

export default function AnalyzeModePage({
  params,
}: {
  params: Promise<{ marketId: string; mode: string }>;
}) {
  const { marketId, mode } = use(params);
  const type = isModeKey(mode) ? mode : "ai";
  const { title, emoji } = MODES[type];

  const { state, flags, handlers, custom } = useAnalysisController({ type, marketId });
  const { param, targetPair, analysisScope, loading, result, error, customFocus } = state;

  return (
    <div data-mode={type} className="animate-rise pb-8">
      <AnalysisPageChrome
        title={title}
        icon={emoji}
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
        onStartAnalyze={() => handlers.handleAnalyze(param || 1)}
        onAIScopeReset={handlers.resetScope}
        onTargetPairReset={handlers.handleTargetPairReset}
        onBBFSScopeReset={handlers.resetScope}
        onCustomFocusReset={handlers.handleCustomFocusReset}
      />

      {flags.showAIScopeSelector && <AIScopeSelector onSelect={handlers.handleScopeSelect} />}
      {flags.showTargetPairSelector && <TargetPairSelector onSelect={handlers.handleTargetPairSelect} />}
      {flags.showBBFSScopeSelector && <BBFSScopeSelector onSelect={handlers.handleScopeSelect} />}
      {flags.showRekapFocusSelector && <RekapFocusSelector onSelect={handlers.selectCustomFocus} />}

      {flags.showParamSelector && !flags.autoMode && (
        <ParamSelector
          type={type}
          param={param}
          analysisScope={analysisScope || "default"}
          onAnalyze={handlers.handleAnalyze}
        />
      )}

      {customFocus && (
        <CustomDigitBuilder
          show={flags.showCustomDigitBuilder}
          marketId={marketId}
          customFocus={customFocus}
          onGenerate={handlers.handleCustomDigitGenerate}
          {...custom}
        />
      )}

      {error && (
        <div className="animate-rise my-4 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-center text-xs font-bold text-danger">
          {error}
        </div>
      )}

      {result && type === "rekap" && <RekapResult result={result} />}
      {result && type !== "rekap" && (
        <AnalysisResult
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
    </div>
  );
 }
