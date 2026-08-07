import { buildBaselineExperts } from "./experts.mts";
import { replayAdaptiveHistory, settlePendingPrediction } from "./learning.mts";
import { calculateMarginals, combinePairMatrices } from "./pair-probability.mts";
import {
  applySelectionCalibrationUpdates,
  buildIndependentlyCalibratedSelections,
  buildSelectionCalibrationUpdates,
} from "./selection-calibration.mts";
import type {
  AdaptiveLearningState,
  AdaptiveMethod,
  AdaptivePendingPrediction,
  AdaptivePrediction,
  AdaptiveRun,
  AdaptiveRunOptions,
  AdaptiveSelection,
  AdaptiveSelectionCalibrationState,
  Target2D,
} from "./types.mts";
import { ADAPTIVE_CONFIG_VERSION, ADAPTIVE_ENGINE_VERSION } from "./types.mts";

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

function historyCutoffKey(draws: readonly string[]): string {
  return `${draws.length}:${draws[draws.length - 1]}:${historyWindowFingerprint(draws)}`;
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

function actualSettlementContext(
  draws: readonly string[],
  pending: AdaptivePendingPrediction,
  rollingWindowAdvance: boolean,
): { historyBeforeActual: string[]; actualDraw: string } | null {
  if (rollingWindowAdvance && draws.length === pending.historyLength) {
    return {
      historyBeforeActual: draws.slice(0, -1),
      actualDraw: draws[draws.length - 1],
    };
  }
  if (draws.length <= pending.historyLength) return null;
  return {
    historyBeforeActual: draws.slice(0, pending.historyLength),
    actualDraw: draws[pending.historyLength],
  };
}

export function runAdaptiveOnline(
  draws: readonly string[],
  target2D: Target2D,
  method: AdaptiveMethod,
  digitCount: number,
  initialState?: AdaptiveLearningState | null,
  pendingPrediction?: AdaptivePendingPrediction | null,
  options: AdaptiveRunOptions = {},
): AdaptiveRun {
  const replay = replayAdaptiveHistory(draws, target2D, initialState, options);
  const pairProbabilities = combinePairMatrices(replay.experts);
  const marginals = calculateMarginals(pairProbabilities);

  const baseSettlement = settlePendingPrediction(
    pendingPrediction,
    draws,
    target2D,
    options,
  );
  let settlement = baseSettlement;
  let calibrationStates = options.selectionCalibrationStates?.length
    ? [...options.selectionCalibrationStates]
    : calibrationStatesFromPending(pendingPrediction);

  if (baseSettlement && pendingPrediction) {
    const context = actualSettlementContext(
      draws,
      pendingPrediction,
      options.rollingWindowAdvance === true,
    );
    if (!context) throw new Error("Konteks settlement selection tidak tersedia.");

    const updates = buildSelectionCalibrationUpdates(
      pendingPrediction.selections,
      calibrationStates,
      pendingPrediction.expertWeights,
      context.historyBeforeActual,
      context.actualDraw,
      target2D,
    );
    if (updates.length !== 18) {
      throw new Error("Settlement harus menghasilkan 18 update calibration independen.");
    }
    calibrationStates = applySelectionCalibrationUpdates(calibrationStates, updates);
    settlement = {
      ...baseSettlement,
      selectionCalibrationUpdates: updates,
    };
  }

  const selectionExperts = buildBaselineExperts(draws, target2D);
  const selections = buildIndependentlyCalibratedSelections(
    selectionExperts,
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
    historyCutoffKey: historyCutoffKey(draws),
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
