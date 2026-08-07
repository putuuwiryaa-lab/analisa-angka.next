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
  AdaptiveSettlement,
} from "./types";
import {
  ADAPTIVE_CONFIG_VERSION,
  ADAPTIVE_ENGINE_VERSION,
  ADAPTIVE_REPLAY_WARMUP as V2_REPLAY_WARMUP,
} from "./types";

export const ADAPTIVE_LEARNING_RATE = 1;
export const ADAPTIVE_FIXED_SHARE = 0.02;
export const ADAPTIVE_REPLAY_WARMUP = V2_REPLAY_WARMUP;

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
  return normalizeWeights(Object.fromEntries(experts.map((expert) => [
    expert.id,
    activeStored[expert.id] ?? (baseline[expert.id] ?? 0) * NEW_EXPERT_PRIOR_SHARE,
  ])));
}

function applyExpertWeights(
  experts: readonly AdaptiveExpertOutput[],
  weights: Readonly<Record<string, number>>,
): AdaptiveExpertOutput[] {
  return experts.map((expert) => ({ ...expert, weight: weights[expert.id] ?? 0 }));
}

function combinedLoss(pairLoss: number, leftLoss: number, rightLoss: number): number {
  return pairLoss * PAIR_LOSS_WEIGHT + leftLoss * LEFT_LOSS_WEIGHT + rightLoss * RIGHT_LOSS_WEIGHT;
}

export function evaluateExpertLosses(
  experts: readonly AdaptiveExpertOutput[],
  actualLeft: number,
  actualRight: number,
): Record<string, number> {
  return Object.fromEntries(experts.map((expert) => {
    const expertMarginals = calculateMarginals(expert.pairProbabilities);
    return [expert.id, combinedLoss(
      pairBrierLoss(expert.pairProbabilities, actualLeft, actualRight),
      positionalBrierLoss(expertMarginals.left, actualLeft),
      positionalBrierLoss(expertMarginals.right, actualRight),
    )];
  }));
}

export function updateExpertWeights(
  experts: readonly AdaptiveExpertOutput[],
  currentWeights: Readonly<Record<string, number>>,
  losses: Readonly<Record<string, number>>,
): Record<string, number> {
  const baseline = baselineWeights(experts);
  const resolved = resolveExpertWeights(experts, currentWeights);
  const posterior = normalizeWeights(Object.fromEntries(experts.map((expert) => {
    const loss = Number.isFinite(losses[expert.id]) ? Math.max(0, losses[expert.id]) : 1;
    return [expert.id, (resolved[expert.id] ?? 0) * Math.exp(-ADAPTIVE_LEARNING_RATE * loss)];
  })));
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

function isCompatibleState(
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

export function replayAdaptiveHistory(
  draws: readonly string[],
  target2D: Target2D,
  initialState?: AdaptiveLearningState | null,
): ReplayResult {
  if (draws.length < 2) throw new Error("Adaptive membutuhkan minimal 2 result 4D.");
  if (draws.some((draw) => !/^\d{4}$/.test(draw))) {
    throw new Error("Histori Adaptive harus berupa result 4D.");
  }

  const compatible = isCompatibleState(initialState, draws, target2D);
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
    const resolvedWeights = resolveExpertWeights(experts, weights);
    const ensemble = combinePairMatrices(applyExpertWeights(experts, resolvedWeights));
    const ensembleMarginals = calculateMarginals(ensemble);
    const [actualLeft, actualRight] = extractTargetPair(draws[actualIndex], target2D);
    ensembleLossTotal += combinedLoss(
      pairBrierLoss(ensemble, actualLeft, actualRight),
      positionalBrierLoss(ensembleMarginals.left, actualLeft),
      positionalBrierLoss(ensembleMarginals.right, actualRight),
    );
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
  const aggregates = aggregateWeights(finalExperts, finalWeights);
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
      mode: compatible ? (processedSteps > 0 ? "incremental" : "noop") : "full",
      startHistoryLength,
      endHistoryLength: draws.length,
      processedSteps,
      meanEnsembleLoss: processedSteps > 0 ? ensembleLossTotal / processedSteps : 0,
      expertMeanLosses: Object.fromEntries(
        Object.entries(expertLossTotals).map(([id, total]) => [id, total / (expertLossCounts[id] ?? 1)]),
      ),
    },
    experts: applyExpertWeights(finalExperts, finalWeights),
  };
}

export function settlePendingPrediction(
  pending: AdaptivePendingPrediction | null | undefined,
  draws: readonly string[],
  target2D: Target2D,
): AdaptiveSettlement | null {
  if (!pending) return null;
  if (pending.engineVersion !== ADAPTIVE_ENGINE_VERSION || pending.configVersion !== ADAPTIVE_CONFIG_VERSION) return null;
  if (pending.target2D !== target2D || draws.length <= pending.historyLength) return null;
  const actualDraw = draws[pending.historyLength];
  if (!/^\d{4}$/.test(actualDraw)) return null;
  const [actualLeft, actualRight] = extractTargetPair(actualDraw, target2D);
  const historicalExperts = buildBaselineExperts(draws.slice(0, pending.historyLength), target2D);
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
  };
}
