import {
  createUniformPairMatrix,
  normalizePairMatrix,
  pairIndex,
} from "./pair-probability.mts";
import { extractTargetPair } from "./targets.mts";
import type {
  AdaptiveExpertOutput,
  AdaptiveTimescale,
  PairMatrix,
  Target2D,
} from "./types.mts";
import { ADAPTIVE_MAX_HISTORY } from "./types.mts";

export const ADAPTIVE_WINDOW_EXPERT_ID = "adaptive-window";

const SMOOTHING = 1;
const EPSILON = 1e-9;
const REGIME_EVIDENCE_THRESHOLD = 30;
const REGIME_MIN_SEGMENT = 21;
const REGIME_CANDIDATE_HORIZONS = [21, 42, 85] as const;

type RegimeFeature = "left" | "right" | "sum" | "difference";

interface AdaptiveRegime {
  horizon: 21 | 42 | 85 | 170;
  evidence: number;
}

function historyWindow(draws: readonly string[], horizon = ADAPTIVE_MAX_HISTORY): string[] {
  const bounded = draws.slice(Math.max(0, draws.length - ADAPTIVE_MAX_HISTORY));
  return bounded.slice(Math.max(0, bounded.length - horizon));
}

function normalizeVector(values: readonly number[]): number[] {
  const safe = values.map((value) => Number.isFinite(value) && value > 0 ? value : 0);
  const total = safe.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return Array.from({ length: 10 }, () => 0.1);
  return safe.map((value) => value / total);
}

function outerProduct(left: readonly number[], right: readonly number[]): PairMatrix {
  const matrix = Array.from({ length: 100 }, () => 0);
  for (let a = 0; a < 10; a++) {
    for (let b = 0; b < 10; b++) matrix[pairIndex(a, b)] = left[a] * right[b];
  }
  return normalizePairMatrix(matrix);
}

function marginals(matrix: readonly number[]): { left: number[]; right: number[] } {
  const normalized = normalizePairMatrix(matrix);
  const left = Array.from({ length: 10 }, () => 0);
  const right = Array.from({ length: 10 }, () => 0);
  for (let a = 0; a < 10; a++) {
    for (let b = 0; b < 10; b++) {
      const probability = normalized[pairIndex(a, b)];
      left[a] += probability;
      right[b] += probability;
    }
  }
  return { left, right };
}

function positionalFrequency(draws: readonly string[], target: Target2D): PairMatrix {
  const leftCounts = Array.from({ length: 10 }, () => SMOOTHING);
  const rightCounts = Array.from({ length: 10 }, () => SMOOTHING);
  for (const draw of draws) {
    const [left, right] = extractTargetPair(draw, target);
    leftCounts[left] += 1;
    rightCounts[right] += 1;
  }
  return outerProduct(normalizeVector(leftCounts), normalizeVector(rightCounts));
}

function directPairFrequency(draws: readonly string[], target: Target2D): PairMatrix {
  const counts = Array.from({ length: 100 }, () => SMOOTHING / 100);
  for (const draw of draws) {
    const [left, right] = extractTargetPair(draw, target);
    counts[pairIndex(left, right)] += 1;
  }
  return normalizePairMatrix(counts);
}

function bayesianPairFrequency(
  draws: readonly string[],
  target: Target2D,
  priorStrength = 14,
): PairMatrix {
  const prior = positionalFrequency(draws, target);
  const counts = prior.map((probability) => probability * priorStrength);
  for (const draw of draws) {
    const [left, right] = extractTargetPair(draw, target);
    counts[pairIndex(left, right)] += 1;
  }
  return normalizePairMatrix(counts);
}

function decayedPairFrequency(
  draws: readonly string[],
  target: Target2D,
  decay: number,
): PairMatrix {
  const counts = Array.from({ length: 100 }, () => SMOOTHING / 100);
  const latestIndex = draws.length - 1;
  for (let index = 0; index < draws.length; index++) {
    const age = latestIndex - index;
    const [left, right] = extractTargetPair(draws[index], target);
    counts[pairIndex(left, right)] += Math.pow(decay, age);
  }
  return normalizePairMatrix(counts);
}

function weightedMatrices(entries: readonly { matrix: PairMatrix; weight: number }[]): PairMatrix {
  const combined = Array.from({ length: 100 }, () => 0);
  for (const entry of entries) {
    for (let index = 0; index < 100; index++) {
      combined[index] += entry.matrix[index] * Math.max(0, entry.weight);
    }
  }
  return normalizePairMatrix(combined);
}

