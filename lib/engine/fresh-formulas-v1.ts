import { COMBO_PAIRS, POSISI } from "./constants";
import { ALL_FORMULA_SPECS } from "./formulas";
import type { FormulaSpec } from "./formulas";
import { digitOf, mod10 } from "./helpers";
import type { Draw, Posisi } from "./types";

export const FRESH_FORMULA_V1_COUNT = 328;

export function circularGap(left: number, right: number): number {
  const gap = Math.abs(left - right);
  return Math.min(gap, 10 - gap);
}

export function productTens(left: number, right: number): number {
  return Math.floor((left * right) / 10);
}

function digitalRoot(value: number): number {
  let total = Math.abs(Math.trunc(value));
  while (total >= 10) {
    total = String(total).split("").reduce((sum, digit) => sum + Number(digit), 0);
  }
  return total;
}

export function productDigitalRoot(left: number, right: number): number {
  return digitalRoot(left * right);
}

export function carryAwareSum(left: number, right: number): number {
  const sum = left + right;
  const carry = Math.floor(sum / 10);
  return mod10(sum + carry * 5);
}

export function quadraticExtrapolation(current: number, previous: number, older: number): number {
  return mod10(3 * current - 3 * previous + older);
}

export function temporalMedian(first: number, second: number, third: number): number {
  return [first, second, third].sort((a, b) => a - b)[1];
}

export function temporalSpread(first: number, second: number, third: number): number {
  return Math.max(first, second, third) - Math.min(first, second, third);
}

export function temporalDigitalRoot(first: number, second: number, third: number): number {
  return digitalRoot(first + second + third);
}

function pairDigits(draw: Draw, left: Posisi, right: Posisi): [number, number] {
  return [digitOf(draw, left), digitOf(draw, right)];
}

function temporalDigits(draws: Draw[], targetIndex: number, pos: Posisi, N: number): [number, number, number] {
  return [
    digitOf(draws[targetIndex - N], pos),
    digitOf(draws[targetIndex - N - 1], pos),
    digitOf(draws[targetIndex - N - 2], pos),
  ];
}

function buildFreshFormulaSpecs(): FormulaSpec[] {
  const specs: FormulaSpec[] = [];
  const add = (spec: FormulaSpec) => specs.push(spec);

  for (let N = 1; N <= 9; N += 1) {
    for (const [left, right] of COMBO_PAIRS) {
      add({
        formula: `CG-${left}${right}${N}`,
        type: "absdiff",
        typeOrder: 52,
        patokanPos: left,
        patokanN: N,
        compute: (draw) => {
          const [a, b] = pairDigits(draw, left, right);
          return circularGap(a, b);
        },
      });
      add({
        formula: `PT-${left}${right}${N}`,
        type: "product",
        typeOrder: 53,
        patokanPos: left,
        patokanN: N,
        compute: (draw) => {
          const [a, b] = pairDigits(draw, left, right);
          return productTens(a, b);
        },
      });
      add({
        formula: `PDR-${left}${right}${N}`,
        type: "rootGabung",
        typeOrder: 54,
        patokanPos: left,
        patokanN: N,
        compute: (draw) => {
          const [a, b] = pairDigits(draw, left, right);
          return productDigitalRoot(a, b);
        },
      });
      add({
        formula: `CAS-${left}${right}${N}`,
        type: "combo",
        typeOrder: 55,
        patokanPos: left,
        patokanN: N,
        compute: (draw) => {
          const [a, b] = pairDigits(draw, left, right);
          return carryAwareSum(a, b);
        },
      });
    }
  }

  for (let N = 1; N <= 7; N += 1) {
    for (const pos of POSISI) {
      const computeAt = (draws: Draw[], targetIndex: number, formula: (first: number, second: number, third: number) => number) => {
        const [first, second, third] = temporalDigits(draws, targetIndex, pos, N);
        return formula(first, second, third);
      };

      add({
        formula: `QX-${pos}${N}`,
        type: "momentum",
        typeOrder: 56,
        patokanPos: pos,
        patokanN: N + 2,
        compute: () => 0,
        computeAt: (draws, targetIndex) => computeAt(draws, targetIndex, quadraticExtrapolation),
      });
      add({
        formula: `TMD-${pos}${N}`,
        type: "tripleExtreme",
        typeOrder: 57,
        patokanPos: pos,
        patokanN: N + 2,
        compute: () => 0,
        computeAt: (draws, targetIndex) => computeAt(draws, targetIndex, temporalMedian),
      });
      add({
        formula: `TSP-${pos}${N}`,
        type: "spreadTriple",
        typeOrder: 58,
        patokanPos: pos,
        patokanN: N + 2,
        compute: () => 0,
        computeAt: (draws, targetIndex) => computeAt(draws, targetIndex, temporalSpread),
      });
      add({
        formula: `TDR-${pos}${N}`,
        type: "rootTriple",
        typeOrder: 59,
        patokanPos: pos,
        patokanN: N + 2,
        compute: () => 0,
        computeAt: (draws, targetIndex) => computeAt(draws, targetIndex, temporalDigitalRoot),
      });
    }
  }

  return specs;
}

export const FRESH_FORMULA_V1_SPECS = buildFreshFormulaSpecs();

const existingNames = new Set(ALL_FORMULA_SPECS.map((spec) => spec.formula));
for (const spec of FRESH_FORMULA_V1_SPECS) {
  if (existingNames.has(spec.formula)) throw new Error(`Rumus fresh duplikat nama: ${spec.formula}`);
  existingNames.add(spec.formula);
  ALL_FORMULA_SPECS.push(spec);
}

if (FRESH_FORMULA_V1_SPECS.length !== FRESH_FORMULA_V1_COUNT) {
  throw new Error(`Jumlah rumus fresh tidak valid: ${FRESH_FORMULA_V1_SPECS.length}`);
}
