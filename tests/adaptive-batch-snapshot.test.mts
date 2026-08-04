import { strict as assert } from "node:assert";
import { rankDigitSelections } from "../lib/adaptive/optimizer.ts";

Deno.test("Adaptive batch ranks BBFS selections from one snapshot matrix", () => {
  const matrix = Array.from({ length: 100 }, () => 0);
  matrix[99] = 1;

  const ranked = rankDigitSelections(matrix, "bbfs", 1, 3);

  assert.equal(ranked.length, 3);
  assert.deepEqual(ranked[0].digits, [9]);
  assert.equal(ranked[0].estimatedSuccess, 1);
  assert.ok(ranked[0].estimatedSuccess >= ranked[1].estimatedSuccess);
  assert.ok(ranked[1].estimatedSuccess >= ranked[2].estimatedSuccess);
});

Deno.test("Adaptive batch supports nine-digit BBFS output", () => {
  const matrix = Array.from({ length: 100 }, () => 1);
  const [selection] = rankDigitSelections(matrix, "bbfs", 9, 1);

  assert.equal(selection.digits.length, 9);
  assert.equal(new Set(selection.digits).size, 9);
  assert.ok(selection.estimatedSuccess > 0);
});
