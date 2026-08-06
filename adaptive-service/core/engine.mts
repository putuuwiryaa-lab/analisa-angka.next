import { replayAdaptiveHistory, settlePendingPrediction } from "./learning.mts";
import { optimizeAllSelections } from "./optimizer.mts";
import { calculateMarginals, combinePairMatrices } from "./pair-probability.mts";
import type {
  AdaptiveLearningState,
  AdaptiveMethod,
  AdaptivePendingPrediction,
  AdaptivePrediction,
  AdaptiveRun,
  AdaptiveRunOptions,
  AdaptiveSelection,
  Target2D,
} from "./types.mts";
import { ADAPTIVE_CONFIG_VERSION, ADAPTIVE_ENGINE_VERSION } from "./types.mts";

function signalStrength(lift: number, margin: number): AdaptivePrediction["signalStrength"] {
  if (lift >= 0.05 && margin >= 0.01) return "high";
  if (lift >= 0.02 || margin >= 0.004) return "medium";
  return "low";
}

function historyWindowFingerprint(draws: readonly string[]): string {
  // FNV-1a 64-bit menjaga key ringkas dan deterministik. Seluruh window masuk
  // ke fingerprint agar result 4D yang berulang tidak mengaktifkan row lama.
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
  const selections = optimizeAllSelections(pairProbabilities);
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
    settlement: settlePendingPrediction(
      pendingPrediction,
      draws,
      target2D,
      options,
    ),
    historyDraws: [...draws],
  };
}
