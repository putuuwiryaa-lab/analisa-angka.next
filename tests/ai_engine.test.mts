import { strict as assert } from "node:assert";
import {
  _0x9a025f,
  runAiValidation,
  selectAiDigits,
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

Deno.test("selectAiDigits menghasilkan digit unik, terurut, dan deterministik", () => {
  const first = selectAiDigits(HISTORY, FIXED_VOTE, 6, [2, 3]);
  const second = selectAiDigits(HISTORY, FIXED_VOTE, 6, [2, 3]);

  assertDigitList(first, 6);
  assert.deepEqual(first, second);
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