function adaptiveDecay(
  draws: readonly string[],
  target: Target2D,
  regime: AdaptiveRegime,
): PairMatrix {
  const drift = regime.horizon === 21
    ? 1
    : regime.horizon === 42
    ? 2 / 3
    : regime.horizon === 85
    ? 1 / 3
    : 0;
  const matrices = [
    { matrix: decayedPairFrequency(draws, target, 0.86), weight: 0.15 + 0.45 * drift },
    { matrix: decayedPairFrequency(draws, target, 0.92), weight: 0.25 + 0.20 * drift },
    { matrix: decayedPairFrequency(draws, target, 0.96), weight: 0.30 - 0.05 * drift },
    { matrix: decayedPairFrequency(draws, target, 0.985), weight: 0.30 - 0.25 * drift },
  ];
  return weightedMatrices(matrices);
}

function hierarchicalPairTransition(draws: readonly string[], target: Target2D): PairMatrix {
  if (draws.length < 2) return bayesianPairFrequency(draws, target);
  const backoff = bayesianPairFrequency(draws, target, 18);
  const latest = extractTargetPair(draws[draws.length - 1], target);
  const latestIndex = pairIndex(latest[0], latest[1]);
  const counts = backoff.map((probability) => probability * 8);
  let matches = 0;
  for (let index = 0; index < draws.length - 1; index++) {
    const current = extractTargetPair(draws[index], target);
    if (pairIndex(current[0], current[1]) !== latestIndex) continue;
    const next = extractTargetPair(draws[index + 1], target);
    counts[pairIndex(next[0], next[1])] += 1;
    matches += 1;
  }
  return matches === 0 ? backoff : normalizePairMatrix(counts);
}

function markovPosition(
  draws: readonly string[],
  target: Target2D,
  mode: "self" | "cross",
  lag = 1,
): PairMatrix {
  if (draws.length <= lag) return positionalFrequency(draws, target);
  const leftTransitions = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => 0.5));
  const rightTransitions = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => 0.5));

  for (let index = lag; index < draws.length; index++) {
    const previous = extractTargetPair(draws[index - lag], target);
    const next = extractTargetPair(draws[index], target);
    const leftCondition = mode === "self" ? previous[0] : previous[1];
    const rightCondition = mode === "self" ? previous[1] : previous[0];
    leftTransitions[leftCondition][next[0]] += 1;
    rightTransitions[rightCondition][next[1]] += 1;
  }

  const query = extractTargetPair(draws[Math.max(0, draws.length - lag)], target);
  const leftCondition = mode === "self" ? query[0] : query[1];
  const rightCondition = mode === "self" ? query[1] : query[0];
  return outerProduct(
    normalizeVector(leftTransitions[leftCondition]),
    normalizeVector(rightTransitions[rightCondition]),
  );
}

function gapAdjustedVector(
  draws: readonly string[],
  target: Target2D,
  side: 0 | 1,
): number[] {
  const base = marginals(positionalFrequency(draws, target))[side === 0 ? "left" : "right"];
  const output = [...base];
  for (let digit = 0; digit < 10; digit++) {
    const indexes: number[] = [];
    for (let index = 0; index < draws.length; index++) {
      if (extractTargetPair(draws[index], target)[side] === digit) indexes.push(index);
    }
    if (indexes.length < 2) continue;
    const gaps = indexes.slice(1).map((value, index) => value - indexes[index]);
    const mean = gaps.reduce((sum, value) => sum + value, 0) / gaps.length;
    const currentGap = draws.length - indexes[indexes.length - 1];
    const distance = Math.abs(currentGap - mean) / Math.max(1, mean + 1);
    const recurrence = 0.6 + Math.exp(-distance);
    const overdue = 1 + 0.15 * Math.tanh((currentGap - mean) / Math.max(1, mean));
    output[digit] *= recurrence * overdue;
  }
  return normalizeVector(output);
}

function digitGapHazard(draws: readonly string[], target: Target2D): PairMatrix {
  return outerProduct(gapAdjustedVector(draws, target, 0), gapAdjustedVector(draws, target, 1));
}

