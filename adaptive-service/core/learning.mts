import { buildBaselineExperts } from "./experts.mts";
import {
  calculateMarginals,
  combinePairMatrices,
  pairBrierLoss,
  positionalBrierLoss,
} from "./pair-probability.mts";
import { extractTargetPair } from "./targets.mts";
import type {
  AdaptiveLearningState,
  AdaptivePendingPrediction,
  AdaptiveReplaySummary,
  AdaptiveRunOptions,
  AdaptiveSettlement,
  Target2D,
} from "./types.mts";
import {
  ADAPTIVE_CONFIG_VERSION,
  ADAPTIVE_ENGINE_VERSION,
  ADAPTIVE_REPLAY_WARMUP as V2_REPLAY_WARMUP,
} from "./types.mts";
import {
  aggregateWeights,
  applyExpertWeights,
  combinedLoss,
  evaluateExpertLosses,
  resolveExpertWeights,
  updateExpertWeights,
} from "./weights.mts";

export const ADAPTIVE_REPLAY_WARMUP = V2_REPLAY_WARMUP;

function validateDraws(draws: readonly string[]): void {
  if (draws.length < 2) throw new Error("Adaptive membutuhkan minimal 2 result 4D.");
  if (draws.some((draw) => !/^\d{4}$/.test(draw))) {
    throw new Error("Histori Adaptive harus berupa result 4D.");
  }
}

function compatibleState(
  state: AdaptiveLearningState | null | undefined,
  draws: readonly string[],
  target2D: Target2D,
): state is AdaptiveLearningState {
  if (!state) return false;
  if (state.engineVersion !== ADAPTIVE_ENGINE_VERSION || state.configVersion !== ADAPTIVE_CONFIG_VERSION) return false;
  if (state.target2D !== target2D) return false;
  if (!Number.isInteger(state.processedHistoryLength) || state.processedHistoryLength < 2) return false;
  if (state.processedHistoryLength > draws.length) return false;
  return draws[state.processedHistoryLength - 1] === state.lastProcessedDraw;
}

function rollingState(
  state: AdaptiveLearningState | null | undefined,
  draws: readonly string[],
  target2D: Target2D,
  options: AdaptiveRunOptions,
): state is AdaptiveLearningState {
  if (!options.rollingWindowAdvance || !state) return false;
  if (state.engineVersion !== ADAPTIVE_ENGINE_VERSION || state.configVersion !== ADAPTIVE_CONFIG_VERSION) return false;
  if (state.target2D !== target2D) return false;
  if (state.processedHistoryLength !== draws.length || draws.length < 2) return false;
  return state.lastProcessedDraw !== draws[draws.length - 1];
}

function exactPreviousRollingHistory(
  draws: readonly string[],
  options: AdaptiveRunOptions,
): string[] {
  const previous = options.previousHistoryDraws;
  if (!previous || previous.length !== draws.length || previous.length < 2) {
    throw new Error("Adaptive V2 membutuhkan window histori sebelumnya untuk settlement rolling 170.");
  }
  const overlapValid = previous.slice(1).every((draw, index) => draw === draws[index]);
  if (!overlapValid) {
    throw new Error("Window histori sebelumnya tidak membentuk overlap rolling yang valid.");
  }
  return [...previous];
}

function replayRollingWindow(
  draws: readonly string[],
  target2D: Target2D,
  initialState: AdaptiveLearningState,
  options: AdaptiveRunOptions,
) {
  const actualDraw = draws[draws.length - 1];
  const historyBeforeActual = exactPreviousRollingHistory(draws, options);
  const expertsBefore = buildBaselineExperts(historyBeforeActual, target2D);
  const weightsBefore = resolveExpertWeights(expertsBefore, initialState.expertWeights);
  const weightedBefore = applyExpertWeights(expertsBefore, weightsBefore);
  const ensemble = combinePairMatrices(weightedBefore);
  const marginals = calculateMarginals(ensemble);
  const [actualLeft, actualRight] = extractTargetPair(actualDraw, target2D);
  const pairLoss = pairBrierLoss(ensemble, actualLeft, actualRight);
  const leftLoss = positionalBrierLoss(marginals.left, actualLeft);
  const rightLoss = positionalBrierLoss(marginals.right, actualRight);
  const expertLosses = evaluateExpertLosses(expertsBefore, actualLeft, actualRight);
  const updatedWeights = updateExpertWeights(expertsBefore, weightsBefore, expertLosses);

  const finalExperts = buildBaselineExperts(draws, target2D);
  const finalWeights = resolveExpertWeights(finalExperts, updatedWeights);
  const aggregates = aggregateWeights(finalExperts, finalWeights);

  return {
    state: {
      engineVersion: ADAPTIVE_ENGINE_VERSION,
      configVersion: ADAPTIVE_CONFIG_VERSION,
      target2D,
      processedHistoryLength: draws.length,
      lastProcessedDraw: actualDraw,
      expertWeights: finalWeights,
      familyWeights: aggregates.familyWeights,
      horizonWeights: aggregates.horizonWeights,
      stateRevision: initialState.stateRevision,
    } satisfies AdaptiveLearningState,
    summary: {
      mode: "incremental",
      startHistoryLength: draws.length,
      endHistoryLength: draws.length,
      processedSteps: 1,
      meanEnsembleLoss: combinedLoss(pairLoss, leftLoss, rightLoss),
      expertMeanLosses: expertLosses,
    } satisfies AdaptiveReplaySummary,
    experts: applyExpertWeights(finalExperts, finalWeights),
  };
}

