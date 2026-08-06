import type { Target2D } from "@/lib/engine/types";
import { buildBaselineExperts } from "./experts";
import {
  calculateMarginals,
  combinePairMatrices,
  pairBrierLoss,
  positionalBrierLoss,
} from "./pair-probability";
import { extractTargetPair } from "./targets";
import type {
  AdaptiveExpertOutput,
  AdaptiveLearningState,
  AdaptivePendingPrediction,
  AdaptiveReplaySummary,
  AdaptiveRunOptions,
  AdaptiveSettlement,
} from "./types";
import { ADAPTIVE_CONFIG_VERSION, ADAPTIVE_ENGINE_VERSION } from "./types";

export const ADAPTIVE_LEARNING_RATE = 1;
export const ADAPTIVE_FIXED_SHARE = 0.02;
export const ADAPTIVE_REPLAY_WARMUP = 14;

const PAIR_LOSS_WEIGHT = 0.7;
const LEFT_LOSS_WEIGHT = 0.15;
const RIGHT_LOSS_WEIGHT = 0.15;
const NEW_EXPERT_PRIOR_SHARE = 0.05;

interface ReplayResult {
  state: AdaptiveLearningState;
  summary: AdaptiveReplaySummary;
  experts: AdaptiveExpertOutput[];
}

function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const safeEntries = Object.entries(weights)
    .map(([id, value]) => [id, Number.isFinite(value) && value > 0 ? value : 0] as const)
    .filter(([, value]) => value > 0);
  const total = safeEntries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return {};
  return Object.fromEntries(safeEntries.map(([id, value]) => [id, value / total]));
}

function baselineWeights(experts: readonly AdaptiveExpertOutput[]): Record<string, number> {
  return normalizeWeights(Object.fromEntries(experts.map((expert) => [expert.id, expert.weight])));
}

export function resolveExpertWeights(
  experts: readonly AdaptiveExpertOutput[],
  storedWeights?: Readonly<Record<string, number>> | null,
): Record<string, number> {
  const baseline = baselineWeights(experts);
  const activeStored = Object.fromEntries(
    experts
      .map((expert) => [expert.id, Number(storedWeights?.[expert.id] ?? 0)] as const)
      .filter(([, value]) => Number.isFinite(value) && value > 0),
  );

  if (Object.keys(activeStored).length === 0) return baseline;

  const combined = Object.fromEntries(
    experts.map((expert) => [
      expert.id,
      activeStored[expert.id] ?? (baseline[expert.id] ?? 0) * NEW_EXPERT_PRIOR_SHARE,
    ]),
  );
  return normalizeWeights(combined);
}

function applyExpertWeights(
  experts: readonly AdaptiveExpertOutput[],
  weights: Readonly<Record<string, number>>,
): AdaptiveExpertOutput[] {
  return experts.map((expert) => ({ ...expert, weight: weights[expert.id] ?? 0 }));
}

function combinedLoss(
  pairLoss: number,
  leftLoss: number,
  rightLoss: number,
): number {
  return (
    pairLoss * PAIR_LOSS_WEIGHT +
    leftLoss * LEFT_LOSS_WEIGHT +
    rightLoss * RIGHT_LOSS_WEIGHT
  );
}

export function evaluateExpertLosses(
  experts: readonly AdaptiveExpertOutput[],
  actualLeft: number,
  actualRight: number,
): Record<string, number> {
  return Object.fromEntries(experts.map((expert) => {
    const marginals = calculateMarginals(expert.pairProbabilities);
    const pairLoss = pairBrierLoss(expert.pairProbabilities, actualLeft, actualRight);
    const leftLoss = positionalBrierLoss(marginals.left, actualLeft);
    const rightLoss = positionalBrierLoss(marginals.right, actualRight);
    return [expert.id, combinedLoss(pairLoss, leftLoss, rightLoss)];
  }));
}

export function updateExpertWeights(
  experts: readonly AdaptiveExpertOutput[],
  currentWeights: Readonly<Record<string, number>>,
  losses: Readonly<Record<string, number>>,
): Record<string, number> {
  const baseline = baselineWeights(experts);
  const resolved = resolveExpertWeights(experts, currentWeights);
  const posteriorRaw = Object.fromEntries(experts.map((expert) => {
    const loss = Number.isFinite(losses[expert.id]) ? Math.max(0, losses[expert.id]) : 1;
    return [expert.id, (resolved[expert.id] ?? 0) * Math.exp(-ADAPTIVE_LEARNING_RATE * loss)];
  }));
  const posterior = normalizeWeights(posteriorRaw);

  return normalizeWeights(Object.fromEntries(experts.map((expert) => [
    expert.id,
    (1 - ADAPTIVE_FIXED_SHARE) * (posterior[expert.id] ?? 0) +
      ADAPTIVE_FIXED_SHARE * (baseline[expert.id] ?? 0),
  ])));
}

