import assert from "node:assert/strict";
import { runAdaptiveFoundation } from "../lib/adaptive/engine";
import { optimizeDigitSelection, scoreDigitSubset } from "../lib/adaptive/optimizer";
import { createUniformPairMatrix, pairIndex } from "../lib/adaptive/pair-probability";

Deno.test("uniform baseline membedakan objective AI dan BBFS", () => {
  const uniform = createUniformPairMatrix();
  assert.ok(Math.abs(scoreDigitSubset(uniform, "ai", [0]) - 0.19) < 1e-12);
  assert.ok(Math.abs(scoreDigitSubset(uniform, "bbfs", [0]) - 0.01) < 1e-12);
  assert.ok(Math.abs(scoreDigitSubset(uniform, "bbfs", [0, 1, 2, 3, 4, 5, 6]) - 0.49) < 1e-12);
});

Deno.test("AI memilih coverage luas sedangkan BBFS memilih pasangan terkuat", () => {
  const matrix = Array.from({ length: 100 }, () => 0);
  matrix[pairIndex(1, 2)] = 0.4;
  matrix[pairIndex(2, 1)] = 0.3;
  matrix[pairIndex(7, 8)] = 0.2;
  matrix[pairIndex(8, 7)] = 0.1;

  const ai = optimizeDigitSelection(matrix, "ai", 2);
  const bbfs = optimizeDigitSelection(matrix, "bbfs", 2);

  assert.deepEqual(new Set(ai.digits), new Set([1, 7]));
  assert.deepEqual(new Set(bbfs.digits), new Set([1, 2]));
  assert.ok(Math.abs(ai.estimatedSuccess - 1) < 1e-12);
  assert.ok(Math.abs(bbfs.estimatedSuccess - 0.7) < 1e-12);
});

Deno.test("foundation engine menghasilkan matriks valid dan output deterministik", () => {
  const draws = [
    "1234", "5678", "9012", "3456", "7890", "1122", "3344",
    "5566", "7788", "9900", "1357", "2468", "8642", "7531",
    "1029", "3847", "5610", "7293", "9475", "2751",
  ];

  const first = runAdaptiveFoundation(draws, "belakang", "bbfs", 7);
  const second = runAdaptiveFoundation(draws, "belakang", "bbfs", 7);

  assert.equal(first.pairProbabilities.length, 100);
  assert.equal(first.leftProbabilities.length, 10);
  assert.equal(first.rightProbabilities.length, 10);
  assert.ok(Math.abs(first.pairProbabilities.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  assert.deepEqual(first.selection.digits, second.selection.digits);
  assert.equal(first.selection.digits.length, 7);
});
