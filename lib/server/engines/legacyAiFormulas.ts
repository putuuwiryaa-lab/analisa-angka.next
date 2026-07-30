import "server-only";
import { AI_B, AI_I, AI_L, AI_T, _0xc3c54e, _0xJ2d } from './tables';

type LegacyAiFormula = {
  n: string;
  f: (current: string, previous: string, previous2: string) => number[];
  dg: 3;
};

const AI_THIRD_BY_PRIMARY: Record<number, number> = {
  0: 2,
  1: 4,
  2: 6,
  3: 5,
  4: 8,
  5: 7,
  6: 9,
  7: 1,
  8: 0,
  9: 3,
};

function digitalRoot(value: number) {
  const normalized = Math.abs(Math.trunc(value));
  return normalized === 0 ? 0 : 1 + ((normalized - 1) % 9);
}

/**
 * Ekspansi AI 3 digit dari digit utama:
 *   digit kedua = digit utama - 2 (mod 10)
 *   digit ketiga = lookup tetap hasil dekonstruksi catatan.
 *
 * Data catatan mengonfirmasi seluruh pasangan kecuali digit utama 3 dan 8.
 * Nilai 315 dan 860 melanjutkan siklus offset lima-digit yang sama.
 */
export function expandLegacyAi(primaryDigit: number): number[] {
  const primary = _0xc3c54e(primaryDigit);
  return [primary, _0xc3c54e(primary - 2), AI_THIRD_BY_PRIMARY[primary]];
}

/**
 * Sembilan rumus parsial hasil reverse engineering. Setiap rumus menghasilkan
 * satu digit utama lalu dikembangkan menjadi kandidat AI 3 digit.
 */
export const LEGACY_AI_FORMULAS: LegacyAiFormula[] = [
  {
    n: "R37 Legacy MB Mid Sum",
    f: (c: string) => expandLegacyAi(AI_B[_0xJ2d(c[1], c[2])]),
    dg: 3,
  },
  {
    n: "R38 Legacy MB As Ekor",
    f: (c: string) => expandLegacyAi(AI_B[_0xJ2d(c[0], c[3])]),
    dg: 3,
  },
  {
    n: "R39 Legacy Index Kop Minus As",
    f: (c: string) => expandLegacyAi(AI_I[_0xc3c54e(+c[1] - +c[0])]),
    dg: 3,
  },
  {
    n: "R40 Legacy Tysen As Ekor",
    f: (c: string) => expandLegacyAi(AI_T[_0xc3c54e(+c[0] + +c[3])]),
    dg: 3,
  },
  {
    n: "R41 Legacy ML Kepala Kali Ekor",
    f: (c: string) => expandLegacyAi(AI_L[_0xc3c54e(+c[2] * +c[3])]),
    dg: 3,
  },
  {
    n: "R42 Legacy ML As Minus Kop",
    f: (c: string) => expandLegacyAi(AI_L[_0xc3c54e(+c[0] - +c[1])]),
    dg: 3,
  },
  {
    n: "R43 Legacy MB Front Trinity",
    f: (c: string) => expandLegacyAi(AI_B[_0xc3c54e(+c[0] + +c[1] + +c[2])]),
    dg: 3,
  },
  {
    n: "R44 Legacy Index Digit Sum",
    f: (c: string) => expandLegacyAi(AI_I[_0xc3c54e(+c[0] + +c[1] + +c[2] + +c[3])]),
    dg: 3,
  },
  {
    n: "R45 Legacy Digital Root",
    f: (c: string) => expandLegacyAi(digitalRoot(+c[0] + +c[1] + +c[2] + +c[3])),
    dg: 3,
  },
];
