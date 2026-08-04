import type { Target2D } from "@/lib/engine/types";
import { buildBaselineExperts } from "./experts";
import { optimizeDigitSelection } from "./optimizer";
import { calculateMarginals, combinePairMatrices } from "./pair-probability";
import type { AdaptiveMethod, AdaptivePrediction } from "./types";
import { ADAPTIVE_CONFIG_VERSION, ADAPTIVE_ENGINE_VERSION } from "./types";

function signalStrength(lift: number, margin: number): AdaptivePrediction["signalStrength"] {
  if (lift >= 0.05 && margin >= 0.01) return "high";
  if (lift >= 0.02 || margin >= 0.004) return "medium";
  return "low";
}

export function runAdaptiveFoundation(
  draws: readonly string[],
  target2D: Target2D,
  method: AdaptiveMethod,
  digitCount: number,
): AdaptivePrediction {
  if (draws.length < 2) throw new Error("Adaptive membutuhkan minimal 2 result 4D.");
  if (draws.some((draw) => !/^\d{4}$/.test(draw))) throw new Error("Histori Adaptive harus berupa result 4D.");

  const experts = buildBaselineExperts(draws, target2D);
  const pairProbabilities = combinePairMatrices(experts);
  const marginals = calculateMarginals(pairProbabilities);
  const selection = optimizeDigitSelection(pairProbabilities, method, digitCount);
  const latestDraw = draws[draws.length - 1];

  return {
    engineVersion: ADAPTIVE_ENGINE_VERSION,
    configVersion: ADAPTIVE_CONFIG_VERSION,
    target2D,
    historyLength: draws.length,
    historyCutoffKey: `${draws.length}:${latestDraw}`,
    latestDraw,
    pairProbabilities,
    leftProbabilities: marginals.left,
    rightProbabilities: marginals.right,
    expertWeights: Object.fromEntries(experts.map((expert) => [expert.id, expert.weight])),
    selection,
    signalStrength: signalStrength(selection.lift, selection.selectionMargin),
  };
}