function pairGapHazard(draws: readonly string[], target: Target2D): PairMatrix {
  const base = bayesianPairFrequency(draws, target, 18);
  const output = [...base];
  const occurrences = Array.from({ length: 100 }, () => [] as number[]);
  for (let index = 0; index < draws.length; index++) {
    const [left, right] = extractTargetPair(draws[index], target);
    occurrences[pairIndex(left, right)].push(index);
  }
  for (let pair = 0; pair < 100; pair++) {
    const indexes = occurrences[pair];
    if (indexes.length < 3) continue;
    const gaps = indexes.slice(1).map((value, index) => value - indexes[index]);
    const mean = gaps.reduce((sum, value) => sum + value, 0) / gaps.length;
    const currentGap = draws.length - indexes[indexes.length - 1];
    const distance = Math.abs(currentGap - mean) / Math.max(1, mean + 1);
    output[pair] *= 0.65 + Math.exp(-distance);
  }
  return normalizePairMatrix(output);
}

function repeatAdjusted(base: readonly number[], lastDigit: number, repeatProbability: number): number[] {
  const output = Array.from({ length: 10 }, () => 0);
  const boundedRepeat = Math.max(0.02, Math.min(0.98, repeatProbability));
  output[lastDigit] = boundedRepeat;
  const remainingBase = base.reduce((sum, value, digit) =>
    digit === lastDigit ? sum : sum + value, 0);
  for (let digit = 0; digit < 10; digit++) {
    if (digit === lastDigit) continue;
    output[digit] = (1 - boundedRepeat) * (remainingBase > 0 ? base[digit] / remainingBase : 1 / 9);
  }
  return normalizeVector(output);
}

function repeatSwitchModel(draws: readonly string[], target: Target2D): PairMatrix {
  if (draws.length < 2) return positionalFrequency(draws, target);
  let leftRepeats = 0;
  let rightRepeats = 0;
  for (let index = 1; index < draws.length; index++) {
    const previous = extractTargetPair(draws[index - 1], target);
    const current = extractTargetPair(draws[index], target);
    if (previous[0] === current[0]) leftRepeats += 1;
    if (previous[1] === current[1]) rightRepeats += 1;
  }
  const transitions = draws.length - 1;
  const base = marginals(positionalFrequency(draws, target));
  const latest = extractTargetPair(draws[draws.length - 1], target);
  return outerProduct(
    repeatAdjusted(base.left, latest[0], (leftRepeats + 1) / (transitions + 2)),
    repeatAdjusted(base.right, latest[1], (rightRepeats + 1) / (transitions + 2)),
  );
}

function momentumPair(
  draws: readonly string[],
  target: Target2D,
  shortHorizon: number,
  longHorizon: number,
  gamma = 0.35,
): PairMatrix {
  const short = bayesianPairFrequency(historyWindow(draws, shortHorizon), target, 10);
  const long = bayesianPairFrequency(historyWindow(draws, longHorizon), target, 18);
  return normalizePairMatrix(long.map((probability, index) => {
    const ratio = (short[index] + EPSILON) / (long[index] + EPSILON);
    return probability * Math.pow(ratio, gamma);
  }));
}

function regimeBucket(draw: string, target: Target2D, feature: RegimeFeature): number {
  const [left, right] = extractTargetPair(draw, target);
  if (feature === "left") return left;
  if (feature === "right") return right;
  if (feature === "sum") return (left + right) % 10;
  return (left - right + 10) % 10;
}

function regimeCounts(
  draws: readonly string[],
  target: Target2D,
  feature: RegimeFeature,
): number[] {
  const counts = Array.from({ length: 10 }, () => 0);
  for (const draw of draws) counts[regimeBucket(draw, target, feature)] += 1;
  return counts;
}

function twoSamplePearson(left: readonly number[], right: readonly number[]): number {
  const leftTotal = left.reduce((sum, value) => sum + value, 0);
  const rightTotal = right.reduce((sum, value) => sum + value, 0);
  const total = leftTotal + rightTotal;
  if (leftTotal <= 0 || rightTotal <= 0 || total <= 0) return 0;

  let statistic = 0;
  for (let index = 0; index < 10; index++) {
    const pooled = (left[index] ?? 0) + (right[index] ?? 0);
    if (pooled <= 0) continue;
    const expectedLeft = leftTotal * pooled / total;
    const expectedRight = rightTotal * pooled / total;
    if (expectedLeft > 0) statistic += Math.pow((left[index] ?? 0) - expectedLeft, 2) / expectedLeft;
    if (expectedRight > 0) statistic += Math.pow((right[index] ?? 0) - expectedRight, 2) / expectedRight;
  }
  return statistic;
}

