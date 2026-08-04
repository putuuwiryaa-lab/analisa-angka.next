import type { AdaptiveExpertOutput } from "./types.mts";
import {
  calculateMarginals,
  pairBrierLoss,
  positionalBrierLoss,
} from "./pair-probability.mts";

export const ADAPTIVE_LEARNING_RATE = 1;
export const ADAPTIVE_FIXED_SHARE = 0.02;
const PAIR_LOSS_WEIGHT = 0.7;
const LEFT_LOSS_WEIGHT = 0.15;
const RIGHT_LOSS_WEIGHT = 0.15;
const NEW_EXPERT_PRIOR_SHARE = 0.05;

export function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights)
    .map(([id, value]) => [id, Number.isFinite(value) && value > 0 ? value : 0] as const)
    .filter(([, value]) => value > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return {};
  return Object.fromEntries(entries.map(([id, value]) => [id, value / total]));
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

export function applyExpertWeights(
  experts: readonly AdaptiveExpertOutput[],
  weights: Readonly<Record<string, number>>,
): AdaptiveExpertOutput[] {
  return experts.map((expert) => ({ ...expert, weight: weights[expert.id] ?? 0 }));
}

export function combinedLoss(pairLoss: number, leftLoss: number, rightLoss: number): number {
  return pairLoss * PAIR_LOSS_WEIGHT + leftLoss * LEFT_LOSS_WEIGHT + rightLoss * RIGHT_LOSS_WEIGHT;
}

export function evaluateExpertLosses(
  experts: readonly AdaptiveExpertOutput[],
  actualLeft: number,
  actualRight: number,
): Record<string, number> {
  return Object.fromEntries(experts.map((expert) => {
    const marginals = calculateMarginals(expert.pairProbabilities);
    return [expert.id, combinedLoss(
      pairBrierLoss(expert.pairProbabilities, actualLeft, actualRight),
      positionalBrierLoss(marginals.left, actualLeft),
      positionalBrierLoss(marginals.right, actualRight),
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

export function aggregateWeights(
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
