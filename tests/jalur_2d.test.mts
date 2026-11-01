import assert from "node:assert/strict";
import { buildJalurDeret, jalurFrom2D, jalurFromSeed, twoDigitJalur } from "../lib/engine/jalur.ts";

Deno.test("every 2D number belongs to exactly one of three Jalur groups", () => {
  const counts = [0, 0, 0];
  for (let number = 0; number < 100; number++) {
    const jalur = jalurFrom2D(number);
    assert.ok(jalur >= 1 && jalur <= 3);
    counts[jalur - 1]++;
  }
  assert.deepEqual(counts, [34, 33, 33]);
});

Deno.test("Jalur 1 includes 00, 01, 04, 07 and 34", () => {
  for (const value of [0, 1, 4, 7, 34, 97]) assert.equal(jalurFrom2D(value), 1);
});

Deno.test("formula seed 5 maps to three rotating columns", () => {
  assert.equal(jalurFromSeed(5), 2);
  assert.deepEqual(buildJalurDeret(5), [2, 3, 1]);
});

Deno.test("extract requested target 2D from 4D", () => {
  assert.equal(twoDigitJalur("1234", "depan"), jalurFrom2D(12));
  assert.equal(twoDigitJalur("1234", "tengah"), jalurFrom2D(23));
  assert.equal(twoDigitJalur("1234", "belakang"), jalurFrom2D(34));
});
