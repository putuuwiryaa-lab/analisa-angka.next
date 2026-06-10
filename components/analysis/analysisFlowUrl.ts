import { bbfsScopeToTargetPair, type CustomFocus, type TargetPair } from "@/lib/analysis/customDigit";
import { BBFS_SCOPE_OPTIONS, type AnalysisScope } from "./ScopeSelectors";

const VALID_TARGET_PAIRS: TargetPair[] = ["depan", "tengah", "belakang"];
const VALID_CUSTOM_FOCUS: CustomFocus[] = ["depan", "tengah", "belakang", "3d", "4d"];

export type FlowUrlState = {
  analysisScope?: AnalysisScope | null;
  targetPair?: TargetPair | null;
  customFocus?: CustomFocus | null;
  param?: number | null;
  result?: boolean;
};

export function parseTargetPair(value: string | null): TargetPair {
  return VALID_TARGET_PAIRS.includes(value as TargetPair) ? (value as TargetPair) : "belakang";
}

export function parseAnalysisScope(value: string | null): AnalysisScope {
  return BBFS_SCOPE_OPTIONS.some((item) => item.key === value) ? (value as AnalysisScope) : "default";
}

export function parseCustomFocus(value: string | null): CustomFocus | null {
  return VALID_CUSTOM_FOCUS.includes(value as CustomFocus) ? (value as CustomFocus) : null;
}

export function targetPairFromScope(scope: AnalysisScope): TargetPair {
  return scope === "default" ? "belakang" : bbfsScopeToTargetPair(scope);
}

export function isAi2DScope(scope: AnalysisScope | null): boolean {
  return scope === "2d_depan" || scope === "2d_tengah" || scope === "2d_belakang";
}

export function requestScopeForAnalyze(type: string, scope: AnalysisScope): AnalysisScope {
  if (type === "ai" && isAi2DScope(scope)) return "default";
  return scope;
}

export function readParamFromUrl(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
