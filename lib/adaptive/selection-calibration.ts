import type { Target2D } from "@/lib/engine/types";
import { buildBaselineExperts } from "./experts";
import { resolveExpertWeights, updateExpertWeights } from "./learning";
import {
  optimizeConfiguredSelections,
  optimizeDigitSelection,
} from "./optimizer";
import { combinePairMatrices } from "./pair-probability";
import { extractTargetPair } from "./targets";
import type {
  AdaptiveExpertOutput,
  AdaptiveMethod,
  AdaptiveSelection,
  AdaptiveSelectionCalibrationState,
  AdaptiveSelectionCalibrationUpdate,
} from "./types";
import {
  ADAPTIVE_REPLAY_WARMUP,
  ADAPTIVE_SELECTION_SPECS,
} from "./types";

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

function nonEmptyWeights(
  primary: Readonly<Record<string, number>> | null | undefined,
  fallback: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  return primary && Object.keys(primary).length > 0 ? primary : fallback;
}

function stateMap(
  states: readonly AdaptiveSelectionCalibrationState[] | undefined,
): Map<string, AdaptiveSelectionCalibrationState> {
  return new Map((states ?? []).map((state) => [
    selectionCalibrationKey(state.method, state.digitCount),
    state,
  ]));
}

function sortStates(states: Iterable<AdaptiveSelectionCalibrationState>): AdaptiveSelectionCalibrationState[] {
  return [...states].sort((left, right) =>
    left.method.localeCompare(right.method) || left.digitCount - right.digitCount
  );
}

function configuredExpertSelections(
  experts: readonly AdaptiveExpertOutput[],
): Map<string, Map<string, AdaptiveSelection>> {
  return new Map(experts.map((expert) => [
    expert.id,
    new Map(optimizeConfiguredSelections(expert.pairProbabilities).map((selection) => [
      selectionCalibrationKey(selection.method, selection.digitCount),
      selection,
    ])),
  ]));
}

export function buildIndependentlyCalibratedSelections(
  experts: readonly AdaptiveExpertOutput[],
  states: readonly AdaptiveSelectionCalibrationState[] | undefined,
  fallbackWeights: Readonly<Record<string, number>>,
): AdaptiveSelection[] {
  const byKey = stateMap(states);
  return ADAPTIVE_SELECTION_SPECS.map((spec) => {
    const state = byKey.get(selectionCalibrationKey(spec.method, spec.digitCount));
    const weights = resolveExpertWeights(
      experts,
      nonEmptyWeights(state?.expertWeights, fallbackWeights),
    );
    const matrix = combinePairMatrices(weightedExperts(experts, weights));
    return {
      ...optimizeDigitSelection(matrix, spec.method, spec.digitCount),
      calibrationWeights: weights,
      calibrationStateRevision: state?.stateRevision ?? 0,
    };
  });
}

export function buildSelectionCalibrationUpdates(
  pendingSelections: readonly AdaptiveSelection[],
  states: readonly AdaptiveSelectionCalibrationState[] | undefined,
  fallbackWeights: Readonly<Record<string, number>>,
  historyBeforeActual: readonly string[],
  actualDraw: string,
  target2D: Target2D,
): AdaptiveSelectionCalibrationUpdate[] {
  const experts = buildBaselineExperts(historyBeforeActual, target2D);
  const expertSelections = configuredExpertSelections(experts);
  const [actualLeft, actualRight] = extractTargetPair(actualDraw, target2D);
  const byKey = stateMap(states);

  return pendingSelections.map((pending) => {
    const key = selectionCalibrationKey(pending.method, pending.digitCount);
    const state = byKey.get(key);
    const weightsBefore = resolveExpertWeights(
      experts,
      nonEmptyWeights(
        state?.expertWeights,
        nonEmptyWeights(pending.calibrationWeights, fallbackWeights),
      ),
    );
    const expertLosses = Object.fromEntries(experts.map((expert) => {
      const selection = expertSelections.get(expert.id)?.get(key);
      if (!selection) throw new Error(`Selection expert ${expert.id}/${key} tidak tersedia.`);
      const observed = selectionHit(
        pending.method,
        selection.digits,
        actualLeft,
        actualRight,
      ) ? 1 : 0;
      return [expert.id, Math.pow(selection.estimatedSuccess - observed, 2)];
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

export function replaySelectionCalibrationHistory(
  draws: readonly string[],
  target2D: Target2D,
): AdaptiveSelectionCalibrationState[] {
  const byKey = new Map<string, AdaptiveSelectionCalibrationState>();
  const start = Math.min(ADAPTIVE_REPLAY_WARMUP, draws.length);
  for (let actualIndex = start; actualIndex < draws.length; actualIndex++) {
    const historyBeforeActual = draws.slice(0, actualIndex);
    const actualDraw = draws[actualIndex];
    const [actualLeft, actualRight] = extractTargetPair(actualDraw, target2D);
    const experts = buildBaselineExperts(historyBeforeActual, target2D);
    const expertSelections = configuredExpertSelections(experts);

    for (const spec of ADAPTIVE_SELECTION_SPECS) {
      const key = selectionCalibrationKey(spec.method, spec.digitCount);
      const previous = byKey.get(key);
      const weightsBefore = resolveExpertWeights(experts, previous?.expertWeights ?? {});
      const expertLosses = Object.fromEntries(experts.map((expert) => {
        const selection = expertSelections.get(expert.id)?.get(key);
        if (!selection) throw new Error(`Replay selection ${expert.id}/${key} tidak tersedia.`);
        const observed = selectionHit(
          spec.method,
          selection.digits,
          actualLeft,
          actualRight,
        ) ? 1 : 0;
        return [expert.id, Math.pow(selection.estimatedSuccess - observed, 2)];
      }));
      const weightsAfter = updateExpertWeights(experts, weightsBefore, expertLosses);
      const ensemble = combinePairMatrices(weightedExperts(experts, weightsBefore));
      const publishedSelection = optimizeDigitSelection(ensemble, spec.method, spec.digitCount);
      const hit = selectionHit(
        spec.method,
        publishedSelection.digits,
        actualLeft,
        actualRight,
      );
      byKey.set(key, {
        method: spec.method,
        digitCount: spec.digitCount,
        expertWeights: weightsAfter,
        sampleCount: (previous?.sampleCount ?? 0) + 1,
        hitCount: (previous?.hitCount ?? 0) + (hit ? 1 : 0),
        cumulativeLoss: (previous?.cumulativeLoss ?? 0) +
          Math.pow(publishedSelection.estimatedSuccess - (hit ? 1 : 0), 2),
        stateRevision: (previous?.stateRevision ?? 0) + 1,
      });
    }
  }
  return sortStates(byKey.values());
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
  return sortStates(byKey.values());
}
