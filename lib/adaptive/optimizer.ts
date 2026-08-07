import { createUniformPairMatrix, normalizePairMatrix, pairIndex } from "./pair-probability";
import type { AdaptiveMethod, AdaptiveSelection } from "./types";
import { ADAPTIVE_SELECTION_SPECS } from "./types";

interface RankedSubset {
  digits: number[];
  score: number;
}

const COMBINATIONS_BY_SIZE = new Map<number, readonly number[][]>();

function combinations(size: number): readonly number[][] {
  const cached = COMBINATIONS_BY_SIZE.get(size);
  if (cached) return cached;

  const output: number[][] = [];
  function visit(start: number, current: number[]) {
    if (current.length === size) {
      output.push([...current]);
      return;
    }
    const remaining = size - current.length;
    for (let digit = start; digit <= 10 - remaining; digit++) {
      current.push(digit);
      visit(digit + 1, current);
      current.pop();
    }
  }
  visit(0, []);
  COMBINATIONS_BY_SIZE.set(size, output);
  return output;
}

function scoreNormalizedDigitSubset(
  probabilities: readonly number[],
  method: AdaptiveMethod,
  digits: readonly number[],
): number {
  if (method === "bbfs") {
    let score = 0;
    for (const left of digits) {
      for (const right of digits) score += probabilities[pairIndex(left, right)];
    }
    return score;
  }

  const selected = new Set(digits);
  const excluded: number[] = [];
  for (let digit = 0; digit < 10; digit++) {
    if (!selected.has(digit)) excluded.push(digit);
  }
  let uncovered = 0;
  for (const left of excluded) {
    for (const right of excluded) uncovered += probabilities[pairIndex(left, right)];
  }
  return Math.max(0, Math.min(1, 1 - uncovered));
}

export function scoreDigitSubset(
  matrix: readonly number[],
  method: AdaptiveMethod,
  digits: readonly number[],
): number {
  return scoreNormalizedDigitSubset(normalizePairMatrix(matrix), method, digits);
}

function compareRankedSubset(a: RankedSubset, b: RankedSubset): number {
  const scoreDifference = b.score - a.score;
  if (Math.abs(scoreDifference) > 1e-12) return scoreDifference;
  for (let index = 0; index < a.digits.length; index++) {
    if (a.digits[index] !== b.digits[index]) return a.digits[index] - b.digits[index];
  }
  return 0;
}

function digitContribution(
  probabilities: readonly number[],
  method: AdaptiveMethod,
  subset: readonly number[],
  digit: number,
): number {
  const withoutDigit = subset.filter((value) => value !== digit);
  return scoreNormalizedDigitSubset(probabilities, method, subset) -
    scoreNormalizedDigitSubset(probabilities, method, withoutDigit);
}

function orderSelectedDigits(
  probabilities: readonly number[],
  method: AdaptiveMethod,
  digits: readonly number[],
): number[] {
  return [...digits].sort((a, b) => {
    const difference = digitContribution(probabilities, method, digits, b) -
      digitContribution(probabilities, method, digits, a);
    if (Math.abs(difference) > 1e-12) return difference;
    return a - b;
  });
}

function optimizeNormalizedSelection(
  probabilities: readonly number[],
  method: AdaptiveMethod,
  digitCount: number,
): AdaptiveSelection {
  if (!Number.isInteger(digitCount) || digitCount < 1 || digitCount > 9) {
    throw new Error("Jumlah digit Adaptive harus antara 1 dan 9.");
  }

  const ranked = combinations(digitCount)
    .map((digits) => ({
      digits: [...digits],
      score: scoreNormalizedDigitSubset(probabilities, method, digits),
    }))
    .sort(compareRankedSubset);

  const best = ranked[0];
  const runnerUp = ranked[1];
  const uniform = createUniformPairMatrix();
  const baselineSuccess = scoreNormalizedDigitSubset(uniform, method, best.digits);

  return {
    method,
    digitCount,
    digits: orderSelectedDigits(probabilities, method, best.digits),
    estimatedSuccess: best.score,
    baselineSuccess,
    lift: best.score - baselineSuccess,
    selectionMargin: runnerUp ? Math.max(0, best.score - runnerUp.score) : 0,
    calibrationWeights: {},
    calibrationStateRevision: 0,
  };
}

export function optimizeDigitSelection(
  matrix: readonly number[],
  method: AdaptiveMethod,
  digitCount: number,
): AdaptiveSelection {
  return optimizeNormalizedSelection(normalizePairMatrix(matrix), method, digitCount);
}

export function optimizeConfiguredSelections(matrix: readonly number[]): AdaptiveSelection[] {
  const probabilities = normalizePairMatrix(matrix);
  return ADAPTIVE_SELECTION_SPECS.map((spec) =>
    optimizeNormalizedSelection(probabilities, spec.method, spec.digitCount)
  );
}

export function optimizeAllSelections(matrix: readonly number[]): AdaptiveSelection[] {
  const probabilities = normalizePairMatrix(matrix);
  const selections: AdaptiveSelection[] = [];
  for (const method of ["ai", "bbfs"] as const) {
    for (let digitCount = 1; digitCount <= 9; digitCount++) {
      selections.push(optimizeNormalizedSelection(probabilities, method, digitCount));
    }
  }
  return selections;
}
