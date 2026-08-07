import type { Target2D } from "@/lib/engine/types";
import { buildBaselineExperts } from "./experts";
import { replayAdaptiveHistory, settlePendingPrediction } from "./learning";
import { calculateMarginals, combinePairMatrices } from "./pair-probability";
import {
  applySelectionCalibrationUpdates,
  buildIndependentlyCalibratedSelections,
  buildSelectionCalibrationUpdates,
} from "./selection-calibration";
import type {
  AdaptiveLearningState,
  AdaptiveMethod,
  AdaptivePendingPrediction,
  AdaptivePrediction,
  AdaptiveRun,
  AdaptiveSelection,
  AdaptiveSelectionCalibrationState,
} from "./types";
import { ADAPTIVE_CONFIG_VERSION, ADAPTIVE_ENGINE_VERSION } from "./types";

function signalStrength(lift: number, margin: number): AdaptivePrediction["signalStrength"] {
  if (lift >= 0.05 && margin >= 0.01) return "high";
  if (lift >= 0.02 || margin >= 0.004) return "medium";
  return "low";
}

function requestedSelection(
  selections: readonly AdaptiveSelection[],
  method: AdaptiveMethod,
  digitCount: number,
): AdaptiveSelection {
  const selection = selections.find((item) =>
    item.method === method && item.digitCount === digitCount
  );
  if (!selection) {
    throw new Error(`Selection Adaptive ${method.toUpperCase()} ${digitCount} digit tidak tersedia.`);
  }
  return selection;
}

function calibrationStatesFromPending(
  pending: AdaptivePendingPrediction | null | undefined,
): AdaptiveSelectionCalibrationState[] {
  return (pending?.selections ?? []).map((selection) => ({
    method: selection.method,
    digitCount: selection.digitCount,
    expertWeights: { ...(selection.calibrationWeights ?? {}) },
    sampleCount: 0,
    hitCount: 0,
    cumulativeLoss: 0,
    stateRevision: selection.calibrationStateRevision ?? 0,
  }));
}

export function runAdaptiveOnline(
  draws: readonly string[],
  target2D: Target2D,
  method: AdaptiveMethod,
  digitCount: number,
  initialState?: AdaptiveLearningState | null,
  pendingPrediction?: AdaptivePendingPrediction | null,
): AdaptiveRun {
  const replay = replayAdaptiveHistory(draws, target2D, initialState);
  const pairProbabilities = combinePairMatrices(replay.experts);
  const marginals = calculateMarginals(pairProbabilities);
  const baseSettlement = settlePendingPrediction(pendingPrediction, draws, target2D);
  let settlement = baseSettlement;
  let calibrationStates = calibrationStatesFromPending(pendingPrediction);

  if (baseSettlement && pendingPrediction) {
    const updates = buildSelectionCalibrationUpdates(
      pendingPrediction.selections,
      calibrationStates,
      draws.slice(0, pendingPrediction.historyLength),
      draws[pendingPrediction.historyLength],
      target2D,
    );
    calibrationStates = applySelectionCalibrationUpdates(calibrationStates, updates);
    settlement = { ...baseSettlement, selectionCalibrationUpdates: updates };
  }

  const selections = buildIndependentlyCalibratedSelections(
    buildBaselineExperts(draws, target2D),
    calibrationStates,
    replay.state.expertWeights,
  );
  const selection = requestedSelection(selections, method, digitCount);
  const latestDraw = draws[draws.length - 1];

  const prediction: AdaptivePrediction = {
    engineVersion: ADAPTIVE_ENGINE_VERSION,
    configVersion: ADAPTIVE_CONFIG_VERSION,
    target2D,
    historyLength: draws.length,
    historyCutoffKey: `${draws.length}:${latestDraw}`,
    latestDraw,
    pairProbabilities,
    leftProbabilities: marginals.left,
    rightProbabilities: marginals.right,
    expertWeights: replay.state.expertWeights,
    selection,
    selections,
    signalStrength: signalStrength(selection.lift, selection.selectionMargin),
    replay: replay.summary,
  };

  return {
    prediction,
    state: replay.state,
    settlement,
    historyDraws: [...draws],
  };
}

export function runAdaptiveFoundation(
  draws: readonly string[],
  target2D: Target2D,
  method: AdaptiveMethod,
  digitCount: number,
): AdaptivePrediction {
  return runAdaptiveOnline(draws, target2D, method, digitCount).prediction;
}
