import type { DigitVector, PairMatrix } from "./types";

export const DIGIT_COUNT = 10;
export const PAIR_COUNT = DIGIT_COUNT * DIGIT_COUNT;

export function pairIndex(left: number, right: number): number {
  return left * DIGIT_COUNT + right;
}

export function createUniformPairMatrix(): PairMatrix {
  return Array.from({ length: PAIR_COUNT }, () => 1 / PAIR_COUNT);
}

export function normalizePairMatrix(values: readonly number[]): PairMatrix {
  if (values.length !== PAIR_COUNT) {
    throw new Error(`Pair matrix harus berisi ${PAIR_COUNT} nilai.`);
  }

  const safe = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const total = safe.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return createUniformPairMatrix();
  return safe.map((value) => value / total);
}

export function calculateMarginals(matrix: readonly number[]): {
  left: DigitVector;
  right: DigitVector;
} {
  const normalized = normalizePairMatrix(matrix);
  const left = Array.from({ length: DIGIT_COUNT }, () => 0);
  const right = Array.from({ length: DIGIT_COUNT }, () => 0);

  for (let a = 0; a < DIGIT_COUNT; a++) {
    for (let b = 0; b < DIGIT_COUNT; b++) {
      const probability = normalized[pairIndex(a, b)];
      left[a] += probability;
      right[b] += probability;
    }
  }

  return { left, right };
}

export function combinePairMatrices(
  outputs: readonly { pairProbabilities: readonly number[]; weight: number }[],
): PairMatrix {
  if (outputs.length === 0) return createUniformPairMatrix();

  const combined = Array.from({ length: PAIR_COUNT }, () => 0);
  let totalWeight = 0;

  for (const output of outputs) {
    if (!Number.isFinite(output.weight) || output.weight <= 0) continue;
    const matrix = normalizePairMatrix(output.pairProbabilities);
    totalWeight += output.weight;
    for (let index = 0; index < PAIR_COUNT; index++) {
      combined[index] += matrix[index] * output.weight;
    }
  }

  if (totalWeight <= 0) return createUniformPairMatrix();
  return normalizePairMatrix(combined.map((value) => value / totalWeight));
}

export function pairBrierLoss(matrix: readonly number[], actualLeft: number, actualRight: number): number {
  const normalized = normalizePairMatrix(matrix);
  const actualIndex = pairIndex(actualLeft, actualRight);
  let sum = 0;

  for (let index = 0; index < PAIR_COUNT; index++) {
    const expected = index === actualIndex ? 1 : 0;
    const error = normalized[index] - expected;
    sum += error * error;
  }

  return sum / 2;
}

export function positionalBrierLoss(probabilities: readonly number[], actualDigit: number): number {
  if (probabilities.length !== DIGIT_COUNT) throw new Error("Digit vector harus berisi 10 nilai.");
  let sum = 0;
  for (let digit = 0; digit < DIGIT_COUNT; digit++) {
    const expected = digit === actualDigit ? 1 : 0;
    const error = probabilities[digit] - expected;
    sum += error * error;
  }
  return sum / 2;
}
