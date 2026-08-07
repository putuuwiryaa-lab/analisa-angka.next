import type { Target2D } from "@/lib/engine/types";
import { buildBaselineExperts } from "./experts";
import { replayAdaptiveHistory, settlePendingPrediction } from "./learning";
import { calculateMarginals, combinePairMatrices } from "./pair-probability";
import {
  applySelectionCalibrationUpdates,
  buildIndependentlyCalibratedSelections,
  buildSelectionCalibrationUpdates,
  replaySelectionCalibrationHistory,
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
import {
  ADAPTIVE_CONFIG_VERSION,
  ADAPTIVE_ENGINE_VERSION,
  ADAPTIVE_SELECTION_COUNT,
  isAdaptiveSelection,
} from "./types";

function signalStrength(lift: number, margin: number): AdaptivePrediction["signalStrength"] {
  if (lift >= 0.05 && margin >= 0.01) return "high";
  if (lift >= 0.02 || margin >= 0.004) return "medium";
  return "low";
}

function historyWindowFingerprint(draws: readonly string[]): string {
  let hash = 0xcbf29ce484222325n;
  const input = draws.join("|");
  for (let index = 0; index < input.length; index++) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
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
  if (target2D !== "belakang") throw new Error("Adaptive V2 hanya memproses target 2D belakang.");
  if (!isAdaptiveSelection(method, digitCount)) {
    throw new Error(`Selection Adaptive V2 ${method.toUpperCase()} ${digitCount} digit tidak tersedia.`);
  }

  const replay = replayAdaptiveHistory(draws, target2D, initialState);
  const pairProbabilities = combinePairMatrices(replay.experts);
  const marginals = calculateMarginals(pairProbabilities);
  const baseSettlement = settlePendingPrediction(pendingPrediction, draws, target2D);
  let settlement = baseSettlement;
  let calibrationStates = replay.summary.mode === "full"
    ? replaySelectionCalibrationHistory(draws, target2D)
    : calibrationStatesFromPending(pendingPrediction);

  if (baseSettlement && pendingPrediction) {
    const updates = buildSelectionCalibrationUpdates(
      pendingPrediction.selections,
      calibrationStates,
      pendingPrediction.expertWeights,
      draws.slice(0, pendingPrediction.historyLength),
      draws[pendingPrediction.historyLength],
      target2D,
    );
    if (updates.length !== ADAPTIVE_SELECTION_COUNT) {
      throw new Error(`Settlement harus menghasilkan ${ADAPTIVE_SELECTION_COUNT} update calibration.`);
    }
    calibrationStates = applySelectionCalibrationUpdates(calibrationStates, updates);
    settlement = { ...baseSettlement, selectionCalibrationUpdates: updates };
  }

  const selections = buildIndependentlyCalibratedSelections(
    buildBaselineExperts(draws, target2D),
    calibrationStates,
    replay.state.expertWeights,
  );
  if (selections.length !== ADAPTIVE_SELECTION_COUNT) {
    throw new Error(`Adaptive V2 harus menghasilkan ${ADAPTIVE_SELECTION_COUNT} selection.`);
  }
  const selection = requestedSelection(selections, method, digitCount);
  const latestDraw = draws[draws.length - 1];

  const prediction: AdaptivePrediction = {
    engineVersion: ADAPTIVE_ENGINE_VERSION,
    configVersion: ADAPTIVE_CONFIG_VERSION,
    target2D,
    historyLength: draws.length,
    historyCutoffKey: `${draws.length}:${latestDraw}:${historyWindowFingerprint(draws)}`,
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
