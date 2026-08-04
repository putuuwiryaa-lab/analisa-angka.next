import { createUniformPairMatrix, normalizePairMatrix, pairIndex } from "./pair-probability.mts";
import type { AdaptiveMethod, AdaptiveSelection } from "./types.mts";

interface RankedSubset {
  digits: number[];
  score: number;
}

function combinations(size: number): number[][] {
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
  return output;
}

function scoreDigitSubset(matrix: readonly number[], method: AdaptiveMethod, digits: readonly number[]): number {
  const probabilities = normalizePairMatrix(matrix);
  const selected = new Set(digits);
  let score = 0;

  for (let left = 0; left < 10; left++) {
    for (let right = 0; right < 10; right++) {
      const covered = method === "ai"
        ? selected.has(left) || selected.has(right)
        : selected.has(left) && selected.has(right);
      if (covered) score += probabilities[pairIndex(left, right)];
    }
  }

  return score;
}

function compareRankedSubset(a: RankedSubset, b: RankedSubset): number {
  const scoreDifference = b.score - a.score;
  if (Math.abs(scoreDifference) > 1e-12) return scoreDifference;

  for (let index = 0; index < a.digits.length; index++) {
    if (a.digits[index] !== b.digits[index]) return a.digits[index] - b.digits[index];
  }
  return 0;
}

function digitContribution(matrix: readonly number[], method: AdaptiveMethod, subset: readonly number[], digit: number) {
  const withoutDigit = subset.filter((value) => value !== digit);
  return scoreDigitSubset(matrix, method, subset) - scoreDigitSubset(matrix, method, withoutDigit);
}

function orderSelectedDigits(matrix: readonly number[], method: AdaptiveMethod, digits: readonly number[]) {
  return [...digits].sort((a, b) => {
    const difference = digitContribution(matrix, method, digits, b) - digitContribution(matrix, method, digits, a);
    if (Math.abs(difference) > 1e-12) return difference;
    return a - b;
  });
}

function validateDigitCount(digitCount: number): void {
  if (!Number.isInteger(digitCount) || digitCount < 1 || digitCount > 9) {
    throw new Error("Jumlah digit Adaptive harus antara 1 dan 9.");
  }
}

export function rankDigitSelections(
  matrix: readonly number[],
  method: AdaptiveMethod,
  digitCount: number,
  limit = 3,
): AdaptiveSelection[] {
  validateDigitCount(digitCount);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Jumlah peringkat Adaptive harus minimal 1.");
  }

  const ranked = combinations(digitCount)
    .map((digits) => ({ digits, score: scoreDigitSubset(matrix, method, digits) }))
    .sort(compareRankedSubset);
  const baselineSuccess = scoreDigitSubset(createUniformPairMatrix(), method, ranked[0].digits);

  return ranked.slice(0, limit).map((entry, index) => {
    const next = ranked[index + 1];
    return {
      method,
      digitCount,
      digits: orderSelectedDigits(matrix, method, entry.digits),
      estimatedSuccess: entry.score,
      baselineSuccess,
      lift: entry.score - baselineSuccess,
      selectionMargin: next ? Math.max(0, entry.score - next.score) : 0,
    };
  });
}

export function optimizeDigitSelection(
  matrix: readonly number[],
  method: AdaptiveMethod,
  digitCount: number,
): AdaptiveSelection {
  const [best] = rankDigitSelections(matrix, method, digitCount, 1);
  return best;
}