function aggregateWeights(
  experts: readonly AdaptiveExpertOutput[],
  weights: Readonly<Record<string, number>>,
): { familyWeights: Record<string, number>; horizonWeights: Record<string, number> } {
  const familyWeights: Record<string, number> = {};
  const horizonWeights: Record<string, number> = {};

  for (const expert of experts) {
    const weight = weights[expert.id] ?? 0;
    familyWeights[expert.family] = (familyWeights[expert.family] ?? 0) + weight;
    const horizon = String(expert.horizon);
    horizonWeights[horizon] = (horizonWeights[horizon] ?? 0) + weight;
  }

  return {
    familyWeights: normalizeWeights(familyWeights),
    horizonWeights: normalizeWeights(horizonWeights),
  };
}

function validateDraws(draws: readonly string[]): void {
  if (draws.length < 2) throw new Error("Adaptive membutuhkan minimal 2 result 4D.");
  if (draws.some((draw) => !/^\d{4}$/.test(draw))) {
    throw new Error("Histori Adaptive harus berupa result 4D.");
  }
}

function isCompatibleState(
  state: AdaptiveLearningState | null | undefined,
  draws: readonly string[],
  target2D: Target2D,
): state is AdaptiveLearningState {
  if (!state) return false;
  if (state.engineVersion !== ADAPTIVE_ENGINE_VERSION || state.configVersion !== ADAPTIVE_CONFIG_VERSION) {
    return false;
  }
  if (state.target2D !== target2D) return false;
  if (!Number.isInteger(state.processedHistoryLength) || state.processedHistoryLength < 2) return false;
  if (state.processedHistoryLength > draws.length) return false;
  return draws[state.processedHistoryLength - 1] === state.lastProcessedDraw;
}

function isRollingState(
  state: AdaptiveLearningState | null | undefined,
  draws: readonly string[],
  target2D: Target2D,
  options: AdaptiveRunOptions,
): state is AdaptiveLearningState {
  if (!options.rollingWindowAdvance || !state) return false;
  if (state.engineVersion !== ADAPTIVE_ENGINE_VERSION || state.configVersion !== ADAPTIVE_CONFIG_VERSION) {
    return false;
  }
  if (state.target2D !== target2D) return false;
  if (state.processedHistoryLength !== draws.length || draws.length < 2) return false;
  return state.lastProcessedDraw !== draws[draws.length - 1];
}

function replayRollingWindow(
  draws: readonly string[],
  target2D: Target2D,
  initialState: AdaptiveLearningState,
): ReplayResult {
  const actualDraw = draws[draws.length - 1];
  const historyBeforeActual = draws.slice(0, -1);
  const expertsBefore = buildBaselineExperts(historyBeforeActual, target2D);
  const weightsBefore = resolveExpertWeights(expertsBefore, initialState.expertWeights);
  const weightedBefore = applyExpertWeights(expertsBefore, weightsBefore);
  const ensemble = combinePairMatrices(weightedBefore);
  const ensembleMarginals = calculateMarginals(ensemble);
  const [actualLeft, actualRight] = extractTargetPair(actualDraw, target2D);
  const pairLoss = pairBrierLoss(ensemble, actualLeft, actualRight);
  const leftLoss = positionalBrierLoss(ensembleMarginals.left, actualLeft);
  const rightLoss = positionalBrierLoss(ensembleMarginals.right, actualRight);
  const expertLosses = evaluateExpertLosses(expertsBefore, actualLeft, actualRight);
  const updatedWeights = updateExpertWeights(expertsBefore, weightsBefore, expertLosses);

  const finalExperts = buildBaselineExperts(draws, target2D);
  const finalWeights = resolveExpertWeights(finalExperts, updatedWeights);
  const weightedFinalExperts = applyExpertWeights(finalExperts, finalWeights);
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
    },
    summary: {
      mode: "incremental",
      startHistoryLength: draws.length,
      endHistoryLength: draws.length,
      processedSteps: 1,
      meanEnsembleLoss: combinedLoss(pairLoss, leftLoss, rightLoss),
      expertMeanLosses: expertLosses,
    },
    experts: weightedFinalExperts,
  };
}

