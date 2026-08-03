import { strict as assert } from "node:assert";
import { runFormulaByName } from "../lib/engine/acke-engine.ts";
import { MIRROR_MAP, TESSON_MAP } from "../lib/engine/constants.ts";
import {
  carryAwareSum,
  circularGap,
  productDigitalRoot,
  productTens,
  quadraticExtrapolation,
  temporalDigitalRoot,
  temporalMedian,
  temporalSpread,
} from "../lib/engine/fresh-formulas-v1.ts";
import {
  circularAcceleration,
  circularMomentum,
  clockwiseMidpoint,
  counterclockwiseMidpoint,
  crossLagDeterminant,
  crossLagDotProduct,
  differenceOfSquares,
  FRESH_FORMULA_V2_COUNT,
  FRESH_FORMULA_V2_SPECS,
  ordinalPatternCode,
  signedCircularStep,
  sumOfSquares,
} from "../lib/engine/fresh-formulas-v2.ts";
import { ALL_FORMULA_SPECS } from "../lib/engine/formulas.ts";

const SAME_DRAW_PREFIXES = ["CWM", "CCM", "SSQ", "DSQ"] as const;
const THREE_LAG_PREFIXES = ["ORD3", "CAX"] as const;
const TWO_LAG_POSITION_PREFIXES = ["CMO"] as const;
const TWO_LAG_PAIR_PREFIXES = ["DET", "DOT"] as const;

function mod10(value: number): number {
  return ((value % 10) + 10) % 10;
}

function digitalRoot(value: number): number {
  let total = Math.abs(Math.trunc(value));
  while (total >= 10) total = String(total).split("").reduce((sum, digit) => sum + Number(digit), 0);
  return total;
}

function assertDigit(value: number, label: string): void {
  assert.equal(Number.isInteger(value), true, `${label} must be an integer`);
  assert.equal(value >= 0 && value <= 9, true, `${label} must be 0-9, received ${value}`);
}

function pairSignature(formula: (left: number, right: number) => number): string {
  const values: number[] = [];
  for (let left = 0; left <= 9; left += 1) {
    for (let right = 0; right <= 9; right += 1) values.push(formula(left, right));
  }
  return values.join("");
}

function tripleSignature(formula: (first: number, second: number, third: number) => number): string {
  const values: number[] = [];
  for (let first = 0; first <= 9; first += 1) {
    for (let second = 0; second <= 9; second += 1) {
      for (let third = 0; third <= 9; third += 1) values.push(formula(first, second, third));
    }
  }
  return values.join("");
}

function crossSignature(formula: (a: number, b: number, c: number, d: number) => number): string {
  const values: number[] = [];
  for (let a = 0; a <= 9; a += 1) {
    for (let b = 0; b <= 9; b += 1) {
      for (let c = 0; c <= 9; c += 1) {
        for (let d = 0; d <= 9; d += 1) values.push(formula(a, b, c, d));
      }
    }
  }
  return values.join("");
}

Deno.test("fresh formula V2 registers exactly 400 unique formulas", () => {
  assert.equal(FRESH_FORMULA_V2_SPECS.length, FRESH_FORMULA_V2_COUNT);
  assert.equal(new Set(FRESH_FORMULA_V2_SPECS.map((spec) => spec.formula)).size, FRESH_FORMULA_V2_COUNT);
  assert.equal(ALL_FORMULA_SPECS.length, 4087);

  for (const prefix of SAME_DRAW_PREFIXES) {
    assert.equal(FRESH_FORMULA_V2_SPECS.filter((spec) => spec.formula.startsWith(`${prefix}-`)).length, 54);
  }
  for (const prefix of THREE_LAG_PREFIXES) {
    assert.equal(FRESH_FORMULA_V2_SPECS.filter((spec) => spec.formula.startsWith(`${prefix}-`)).length, 28);
  }
  for (const prefix of TWO_LAG_POSITION_PREFIXES) {
    assert.equal(FRESH_FORMULA_V2_SPECS.filter((spec) => spec.formula.startsWith(`${prefix}-`)).length, 32);
  }
  for (const prefix of TWO_LAG_PAIR_PREFIXES) {
    assert.equal(FRESH_FORMULA_V2_SPECS.filter((spec) => spec.formula.startsWith(`${prefix}-`)).length, 48);
  }
});