function regimeEvidence(
  draws: readonly string[],
  target: Target2D,
  horizon: 21 | 42 | 85,
): number {
  const recent = draws.slice(-horizon);
  const baseline = draws.slice(0, Math.max(0, draws.length - horizon));
  if (recent.length < REGIME_MIN_SEGMENT || baseline.length < REGIME_MIN_SEGMENT) return 0;

  const features: readonly RegimeFeature[] = ["left", "right", "sum", "difference"];
  return Math.max(...features.map((feature) =>
    twoSamplePearson(
      regimeCounts(recent, target, feature),
      regimeCounts(baseline, target, feature),
    )
  ));
}

function detectAdaptiveRegime(draws: readonly string[], target: Target2D): AdaptiveRegime {
  const bounded = historyWindow(draws, ADAPTIVE_MAX_HISTORY);
  let best: AdaptiveRegime = { horizon: 170, evidence: 0 };

  for (const horizon of REGIME_CANDIDATE_HORIZONS) {
    const evidence = regimeEvidence(bounded, target, horizon);
    if (evidence > best.evidence) best = { horizon, evidence };
  }

  // Ambang konservatif membatasi false regime switch akibat sparsity 21 sampel.
  // Tanpa bukti kuat, window panjang 170 menjadi default yang stabil.
  return best.evidence >= REGIME_EVIDENCE_THRESHOLD
    ? best
    : { horizon: 170, evidence: best.evidence };
}

function adaptiveWindow(
  draws: readonly string[],
  target: Target2D,
  regime: AdaptiveRegime,
): { matrix: PairMatrix; horizon: number } {
  return {
    matrix: bayesianPairFrequency(historyWindow(draws, regime.horizon), target, 14),
    horizon: regime.horizon,
  };
}

function fullDigits(draw: string): [number, number, number, number] {
  return [Number(draw[0]), Number(draw[1]), Number(draw[2]), Number(draw[3])];
}

function crossPositionConditional(draws: readonly string[], target: Target2D): PairMatrix {
  if (draws.length < 2) return bayesianPairFrequency(draws, target);
  const base = bayesianPairFrequency(draws, target, 18);
  const counts = base.map((probability) => probability * 8);
  const latest = fullDigits(draws[draws.length - 1]);
  let support = 0;
  for (let index = 0; index < draws.length - 1; index++) {
    const previous = fullDigits(draws[index]);
    let weight = 0;
    if (previous[0] === latest[0]) weight += 0.75;
    if (previous[1] === latest[1]) weight += 0.75;
    if (previous[0] === latest[0] && previous[1] === latest[1]) weight += 1.5;
    if (weight <= 0) continue;
    const next = extractTargetPair(draws[index + 1], target);
    counts[pairIndex(next[0], next[1])] += weight;
    support += 1;
  }
  return support === 0 ? base : normalizePairMatrix(counts);
}

function previous4DNaiveBayes(draws: readonly string[], target: Target2D): PairMatrix {
  if (draws.length < 2) return bayesianPairFrequency(draws, target);
  const base = bayesianPairFrequency(draws, target, 20);
  const latest = fullDigits(draws[draws.length - 1]);
  const conditionals: PairMatrix[] = [];

  for (let position = 0; position < 4; position++) {
    const counts = base.map((probability) => probability * 5);
    let matches = 0;
    for (let index = 0; index < draws.length - 1; index++) {
      if (fullDigits(draws[index])[position] !== latest[position]) continue;
      const next = extractTargetPair(draws[index + 1], target);
      counts[pairIndex(next[0], next[1])] += 1;
      matches += 1;
    }
    if (matches > 0) conditionals.push(normalizePairMatrix(counts));
  }

  if (conditionals.length === 0) return base;
  return normalizePairMatrix(base.map((probability, index) => {
    let score = probability;
    for (const conditional of conditionals) {
      score *= Math.pow((conditional[index] + EPSILON) / (probability + EPSILON), 0.22);
    }
    return score;
  }));
}

function structuralFeatures(draw: string): [number, number, number] {
  const [a, c, k, e] = fullDigits(draw);
  return [(a + c) % 10, (a + e) % 10, (c + k) % 10];
}

function laggedPositionInteraction(draws: readonly string[], target: Target2D): PairMatrix {
  if (draws.length < 3) return bayesianPairFrequency(draws, target);
  const base = bayesianPairFrequency(draws, target, 18);
  const query = structuralFeatures(draws[draws.length - 2]);
  const counts = base.map((probability) => probability * 7);
  let support = 0;
  for (let index = 2; index < draws.length; index++) {
    const features = structuralFeatures(draws[index - 2]);
    let weight = 0;
    for (let feature = 0; feature < query.length; feature++) {
      if (features[feature] === query[feature]) weight += 0.75;
    }
    if (weight <= 0) continue;
    const next = extractTargetPair(draws[index], target);
    counts[pairIndex(next[0], next[1])] += weight;
    support += 1;
  }
  return support === 0 ? base : normalizePairMatrix(counts);
}

