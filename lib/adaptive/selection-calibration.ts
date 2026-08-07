import type { Target2D } from "@/lib/engine/types";
import { buildBaselineExperts } from "./experts";
import { resolveExpertWeights, updateExpertWeights } from "./learning";
import { optimizeDigitSelection } from "./optimizer";
import { combinePairMatrices } from "./pair-probability";
import { extractTargetPair } from "./targets";
import type {
  AdaptiveExpertOutput,
  AdaptiveMethod,
  AdaptiveSelection,
  AdaptiveSelectionCalibrationState,
  AdaptiveSelectionCalibrationUpdate,
} from "./types";

const METHODS = ["ai", "bbfs"] as const satisfies readonly AdaptiveMethod[];

export function selectionCalibrationKey(method: AdaptiveMethod, digitCount: number): string {
  return `${method}:${digitCount}`;
}

function selectionHit(
  method: AdaptiveMethod,
  digits: readonly number[],
  actualLeft: number,
  actualRight: number,
): boolean {
  const selected = new Set(digits);
  return method === "ai"
    ? selected.has(actualLeft) || selected.has(actualRight)
    : selected.has(actualLeft) && selected.has(actualRight);
}

function weightedExperts(
  experts: readonly AdaptiveExpertOutput[],
  weights: Readonly<Record<string, number>>,
): AdaptiveExpertOutput[] {
  return experts.map((expert) => ({ ...expert, weight: weights[expert.id] ?? 0 }));
}

function stateMap(
  states: readonly AdaptiveSelectionCalibrationState[] | undefined,
): Map<string, AdaptiveSelectionCalibrationState> {
  return new Map((states ?? []).map((state) => [
    selectionCalibrationKey(state.method, state.digitCount),
    state,
  ]));
}

export function buildIndependentlyCalibratedSelections(
  experts: readonly AdaptiveExpertOutput[],
  states: readonly AdaptiveSelectionCalibrationState[] | undefined,
  fallbackWeights: Readonly<Record<string, number>>,
): AdaptiveSelection[] {
  const byKey = stateMap(states);
  const selections: AdaptiveSelection[] = [];

  for (const method of METHODS) {
    for (let digitCount = 1; digitCount <= 9; digitCount++) {
      const state = byKey.get(selectionCalibrationKey(method, digitCount));
      const weights = resolveExpertWeights(experts, state?.expertWeights ?? fallbackWeights);
      const matrix = combinePairMatrices(weightedExperts(experts, weights));
      selections.push({
        ...optimizeDigitSelection(matrix, method, digitCount),
        calibrationWeights: weights,
        calibrationStateRevision: state?.stateRevision ?? 0,
      });
    }
  }

  return selections;
}

export function buildSelectionCalibrationUpdates(
  pendingSelections: readonly AdaptiveSelection[],
  states: readonly AdaptiveSelectionCalibrationState[] | undefined,
  historyBeforeActual: readonly string[],
  actualDraw: string,
  target2D: Target2D,
): AdaptiveSelectionCalibrationUpdate[] {
  const experts = buildBaselineExperts(historyBeforeActual, target2D);
  const [actualLeft, actualRight] = extractTargetPair(actualDraw, target2D);
  const byKey = stateMap(states);

  return pendingSelections.map((pending) => {
    const state = byKey.get(selectionCalibrationKey(pending.method, pending.digitCount));
    const weightsBefore = resolveExpertWeights(
      experts,
      state?.expertWeights ?? pending.calibrationWeights,
    );
    const expertLosses = Object.fromEntries(experts.map((expert) => {
      const expertSelection = optimizeDigitSelection(
        expert.pairProbabilities,
        pending.method,
        pending.digitCount,
      );
      const hit = selectionHit(
        pending.method,
        expertSelection.digits,
        actualLeft,
        actualRight,
      );
      return [expert.id, Math.pow(expertSelection.estimatedSuccess - (hit ? 1 : 0), 2)];
    }));
    const weightsAfter = updateExpertWeights(experts, weightsBefore, expertLosses);
    const hit = selectionHit(pending.method, pending.digits, actualLeft, actualRight);
    const stateRevisionBefore = state?.stateRevision ?? pending.calibrationStateRevision ?? 0;

    return {
      method: pending.method,
      digitCount: pending.digitCount,
      hit,
      estimatedSuccess: pending.estimatedSuccess,
      calibrationLoss: Math.pow(pending.estimatedSuccess - (hit ? 1 : 0), 2),
      expertLosses,
      weightsBefore,
      weightsAfter,
      stateRevisionBefore,
      stateRevisionAfter: stateRevisionBefore + 1,
    };
  });
}

export function applySelectionCalibrationUpdates(
  states: readonly AdaptiveSelectionCalibrationState[] | undefined,
  updates: readonly AdaptiveSelectionCalibrationUpdate[],
): AdaptiveSelectionCalibrationState[] {
  const byKey = stateMap(states);

  for (const update of updates) {
    const key = selectionCalibrationKey(update.method, update.digitCount);
    const previous = byKey.get(key);
    byKey.set(key, {
      method: update.method,
      digitCount: update.digitCount,
      expertWeights: { ...update.weightsAfter },
      sampleCount: (previous?.sampleCount ?? 0) + 1,
      hitCount: (previous?.hitCount ?? 0) + (update.hit ? 1 : 0),
      cumulativeLoss: (previous?.cumulativeLoss ?? 0) + update.calibrationLoss,
      stateRevision: update.stateRevisionAfter,
    });
  }

  return [...byKey.values()].sort((left, right) =>
    left.method.localeCompare(right.method) || left.digitCount - right.digitCount
  );
}
