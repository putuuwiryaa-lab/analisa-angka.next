import { COMBO_PAIRS, POSISI } from "./constants";
import { ALL_FORMULA_SPECS } from "./formulas";
import type { FormulaSpec } from "./formulas";
import { digitOf, mod10 } from "./helpers";
import type { Draw, Posisi } from "./types";

export const FRESH_FORMULA_V2_COUNT = 400;

export function clockwiseMidpoint(left: number, right: number): number {
  const clockwiseDistance = mod10(right - left);
  return mod10(left + Math.floor(clockwiseDistance / 2));
}

export function counterclockwiseMidpoint(left: number, right: number): number {
  const counterclockwiseDistance = mod10(left - right);
  return mod10(right + Math.floor(counterclockwiseDistance / 2));
}

export function sumOfSquares(left: number, right: number): number {
  return mod10(left ** 2 + right ** 2);
}

export function differenceOfSquares(left: number, right: number): number {
  return mod10(left ** 2 - right ** 2);
}

export function ordinalPatternCode(first: number, second: number, third: number): number {
  if (first === second && second === third) return 6;
  if (first === second) return 7;
  if (first === third) return 8;
  if (second === third) return 9;
  if (first < second && second < third) return 0;
  if (first < third && third < second) return 1;
  if (second < first && first < third) return 2;
  if (second < third && third < first) return 3;
  if (third < first && first < second) return 4;
  return 5;
}

export function signedCircularStep(current: number, previous: number): number {
  return mod10(current - previous + 5) - 5;
}

function circularZoneShift(...steps: number[]): number {
  return steps.some((step) => Math.abs(step) >= 4) ? 5 : 0;
}

export function circularMomentum(current: number, previous: number): number {
  const step = signedCircularStep(current, previous);
  return mod10(current + step + circularZoneShift(step));
}

export function circularAcceleration(current: number, previous: number, older: number): number {
  const latestStep = signedCircularStep(current, previous);
  const priorStep = signedCircularStep(previous, older);
  const acceleration = latestStep - priorStep;
  return mod10(current + latestStep + acceleration + circularZoneShift(latestStep, priorStep));
}

export function crossLagDeterminant(
  leftCurrent: number,
  rightCurrent: number,
  leftPrevious: number,
  rightPrevious: number,
): number {
  return mod10(leftCurrent * rightPrevious - rightCurrent * leftPrevious);
}

