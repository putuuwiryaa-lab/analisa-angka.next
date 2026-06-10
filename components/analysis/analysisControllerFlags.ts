import type { CustomFocus, TargetPair } from "@/lib/analysis/customDigit";
import type { AnalysisScope } from "./ScopeSelectors";

export type AnalysisControllerFlagsInput = {
  type: string;
  param: number | null;
  targetPair: TargetPair | null;
  analysisScope: AnalysisScope | null;
  customFocus: CustomFocus | null;
  loading: boolean;
  result: Record<string, any> | null;
  autoMode: boolean;
};

export function buildAnalysisControllerFlags({
  type,
  param,
  targetPair,
  analysisScope,
  customFocus,
  loading,
  result,
  autoMode,
}: AnalysisControllerFlagsInput) {
  const isAI = type === "ai";
  const needsTargetPair = ["jumlah", "shio"].includes(type);
  const isBBFS = type === "bbfs";
  const isRekapCustom = type === "rekap" && param === 3;
  const showAIScopeSelector = isAI && !analysisScope && !result && !loading;
  const showTargetPairSelector = needsTargetPair && !targetPair && !result && !loading;
  const showBBFSScopeSelector = isBBFS && !analysisScope && !result && !loading;
  const showRekapFocusSelector = isRekapCustom && !customFocus && !result && !loading;
  const showParamSelector =
    !showAIScopeSelector && !showTargetPairSelector && !showBBFSScopeSelector && !showRekapFocusSelector;

  return {
    isAI,
    isBBFS,
    isRekapCustom,
    needsTargetPair,
    autoMode,
    showAIScopeSelector,
    showTargetPairSelector,
    showBBFSScopeSelector,
    showRekapFocusSelector,
    showCustomDigitBuilder: isRekapCustom && Boolean(customFocus) && !result,
    showParamSelector,
    canStartAnalyze: !result && !loading && param !== 0 && !isRekapCustom && !autoMode,
  };
}
