import { strict as assert } from "node:assert";
import { runFormulaByName } from "../lib/engine/acke-engine.ts";
import {
  carryAwareSum,
  circularGap,
  FRESH_FORMULA_V1_COUNT,
  FRESH_FORMULA_V1_SPECS,
  productDigitalRoot,
  productTens,
  quadraticExtrapolation,
  temporalDigitalRoot,
  temporalMedian,
  temporalSpread,
} from "../lib/engine/fresh-formulas-v1.ts";
import { ALL_FORMULA_SPECS } from "../lib/engine/formulas.ts";

const PAIR_PREFIXES = ["CG", "PT", "PDR", "CAS"] as const;
const TEMPORAL_PREFIXES = ["QX", "TMD", "TSP", "TDR"] as const;

function assertDigit(value: number, label: string): void {
  assert.equal(Number.isInteger(value), true, `${label} must be an integer`);
  assert.equal(value >= 0 && value <= 9, true, `${label} must be 0-9, received ${value}`);
}

Deno.test("fresh formula pack registers exactly 328 unique formulas", () => {
  assert.equal(FRESH_FORMULA_V1_SPECS.length, FRESH_FORMULA_V1_COUNT);
  assert.equal(new Set(FRESH_FORMULA_V1_SPECS.map((spec) => spec.formula)).size, FRESH_FORMULA_V1_COUNT);
  assert.equal(ALL_FORMULA_SPECS.length, 3687);

  for (const prefix of PAIR_PREFIXES) {
    assert.equal(FRESH_FORMULA_V1_SPECS.filter((spec) => spec.formula.startsWith(`${prefix}-`)).length, 54);
  }
  for (const prefix of TEMPORAL_PREFIXES) {
    assert.equal(FRESH_FORMULA_V1_SPECS.filter((spec) => spec.formula.startsWith(`${prefix}-`)).length, 28);
  }
});

Deno.test("pair transforms always return a decimal digit", () => {
  for (let left = 0; left <= 9; left += 1) {
    for (let right = 0; right <= 9; right += 1) {
      assertDigit(circularGap(left, right), `CG(${left},${right})`);
      assertDigit(productTens(left, right), `PT(${left},${right})`);
      assertDigit(productDigitalRoot(left, right), `PDR(${left},${right})`);
      assertDigit(carryAwareSum(left, right), `CAS(${left},${right})`);
    }
  }
});

Deno.test("three-lag transforms always return a decimal digit", () => {
  for (let first = 0; first <= 9; first += 1) {
    for (let second = 0; second <= 9; second += 1) {
      for (let third = 0; third <= 9; third += 1) {
        assertDigit(quadraticExtrapolation(first, second, third), `QX(${first},${second},${third})`);
        assertDigit(temporalMedian(first, second, third), `TMD(${first},${second},${third})`);
        assertDigit(temporalSpread(first, second, third), `TSP(${first},${second},${third})`);
        assertDigit(temporalDigitalRoot(first, second, third), `TDR(${first},${second},${third})`);
      }
    }
  }
});

Deno.test("fresh formulas run through the existing scan formula runner", () => {
  const draws = Array.from({ length: 30 }, (_, index) => String((index * 7919 + 137) % 10000).padStart(4, "0"));
  const formulas = ["CG-AC1", "PT-KE9", "PDR-AE4", "CAS-CK3", "QX-K1", "TMD-A7", "TSP-C4", "TDR-E7"];

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