export function replayAdaptiveHistory(
  draws: readonly string[],
  target2D: Target2D,
  initialState?: AdaptiveLearningState | null,
  options: AdaptiveRunOptions = {},
) {
  validateDraws(draws);

  if (rollingState(initialState, draws, target2D, options)) {
    return replayRollingWindow(draws, target2D, initialState, options);
  }

  const compatible = compatibleState(initialState, draws, target2D);
  const startHistoryLength = compatible
    ? initialState.processedHistoryLength
    : Math.min(ADAPTIVE_REPLAY_WARMUP, draws.length);
  let weights: Record<string, number> = compatible ? { ...initialState.expertWeights } : {};
  let ensembleLossTotal = 0;
  let processedSteps = 0;
  const expertLossTotals: Record<string, number> = {};
  const expertLossCounts: Record<string, number> = {};

  for (let actualIndex = startHistoryLength; actualIndex < draws.length; actualIndex++) {
    const experts = buildBaselineExperts(draws.slice(0, actualIndex), target2D);
    const resolved = resolveExpertWeights(experts, weights);
    const ensemble = combinePairMatrices(applyExpertWeights(experts, resolved));
    const marginals = calculateMarginals(ensemble);
    const [actualLeft, actualRight] = extractTargetPair(draws[actualIndex], target2D);
    ensembleLossTotal += combinedLoss(
      pairBrierLoss(ensemble, actualLeft, actualRight),
      positionalBrierLoss(marginals.left, actualLeft),
      positionalBrierLoss(marginals.right, actualRight),
    );

    const losses = evaluateExpertLosses(experts, actualLeft, actualRight);
    for (const [id, loss] of Object.entries(losses)) {
      expertLossTotals[id] = (expertLossTotals[id] ?? 0) + loss;
      expertLossCounts[id] = (expertLossCounts[id] ?? 0) + 1;
    }
    weights = updateExpertWeights(experts, resolved, losses);
    processedSteps += 1;
  }

  const experts = buildBaselineExperts(draws, target2D);
  const finalWeights = resolveExpertWeights(experts, weights);
  const aggregates = aggregateWeights(experts, finalWeights);
  const summary: AdaptiveReplaySummary = {
    mode: compatible ? (processedSteps > 0 ? "incremental" : "noop") : "full",
    startHistoryLength,
    endHistoryLength: draws.length,
    processedSteps,
    meanEnsembleLoss: processedSteps > 0 ? ensembleLossTotal / processedSteps : 0,
    expertMeanLosses: Object.fromEntries(
      Object.entries(expertLossTotals).map(([id, total]) => [id, total / (expertLossCounts[id] ?? 1)]),
    ),
  };

  return {
    state: {
      engineVersion: ADAPTIVE_ENGINE_VERSION,
      configVersion: ADAPTIVE_CONFIG_VERSION,
      target2D,
      processedHistoryLength: draws.length,
      lastProcessedDraw: draws[draws.length - 1],
      expertWeights: finalWeights,
      familyWeights: aggregates.familyWeights,
      horizonWeights: aggregates.horizonWeights,
      stateRevision: compatible ? initialState.stateRevision : 0,
    } satisfies AdaptiveLearningState,
    summary,
    experts: applyExpertWeights(experts, finalWeights),
  };
}

export function settlePendingPrediction(
  pending: AdaptivePendingPrediction | null | undefined,
  draws: readonly string[],
  target2D: Target2D,
  options: AdaptiveRunOptions = {},
): AdaptiveSettlement | null {
  if (!pending) return null;
  if (pending.engineVersion !== ADAPTIVE_ENGINE_VERSION || pending.configVersion !== ADAPTIVE_CONFIG_VERSION) return null;
  if (pending.target2D !== target2D) return null;

  const rollingWindowAdvance = options.rollingWindowAdvance === true &&
    draws.length === pending.historyLength &&
    draws.length >= 2;
  if (!rollingWindowAdvance && draws.length <= pending.historyLength) return null;

  const actualDraw = rollingWindowAdvance
    ? draws[draws.length - 1]
    : draws[pending.historyLength];
  if (!/^\d{4}$/.test(actualDraw)) return null;

  const historicalDraws = rollingWindowAdvance
    ? exactPreviousRollingHistory(draws, options)
    : draws.slice(0, pending.historyLength);
  const [actualLeft, actualRight] = extractTargetPair(actualDraw, target2D);
  const historicalExperts = buildBaselineExperts(historicalDraws, target2D);
  const weightsBefore = resolveExpertWeights(historicalExperts, pending.expertWeights);
  const expertLosses = evaluateExpertLosses(historicalExperts, actualLeft, actualRight);
  const weightsAfter = updateExpertWeights(historicalExperts, weightsBefore, expertLosses);
  const aiResults: Record<string, boolean> = {};
  const bbfsResults: Record<string, boolean> = {};

  for (const selection of pending.selections) {
    const selected = new Set(selection.digits);
    const key = String(selection.digitCount);
    if (selection.method === "ai") aiResults[key] = selected.has(actualLeft) || selected.has(actualRight);
    else bbfsResults[key] = selected.has(actualLeft) && selected.has(actualRight);
  }

  const pairLoss = pairBrierLoss(pending.pairProbabilities, actualLeft, actualRight);
  const leftLoss = positionalBrierLoss(pending.leftProbabilities, actualLeft);
  const rightLoss = positionalBrierLoss(pending.rightProbabilities, actualRight);

  return {
    predictionId: pending.predictionId,
    actualPair: actualLeft * 10 + actualRight,
    actualLeft,
    actualRight,
    pairBrier: pairLoss,
    leftBrier: leftLoss,
    rightBrier: rightLoss,
    combinedLoss: combinedLoss(pairLoss, leftLoss, rightLoss),
    aiResults,
    bbfsResults,
    expertLosses,
    weightsBefore,
    weightsAfter,
    selectionCalibrationUpdates: [],
  };
}
