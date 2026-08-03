import { strict as assert } from "node:assert";
import {
  _0x9a025f,
  runAiValidation,
  selectAiDigits,
} from "../lib/server/engines/aiEngine.ts";
import type {
  AiFormulaRanking,
  AiRankingContext,
} from "../lib/server/engines/aiEngine.ts";
import { runAnalysis } from "../lib/server/engines/predictionEngine.ts";

const HISTORY = [
  "1485",
  "9931",
  "4061",
  "8733",
  "2725",
  "8661",
  "4805",
  "7319",
  "2054",
  "6642",
  "9180",
  "3576",
  "4421",
  "1098",
  "7853",
  "6207",
  "5349",
  "8712",
  "2964",
  "1037",
];

const ALL_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const FIXED_VOTE = Object.fromEntries(
  ALL_DIGITS.map((digit) => [digit, 10 - digit]),
) as Record<number, number>;

type BbfsGgbkResult = {
  success: boolean;
  message?: string;
  data?: {
    result: unknown;
    evaluationParam?: number;
    parity?: { dominant: string };
    size?: { dominant: string };
    bbfsGgbk?: { finalDigits: unknown };
  };
};

function assertDigitList(value: unknown, expectedLength: number) {
  assert.ok(Array.isArray(value), "hasil harus berupa array");

  const digits = value as number[];
  assert.equal(digits.length, expectedLength);
  assert.ok(
    digits.every((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9),
    "semua hasil harus berupa digit 0-9",
  );
  assert.deepEqual(digits, [...new Set(digits)].sort((a, b) => a - b));
}

function formula(overrides: Partial<AiFormulaRanking>): AiFormulaRanking {
  return {
    index: 0,
    name: "R",
    dg: 3,
    hits: 10,
    valid: 14,
    thresh: 11,
    lolos: false,
    gap: 1,
    recentHits: 3,
    recentValid: 5,
    digits: [],
    ...overrides,
  };
}

Deno.test("selectAiDigits menghasilkan digit unik, terurut, dan deterministik", () => {
  const first = selectAiDigits(HISTORY, FIXED_VOTE, 6, [2, 3]);
  const second = selectAiDigits(HISTORY, FIXED_VOTE, 6, [2, 3]);

  assertDigitList(first, 6);
  assert.deepEqual(first, second);
});

Deno.test("tie-breaker memilih dukungan rumus elite yang lebih berkualitas", () => {
  const ranking: AiRankingContext = {
    primaryGap: 0,
    primaryIndexes: [0, 1],
    formulas: [
      formula({
        index: 0,
        name: "Elite kuat",
        hits: 14,
        lolos: true,
        gap: 0,
        recentHits: 5,
        digits: [1, 2, 3],
      }),
      formula({
        index: 1,
        name: "Elite lemah",
        hits: 11,
        lolos: true,
        gap: 0,
        recentHits: 2,
        digits: [1, 4, 5],
      }),
    ],
  };
  const vote = { 0: 0, 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 0, 7: 0, 8: 0, 9: 0 };

  assert.deepEqual(selectAiDigits(HISTORY, vote, 3, [2, 3], ranking), [1, 2, 3]);
});

Deno.test("digit elite dikunci dan kekurangan diisi dari near-elite", () => {
  const ranking: AiRankingContext = {
    primaryGap: 0,
    primaryIndexes: [0, 1],
    formulas: [
      formula({
        index: 0,
        name: "Elite 1",
        hits: 13,
        lolos: true,
        gap: 0,
        recentHits: 5,
        digits: [1, 3, 5],
      }),
      formula({
        index: 1,
        name: "Elite 2",
        hits: 12,
        lolos: true,
        gap: 0,
        recentHits: 4,
        digits: [1, 3, 8],
      }),
      formula({
        index: 2,
        name: "Near 1",
        hits: 10,
        gap: 1,
        recentHits: 5,
        digits: [0, 2, 5, 7],
      }),
      formula({
        index: 3,
        name: "Near 2",
        hits: 10,
        gap: 1,
        recentHits: 3,
        digits: [2, 6, 8, 9],
      }),
    ],
  };
  const vote = { 0: 0, 1: 2, 2: 0, 3: 2, 4: 0, 5: 1, 6: 0, 7: 0, 8: 1, 9: 0 };
  const result = selectAiDigits(HISTORY, vote, 6, [2, 3], ranking);
  const core = [1, 3, 5, 8];
  const additions = result.filter((digit) => !core.includes(digit));

  assertDigitList(result, 6);
  assert.ok(core.every((digit) => result.includes(digit)), "seluruh digit elite harus tetap terkunci");
  assert.equal(additions.length, 2);
  assert.ok(result.includes(2), "digit dengan dukungan near-elite ganda harus diprioritaskan");
  assert.ok(
    additions.every((digit) => [0, 2, 6, 7, 9].includes(digit)),
    "digit tambahan harus berasal dari kandidat near-elite",
  );
});

Deno.test("runAiValidation menjaga statistik dan vote tetap konsisten", () => {
  const validation = runAiValidation(HISTORY, [2, 3]);

  assert.equal(validation.sr.length, _0x9a025f.length);
  assert.deepEqual(Object.keys(validation.vote).map(Number), ALL_DIGITS);
  assert.ok(
    Object.values(validation.vote).every(
      (value) => Number.isInteger(value) && value >= 0,
    ),
  );
  assert.ok(validation.elitCount > 0);
  assert.equal(validation.ranking.formulas.length, _0x9a025f.length);
  assert.equal(validation.ranking.primaryIndexes.length, validation.elitCount);
});

Deno.test("runAnalysis menghasilkan BBFS GGBK delapan digit", () => {
  const result = runAnalysis("ai", HISTORY, 10, {
    analysisScope: "3d",
    targetPair: "belakang",
    forceDigitResult: true,
  }) as BbfsGgbkResult;

  assert.equal(result.success, true, result.message);
  assert.ok(result.data, "data hasil analisa tidak tersedia");
  assertDigitList(result.data.result, 8);
  assert.equal(result.data.evaluationParam, 10);
  assert.ok(result.data.bbfsGgbk, "metadata BBFS GGBK tidak tersedia");
  assert.deepEqual(result.data.bbfsGgbk.finalDigits, result.data.result);
  assert.ok(["GENAP", "GANJIL"].includes(result.data.parity?.dominant ?? ""));
  assert.ok(["BESAR", "KECIL"].includes(result.data.size?.dominant ?? ""));
});
