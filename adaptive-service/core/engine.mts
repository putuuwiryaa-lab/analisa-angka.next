import { replayAdaptiveHistory, settlePendingPrediction } from "./learning.mts";
import { optimizeDigitSelection } from "./optimizer.mts";
import { calculateMarginals, combinePairMatrices } from "./pair-probability.mts";
import type {
  AdaptiveLearningState,
  AdaptiveMethod,
  AdaptivePendingPrediction,
  AdaptivePrediction,
  AdaptiveRun,
  Target2D,
} from "./types.mts";
import { ADAPTIVE_CONFIG_VERSION, ADAPTIVE_ENGINE_VERSION } from "./types.mts";

function signalStrength(lift: number, margin: number): AdaptivePrediction["signalStrength"] {
  if (lift >= 0.05 && margin >= 0.01) return "high";
  if (lift >= 0.02 || margin >= 0.004) return "medium";
  return "low";
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
  const selection = optimizeDigitSelection(pairProbabilities, method, digitCount);
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
      replay.state.expertWeights,
    ),
    historyDraws: [...draws],
  };
}
