import {
  canUseParam,
  canUseTargetPair,
  type LockableMode,
  type LockableScope,
} from "@/lib/access/freeAccess";
import type { TargetPair } from "@/lib/analysis/customDigit";
import type { AnalysisScope } from "./ScopeSelectors";

export function canRunAnalysisForRole({
  role,
  type,
  selectedParam,
  selectedScope,
  finalTargetPair,
  isAI,
  isBBFS,
  needsTargetPair,
}: {
  role: string | null;
  type: string;
  selectedParam: number;
  selectedScope: AnalysisScope;
  finalTargetPair: TargetPair;
  isAI: boolean;
  isBBFS: boolean;
  needsTargetPair: boolean;
}) {
  if (isAI || isBBFS) {
    return canUseParam(
      role,
      type as LockableMode,
      selectedParam,
      selectedScope as LockableScope,
      finalTargetPair,
    );
  }

  if (needsTargetPair) {
    const targetAllowed = canUseTargetPair(role, type as LockableMode, finalTargetPair);
    const paramAllowed = canUseParam(
      role,
      type as LockableMode,
      selectedParam,
      selectedScope as LockableScope,
      finalTargetPair,
    );
    return targetAllowed && paramAllowed;
  }

  return canUseParam(
    role,
    type as LockableMode,
    selectedParam,
    selectedScope as LockableScope,
    finalTargetPair,
  );
}