function variableOrderDigit(
  draws: readonly string[],
  target: Target2D,
  side: 0 | 1,
): { vector: number[]; fallbackLevel: number } {
  const sequence = draws.map((draw) => extractTargetPair(draw, target)[side]);
  const base = marginals(positionalFrequency(draws, target))[side === 0 ? "left" : "right"];
  for (const order of [3, 2, 1]) {
    if (sequence.length <= order) continue;
    const query = sequence.slice(-order);
    const counts = base.map((probability) => probability * 4);
    let matches = 0;
    for (let index = order; index < sequence.length; index++) {
      let same = true;
      for (let offset = 0; offset < order; offset++) {
        if (sequence[index - order + offset] !== query[offset]) {
          same = false;
          break;
        }
      }
      if (!same) continue;
      counts[sequence[index]] += 1;
      matches += 1;
    }
    const required = order === 3 ? 2 : order === 2 ? 2 : 1;
    if (matches >= required) return { vector: normalizeVector(counts), fallbackLevel: 3 - order };
  }
  return { vector: base, fallbackLevel: 3 };
}

function variableOrderPair(draws: readonly string[], target: Target2D): { matrix: PairMatrix; fallbackLevel: number } {
  const sequence = draws.map((draw) => {
    const [left, right] = extractTargetPair(draw, target);
    return pairIndex(left, right);
  });
  const base = bayesianPairFrequency(draws, target, 20);
  for (const order of [2, 1]) {
    if (sequence.length <= order) continue;
    const query = sequence.slice(-order);
    const counts = base.map((probability) => probability * 8);
    let matches = 0;
    for (let index = order; index < sequence.length; index++) {
      let same = true;
      for (let offset = 0; offset < order; offset++) {
        if (sequence[index - order + offset] !== query[offset]) {
          same = false;
          break;
        }
      }
      if (!same) continue;
      counts[sequence[index]] += 1;
      matches += 1;
    }
    if (matches >= (order === 2 ? 2 : 1)) {
      return { matrix: normalizePairMatrix(counts), fallbackLevel: 2 - order };
    }
  }
  return { matrix: base, fallbackLevel: 2 };
}

function entropy(matrix: readonly number[]): number {
  const normalized = normalizePairMatrix(matrix);
  const raw = normalized.reduce((sum, probability) =>
    probability > 0 ? sum - probability * Math.log(probability) : sum, 0);
  return raw / Math.log(100);
}

function expert(
  id: string,
  family: string,
  horizon: number,
  matrix: PairMatrix,
  historyLength: number,
  timescale: AdaptiveTimescale,
  fallbackLevel = 0,
): AdaptiveExpertOutput {
  const effectiveHistory = Math.min(historyLength, horizon || ADAPTIVE_MAX_HISTORY);
  return {
    id,
    family,
    horizon,
    weight: 1,
    pairProbabilities: normalizePairMatrix(matrix),
    effectiveHistory,
    effectiveSampleSize: effectiveHistory,
    supportScore: Math.max(0, Math.min(1, effectiveHistory / 85)),
    entropy: entropy(matrix),
    fallbackLevel,
    timescale,
  };
}

function assignFamilyPriors(experts: AdaptiveExpertOutput[]): AdaptiveExpertOutput[] {
  const familyCounts = new Map<string, number>();
  for (const item of experts) familyCounts.set(item.family, (familyCounts.get(item.family) ?? 0) + 1);
  const predictiveFamilies = [...familyCounts.keys()].filter((family) => family !== "null");
  const predictiveBudget = familyCounts.has("null") ? 0.95 : 1;
  const familyBudget = predictiveFamilies.length > 0 ? predictiveBudget / predictiveFamilies.length : 0;

  return experts.map((item) => {
    const count = familyCounts.get(item.family) ?? 1;
    const budget = item.family === "null" ? 0.05 : familyBudget;
    return { ...item, weight: budget / count };
  });
}

/**
 * Adaptive V2: 28 expert dengan reservoir maksimum 170 result. Horizon fixed
 * hanya dipakai jika memang bagian dari hipotesis expert; model structural,
 * recurrence dan context menggunakan seluruh reservoir 170.
 */