export function crossLagDotProduct(
  leftCurrent: number,
  rightCurrent: number,
  leftPrevious: number,
  rightPrevious: number,
): number {
  return mod10(leftCurrent * leftPrevious + rightCurrent * rightPrevious);
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

function crossLagDigits(
  draws: Draw[],
  targetIndex: number,
  left: Posisi,
  right: Posisi,
  N: number,
): [number, number, number, number] {
  const current = draws[targetIndex - N];
  const previous = draws[targetIndex - N - 1];
  return [
    digitOf(current, left),
    digitOf(current, right),
    digitOf(previous, left),
    digitOf(previous, right),
  ];
}

function buildFreshFormulaSpecs(): FormulaSpec[] {
  const specs: FormulaSpec[] = [];
  const add = (spec: FormulaSpec) => specs.push(spec);

  for (let N = 1; N <= 9; N += 1) {
    for (const [left, right] of COMBO_PAIRS) {
      add({
        formula: `CWM-${left}${right}${N}`,
        type: "combo",
        typeOrder: 60,
        patokanPos: left,
        patokanN: N,
        compute: (draw) => {
          const [a, b] = pairDigits(draw, left, right);
          return clockwiseMidpoint(a, b);
        },
      });
      add({
        formula: `CCM-${left}${right}${N}`,
        type: "combo",
        typeOrder: 61,
        patokanPos: left,
        patokanN: N,
        compute: (draw) => {
          const [a, b] = pairDigits(draw, left, right);
          return counterclockwiseMidpoint(a, b);
        },
      });
      add({
        formula: `SSQ-${left}${right}${N}`,
        type: "sumProduct",
        typeOrder: 62,
        patokanPos: left,
        patokanN: N,
        compute: (draw) => {
          const [a, b] = pairDigits(draw, left, right);
          return sumOfSquares(a, b);
        },
      });
      add({
        formula: `DSQ-${left}${right}${N}`,
        type: "diffProduct",
        typeOrder: 63,
        patokanPos: left,
        patokanN: N,
        compute: (draw) => {
          const [a, b] = pairDigits(draw, left, right);
          return differenceOfSquares(a, b);
        },
      });
    }
  }

  for (let N = 1; N <= 7; N += 1) {
    for (const pos of POSISI) {
      const computeTemporal = (
        draws: Draw[],
        targetIndex: number,
        formula: (first: number, second: number, third: number) => number,
      ) => {
        const [first, second, third] = temporalDigits(draws, targetIndex, pos, N);
        return formula(first, second, third);
      };

      add({
        formula: `ORD3-${pos}${N}`,
        type: "tripleExtreme",
        typeOrder: 64,
        patokanPos: pos,
        patokanN: N + 2,
        compute: () => 0,
        computeAt: (draws, targetIndex) => computeTemporal(draws, targetIndex, ordinalPatternCode),
      });
      add({
        formula: `CAX-${pos}${N}`,
        type: "momentum",
        typeOrder: 66,
        patokanPos: pos,
        patokanN: N + 2,
        compute: () => 0,
        computeAt: (draws, targetIndex) => computeTemporal(draws, targetIndex, circularAcceleration),
      });
    }
  }

  for (let N = 1; N <= 8; N += 1) {
    for (const pos of POSISI) {
      add({
        formula: `CMO-${pos}${N}`,
        type: "momentum",
        typeOrder: 65,
        patokanPos: pos,
        patokanN: N + 1,
        compute: () => 0,
        computeAt: (draws, targetIndex) => {
          const current = digitOf(draws[targetIndex - N], pos);
          const previous = digitOf(draws[targetIndex - N - 1], pos);
          return circularMomentum(current, previous);
        },
      });
    }

    for (const [left, right] of COMBO_PAIRS) {
      const computeCross = (
        draws: Draw[],
        targetIndex: number,
        formula: (a: number, b: number, c: number, d: number) => number,
      ) => {
        const values = crossLagDigits(draws, targetIndex, left, right, N);
        return formula(...values);
      };

      add({
        formula: `DET-${left}${right}${N}`,
        type: "crossDiff",
        typeOrder: 67,
        patokanPos: left,
        patokanN: N + 1,
        compute: () => 0,
        computeAt: (draws, targetIndex) => computeCross(draws, targetIndex, crossLagDeterminant),
      });
      add({
        formula: `DOT-${left}${right}${N}`,
        type: "crossCombo",
        typeOrder: 68,
        patokanPos: left,
        patokanN: N + 1,
        compute: () => 0,
        computeAt: (draws, targetIndex) => computeCross(draws, targetIndex, crossLagDotProduct),
      });
    }
  }

  return specs;
}

export const FRESH_FORMULA_V2_SPECS = buildFreshFormulaSpecs();

const existingNames = new Set(ALL_FORMULA_SPECS.map((spec) => spec.formula));
for (const spec of FRESH_FORMULA_V2_SPECS) {
  if (existingNames.has(spec.formula)) throw new Error(`Rumus fresh V2 duplikat nama: ${spec.formula}`);
  existingNames.add(spec.formula);
  ALL_FORMULA_SPECS.push(spec);
}

if (FRESH_FORMULA_V2_SPECS.length !== FRESH_FORMULA_V2_COUNT) {
  throw new Error(`Jumlah rumus fresh V2 tidak valid: ${FRESH_FORMULA_V2_SPECS.length}`);
}
