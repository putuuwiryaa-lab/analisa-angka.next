import { normalizePairMatrix, pairIndex } from "./pair-probability.mts";
import { extractTargetPair } from "./targets.mts";
import type { AdaptiveExpertOutput, PairMatrix, Target2D } from "./types.mts";

const SMOOTHING = 1;

function historyWindow(draws: readonly string[], horizon: number): string[] {
  return draws.slice(Math.max(0, draws.length - horizon));
}

function positionalFrequency(draws: readonly string[], target: Target2D): PairMatrix {
  const leftCounts = Array.from({ length: 10 }, () => SMOOTHING);
  const rightCounts = Array.from({ length: 10 }, () => SMOOTHING);

  for (const draw of draws) {
    const [left, right] = extractTargetPair(draw, target);
    leftCounts[left] += 1;
    rightCounts[right] += 1;
  }

  const leftTotal = leftCounts.reduce((sum, count) => sum + count, 0);
  const rightTotal = rightCounts.reduce((sum, count) => sum + count, 0);
  const matrix = Array.from({ length: 100 }, () => 0);

  for (let left = 0; left < 10; left++) {
    for (let right = 0; right < 10; right++) {
      matrix[pairIndex(left, right)] = (leftCounts[left] / leftTotal) * (rightCounts[right] / rightTotal);
    }
  }

  return normalizePairMatrix(matrix);
}

function directPairFrequency(draws: readonly string[], target: Target2D): PairMatrix {
  const counts = Array.from({ length: 100 }, () => SMOOTHING / 100);
  for (const draw of draws) {
    const [left, right] = extractTargetPair(draw, target);
    counts[pairIndex(left, right)] += 1;
  }
  return normalizePairMatrix(counts);
}

function decayedPairFrequency(draws: readonly string[], target: Target2D, decay = 0.94): PairMatrix {
  const counts = Array.from({ length: 100 }, () => SMOOTHING / 100);
  const latestIndex = draws.length - 1;

  for (let index = 0; index < draws.length; index++) {
    const age = latestIndex - index;
    const weight = Math.pow(decay, age);
    const [left, right] = extractTargetPair(draws[index], target);
    counts[pairIndex(left, right)] += weight;
  }

  return normalizePairMatrix(counts);
}

function transitionPairFrequency(draws: readonly string[], target: Target2D): PairMatrix {
  if (draws.length < 2) return directPairFrequency(draws, target);

  const latestPair = extractTargetPair(draws[draws.length - 1], target);
  const latestPairIndex = pairIndex(latestPair[0], latestPair[1]);
  const directBackoff = directPairFrequency(draws, target);
  const counts = directBackoff.map((probability) => probability * 4);
  let matches = 0;

  for (let index = 0; index < draws.length - 1; index++) {
    const current = extractTargetPair(draws[index], target);
    if (pairIndex(current[0], current[1]) !== latestPairIndex) continue;
    const next = extractTargetPair(draws[index + 1], target);
    counts[pairIndex(next[0], next[1])] += 1;
    matches += 1;
  }

  return matches === 0 ? directBackoff : normalizePairMatrix(counts);
}

export function buildBaselineExperts(draws: readonly string[], target: Target2D): AdaptiveExpertOutput[] {
  const horizons = [14, 28, 56, 112].filter((horizon) => draws.length >= Math.min(7, horizon));
  const effectiveHorizons = horizons.length > 0 ? horizons : [Math.max(1, draws.length)];
  const experts: AdaptiveExpertOutput[] = [];

  for (const horizon of effectiveHorizons) {
    const window = historyWindow(draws, horizon);
    experts.push(
      {
        id: `positional-frequency:${horizon}`,
        family: "positional-frequency",
        horizon,
        weight: 1,
        pairProbabilities: positionalFrequency(window, target),
      },
      {
        id: `direct-pair-frequency:${horizon}`,
        family: "direct-pair-frequency",
        horizon,
        weight: 1,
        pairProbabilities: directPairFrequency(window, target),
      },
      {
        id: `decayed-pair-frequency:${horizon}`,
        family: "decayed-pair-frequency",
        horizon,
        weight: 1,
        pairProbabilities: decayedPairFrequency(window, target),
      },
    );

    if (window.length >= 14) {
      experts.push({
        id: `pair-transition:${horizon}`,
        family: "pair-transition",
        horizon,
        weight: 1,
        pairProbabilities: transitionPairFrequency(window, target),
      });
    }
  }

  const familyCounts = new Map<string, number>();
  for (const expert of experts) familyCounts.set(expert.family, (familyCounts.get(expert.family) ?? 0) + 1);

  return experts.map((expert) => ({
    ...expert,
    weight: 1 / (familyCounts.size * (familyCounts.get(expert.family) ?? 1)),
  }));
}