Deno.test("same-draw V2 transforms are distinct from all existing pair families", () => {
  const existingPairFunctions: Array<(left: number, right: number) => number> = [
    (left, right) => mod10(left + right),
    ...[1, 2, -1, -2].map((offset) => (left: number, right: number) => mod10(left + right + offset)),
    (left, right) => mod10(left + TESSON_MAP[right]),
    (left, right) => mod10(right + TESSON_MAP[left]),
    (left, right) => mod10(TESSON_MAP[left] + TESSON_MAP[right]),
    (left, right) => mod10(left + MIRROR_MAP[right]),
    (left, right) => mod10(right + MIRROR_MAP[left]),
    (left, right) => mod10(MIRROR_MAP[left] + MIRROR_MAP[right]),
    (left, right) => mod10(left * right),
    (left, right) => mod10((left + 1) * (right + 1)),
    (left, right) => mod10(left + right + Math.abs(left - right)),
    (left, right) => mod10(Math.max(left, right) + Math.abs(left - right)),
    (left, right) => mod10(left * right + left + right),
    (left, right) => mod10(left * right + Math.abs(left - right)),
    (left, right) => Math.max(left, right),
    (left, right) => Math.min(left, right),
    (left, right) => mod10(left + right + 2 * Math.abs(left - right)),
    (left, right) => digitalRoot(left + right),
    (left, right) => mod10(2 * left + right),
    (left, right) => mod10(3 * left + right),
    (left, right) => mod10(left - right),
    (left, right) => Math.abs(left - right),
    circularGap,
    productTens,
    productDigitalRoot,
    carryAwareSum,
  ];

  const existingSignatures = new Set(existingPairFunctions.map(pairSignature));
  const freshSignatures = [clockwiseMidpoint, counterclockwiseMidpoint, sumOfSquares, differenceOfSquares].map(pairSignature);

  assert.equal(new Set(freshSignatures).size, freshSignatures.length);
  for (const signature of freshSignatures) assert.equal(existingSignatures.has(signature), false);
});

Deno.test("V2 transforms always return decimal digits", () => {
  for (let left = 0; left <= 9; left += 1) {
    for (let right = 0; right <= 9; right += 1) {
      assertDigit(clockwiseMidpoint(left, right), `CWM(${left},${right})`);
      assertDigit(counterclockwiseMidpoint(left, right), `CCM(${left},${right})`);
      assertDigit(sumOfSquares(left, right), `SSQ(${left},${right})`);
      assertDigit(differenceOfSquares(left, right), `DSQ(${left},${right})`);
      assertDigit(circularMomentum(left, right), `CMO(${left},${right})`);
      assert.equal(signedCircularStep(left, right) >= -5 && signedCircularStep(left, right) <= 4, true);
    }
  }

  for (let first = 0; first <= 9; first += 1) {
    for (let second = 0; second <= 9; second += 1) {
      for (let third = 0; third <= 9; third += 1) {
        assertDigit(ordinalPatternCode(first, second, third), `ORD3(${first},${second},${third})`);
        assertDigit(circularAcceleration(first, second, third), `CAX(${first},${second},${third})`);
      }
    }
  }

  for (let a = 0; a <= 9; a += 1) {
    for (let b = 0; b <= 9; b += 1) {
      for (let c = 0; c <= 9; c += 1) {
        for (let d = 0; d <= 9; d += 1) {
          assertDigit(crossLagDeterminant(a, b, c, d), `DET(${a},${b},${c},${d})`);
          assertDigit(crossLagDotProduct(a, b, c, d), `DOT(${a},${b},${c},${d})`);
        }
      }
    }
  }
});