export function replayAdaptiveHistory(
  draws: readonly string[],
  target2D: Target2D,
  initialState?: AdaptiveLearningState | null,
  options: AdaptiveRunOptions = {},
): ReplayResult {
  validateDraws(draws);

  if (isRollingState(initialState, draws, target2D, options)) {
    return replayRollingWindow(draws, target2D, initialState);
  }

  const compatible = isCompatibleState(initialState, draws, target2D);
  const fullReplayStart = Math.min(ADAPTIVE_REPLAY_WARMUP, draws.length);
  const startHistoryLength = compatible ? initialState.processedHistoryLength : fullReplayStart;
  let weights: Record<string, number> = compatible ? { ...initialState.expertWeights } : {};
  let ensembleLossTotal = 0;
  let processedSteps = 0;
  const expertLossTotals: Record<string, number> = {};
  const expertLossCounts: Record<string, number> = {};

  for (let actualIndex = startHistoryLength; actualIndex < draws.length; actualIndex++) {
    const history = draws.slice(0, actualIndex);
    const experts = buildBaselineExperts(history, target2D);
    const resolvedWeights = resolveExpertWeights(experts, weights);
    const weightedExperts = applyExpertWeights(experts, resolvedWeights);
    const ensemble = combinePairMatrices(weightedExperts);
    const ensembleMarginals = calculateMarginals(ensemble);
    const [actualLeft, actualRight] = extractTargetPair(draws[actualIndex], target2D);

    const pairLoss = pairBrierLoss(ensemble, actualLeft, actualRight);
    const leftLoss = positionalBrierLoss(ensembleMarginals.left, actualLeft);
    const rightLoss = positionalBrierLoss(ensembleMarginals.right, actualRight);
    ensembleLossTotal += combinedLoss(pairLoss, leftLoss, rightLoss);

    const expertLosses = evaluateExpertLosses(experts, actualLeft, actualRight);
    for (const [id, loss] of Object.entries(expertLosses)) {
      expertLossTotals[id] = (expertLossTotals[id] ?? 0) + loss;
      expertLossCounts[id] = (expertLossCounts[id] ?? 0) + 1;
    }

    weights = updateExpertWeights(experts, resolvedWeights, expertLosses);
    processedSteps += 1;
  }

  const finalExperts = buildBaselineExperts(draws, target2D);
  const finalWeights = resolveExpertWeights(finalExperts, weights);
  const weightedFinalExperts = applyExpertWeights(finalExperts, finalWeights);
  const aggregates = aggregateWeights(finalExperts, finalWeights);
  const mode: AdaptiveReplaySummary["mode"] = compatible
    ? (processedSteps > 0 ? "incremental" : "noop")
    : "full";

  const expertMeanLosses = Object.fromEntries(
    Object.entries(expertLossTotals).map(([id, total]) => [id, total / (expertLossCounts[id] ?? 1)]),
  );

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
    },
    summary: {
      mode,
      startHistoryLength,
      endHistoryLength: draws.length,
      processedSteps,
      meanEnsembleLoss: processedSteps > 0 ? ensembleLossTotal / processedSteps : 0,
      expertMeanLosses,
    },
    experts: weightedFinalExperts,
  };
}

export function settlePendingPrediction(
  pending: AdaptivePendingPrediction | null | undefined,
  draws: readonly string[],
  target2D: Target2D,
  options: AdaptiveRunOptions = {},
): AdaptiveSettlement | null {
  if (!pending) return null;
  if (pending.engineVersion !== ADAPTIVE_ENGINE_VERSION || pending.configVersion !== ADAPTIVE_CONFIG_VERSION) {
    return null;
  }
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
    ? draws.slice(0, -1)
    : draws.slice(0, pending.historyLength);
  const [actualLeft, actualRight] = extractTargetPair(actualDraw, target2D);
  const pairLoss = pairBrierLoss(pending.pairProbabilities, actualLeft, actualRight);
  const leftLoss = positionalBrierLoss(pending.leftProbabilities, actualLeft);
  const rightLoss = positionalBrierLoss(pending.rightProbabilities, actualRight);

  const historicalExperts = buildBaselineExperts(historicalDraws, target2D);
  const weightsBefore = resolveExpertWeights(historicalExperts, pending.expertWeights);
  const expertLosses = evaluateExpertLosses(historicalExperts, actualLeft, actualRight);
  const weightsAfter = updateExpertWeights(historicalExperts, weightsBefore, expertLosses);
  const aiResults: Record<string, boolean> = {};
  const bbfsResults: Record<string, boolean> = {};

  for (const selection of pending.selections) {
    const selected = new Set(selection.digits);
    const key = String(selection.digitCount);
    if (selection.method === "ai") {
      aiResults[key] = selected.has(actualLeft) || selected.has(actualRight);
    } else {
      bbfsResults[key] = selected.has(actualLeft) && selected.has(actualRight);
    }
  }

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
  };
}