export function buildBaselineExperts(draws: readonly string[], target: Target2D): AdaptiveExpertOutput[] {
  const history = historyWindow(draws, ADAPTIVE_MAX_HISTORY);
  const length = history.length;
  const positional21 = positionalFrequency(historyWindow(history, 21), target);
  const positional85 = positionalFrequency(historyWindow(history, 85), target);
  const positional170 = positionalFrequency(history, target);
  const direct42 = directPairFrequency(historyWindow(history, 42), target);
  const direct85 = directPairFrequency(historyWindow(history, 85), target);
  const direct170 = directPairFrequency(history, target);
  const regime = detectAdaptiveRegime(history, target);
  const adaptive = adaptiveWindow(history, target, regime);
  const leftContext = variableOrderDigit(history, target, 0);
  const rightContext = variableOrderDigit(history, target, 1);
  const pairContext = variableOrderPair(history, target);
  const baseMarginals = marginals(positional170);

  const experts: AdaptiveExpertOutput[] = [
    expert("uniform-null:170", "null", 170, createUniformPairMatrix(), length, "null"),

    expert("positional-frequency:21", "positional-frequency", 21, positional21, length, "short"),
    expert("positional-frequency:85", "positional-frequency", 85, positional85, length, "medium"),
    expert("positional-frequency:170", "positional-frequency", 170, positional170, length, "long"),

    expert("direct-pair-frequency:42", "direct-pair-frequency", 42, direct42, length, "short"),
    expert("direct-pair-frequency:85", "direct-pair-frequency", 85, direct85, length, "medium"),
    expert("direct-pair-frequency:170", "direct-pair-frequency", 170, direct170, length, "long"),

    expert("bayesian-pair:85", "bayesian-pair", 85, bayesianPairFrequency(historyWindow(history, 85), target), length, "medium"),
    expert("bayesian-pair:170", "bayesian-pair", 170, bayesianPairFrequency(history, target), length, "long"),

    expert("decay-fast:170", "recency", 170, decayedPairFrequency(history, target, 0.90), length, "adaptive"),
    expert("decay-slow:170", "recency", 170, decayedPairFrequency(history, target, 0.975), length, "long"),
    expert("adaptive-decay:170", "recency", 170, adaptiveDecay(history, target, regime), length, "adaptive"),

    expert("hierarchical-pair-transition:170", "transition", 170, hierarchicalPairTransition(history, target), length, "adaptive"),

    expert("position-markov-self:170", "markov", 170, markovPosition(history, target, "self", 1), length, "long"),
    expert("position-markov-cross:170", "markov", 170, markovPosition(history, target, "cross", 1), length, "long"),
    expert("position-markov-lag2:170", "markov", 170, markovPosition(history, target, "self", 2), length, "long"),

    expert("digit-gap-hazard:170", "recurrence", 170, digitGapHazard(history, target), length, "long"),
    expert("pair-gap-hazard:170", "recurrence", 170, pairGapHazard(history, target), length, "long"),
    expert("repeat-switch:170", "recurrence", 170, repeatSwitchModel(history, target), length, "long"),

    expert("momentum:21-85", "momentum", 85, momentumPair(history, target, 21, 85), length, "medium"),
    expert("momentum:42-170", "momentum", 170, momentumPair(history, target, 42, 170), length, "long"),

    // Horizon adalah parameter dinamis, bukan identitas expert. ID harus tetap
    // stabil agar bobot yang sudah dipelajari tidak terputus saat regime berganti.
    expert(ADAPTIVE_WINDOW_EXPERT_ID, "regime", adaptive.horizon, adaptive.matrix, length, "adaptive"),

    expert("cross-position-conditional:170", "structural", 170, crossPositionConditional(history, target), length, "long"),
    expert("previous-4d-naive-bayes:170", "structural", 170, previous4DNaiveBayes(history, target), length, "long"),
    expert("lagged-position-interaction:170", "structural", 170, laggedPositionInteraction(history, target), length, "long"),

    expert("variable-order-left:170", "context", 170, outerProduct(leftContext.vector, baseMarginals.right), length, "adaptive", leftContext.fallbackLevel),
    expert("variable-order-right:170", "context", 170, outerProduct(baseMarginals.left, rightContext.vector), length, "adaptive", rightContext.fallbackLevel),
    expert("variable-order-pair:170", "context", 170, pairContext.matrix, length, "adaptive", pairContext.fallbackLevel),
  ];

  return assignFamilyPriors(experts);
}