Deno.test("temporal and cross-lag V2 functions have fresh full-domain signatures", () => {
  const existingTripleFunctions: Array<(a: number, b: number, c: number) => number> = [
    quadraticExtrapolation,
    temporalMedian,
    temporalSpread,
    temporalDigitalRoot,
    (a, b, c) => mod10(a + b + c),
    (a, b, c) => digitalRoot(a + b + c),
    (a, b, c) => Math.max(a, b, c),
    (a, b, c) => Math.min(a, b, c),
    (a, b, c) => [a, b, c].sort((x, y) => x - y)[1],
    (a, b, c) => Math.max(a, b, c) - Math.min(a, b, c),
    (a, b, c) => mod10(a + b + c + Math.max(a, b, c) - Math.min(a, b, c)),
    (a, b, c) => mod10(a * b + a * c + b * c),
  ];
  const existingTripleSignatures = new Set(existingTripleFunctions.map(tripleSignature));
  const freshTripleSignatures = [ordinalPatternCode, circularAcceleration].map(tripleSignature);
  assert.equal(new Set(freshTripleSignatures).size, freshTripleSignatures.length);
  for (const signature of freshTripleSignatures) assert.equal(existingTripleSignatures.has(signature), false);

  const normalMomentum = (current: number, previous: number) => mod10(2 * current - previous);
  assert.notEqual(pairSignature(circularMomentum), pairSignature(normalMomentum));

  const existingCrossFunctions: Array<(a: number, b: number, c: number, d: number) => number> = [
    (a, _b, _c, d) => mod10(a + d),
    (a, _b, _c, d) => mod10(a - d),
    (a, _b, _c, d) => mod10(2 * a + d),
    (a, _b, _c, d) => mod10((a + 1) * (d + 1)),
    (a, _b, _c, d) => mod10(a + d + Math.abs(a - d)),
    (a, _b, _c, d) => mod10(Math.max(a, d) + Math.abs(a - d)),
    (a, _b, _c, d) => digitalRoot(a + d),
    (_a, b, c, _d) => mod10(b + c),
    (_a, b, c, _d) => mod10(b - c),
    (_a, b, c, _d) => mod10(2 * b + c),
    (_a, b, c, _d) => mod10((b + 1) * (c + 1)),
    (_a, b, c, _d) => mod10(b + c + Math.abs(b - c)),
    (_a, b, c, _d) => mod10(Math.max(b, c) + Math.abs(b - c)),
    (_a, b, c, _d) => digitalRoot(b + c),
  ];
  const existingCrossSignatures = new Set(existingCrossFunctions.map(crossSignature));
  const freshCrossSignatures = [crossLagDeterminant, crossLagDotProduct].map(crossSignature);
  assert.equal(new Set(freshCrossSignatures).size, freshCrossSignatures.length);
  for (const signature of freshCrossSignatures) assert.equal(existingCrossSignatures.has(signature), false);
});

Deno.test("V2 reference examples remain stable", () => {
  assert.equal(clockwiseMidpoint(8, 2), 0);
  assert.equal(counterclockwiseMidpoint(8, 2), 5);
  assert.equal(sumOfSquares(7, 4), 5);
  assert.equal(differenceOfSquares(7, 4), 3);
  assert.equal(ordinalPatternCode(8, 2, 5), 3);
  assert.equal(circularMomentum(1, 5), 2);
  assert.equal(circularAcceleration(1, 5, 8), 1);
  assert.equal(crossLagDeterminant(7, 4, 2, 9), 5);
  assert.equal(crossLagDotProduct(7, 4, 2, 9), 0);
});

Deno.test("all V2 families run through the existing scan runner", () => {
  const draws = Array.from({ length: 40 }, (_, index) => String((index * 7919 + 137) % 10000).padStart(4, "0"));
  const formulas = [
    "CWM-AC1",
    "CCM-KE9",
    "SSQ-AE4",
    "DSQ-CK3",
    "ORD3-K1",
    "CMO-A8",
    "CAX-C7",
    "DET-AK8",
    "DOT-CE5",
  ];

  for (const formula of formulas) {
    const result = runFormulaByName(draws, formula, {
      patokanPos: "A",
      patokanN: 1,
      targetPos: "K",
      target2D: "belakang",
      target3D: "belakang",
      scanMode: "posisi",
      L: 14,
    });

    assert.equal(result.rows.length, 14, formula);
    assert.equal(result.deretLive.length, 10, formula);
    assertDigit(result.deretLive[0], formula);
  }
});
