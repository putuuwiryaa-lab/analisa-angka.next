import "./fresh-formulas-v1";
import "./fresh-formulas-v2";

import { ALL_FORMULA_SPECS } from "./formulas";
import type { FormulaSpec } from "./formulas";
import { POS_INDEX } from "./types";
import type { Posisi } from "./types";

const DUPLICATE_ADJACENT_ROOT = /^RG-(AC|CK|KE)[1-9]$/;
const COMMUTATIVE_CROSS = /^(XIX|XMB|XML|XRG)-([ACKE])([123])-([ACKE])([123])$/;

function keepFormula(spec: FormulaSpec): boolean {
  // JR-AC/CK/KE is mathematically identical to RG-AC/CK/KE for two digits.
  // Keep JR because its lower typeOrder already won the previous trek dedupe.
  if (DUPLICATE_ADJACENT_ROOT.test(spec.formula)) return false;

  const match = COMMUTATIVE_CROSS.exec(spec.formula);
  if (!match) return true;

  const left = match[2] as Posisi;
  const right = match[4] as Posisi;

  // These cross formulas are commutative. Keep the orientation with the lower
  // position index because that is also the orientation selected by baseRank.
  return POS_INDEX[left] < POS_INDEX[right];
}

export function removeExactDuplicateFormulaSpecs(specs: FormulaSpec[]): number {
  const filtered = specs.filter(keepFormula);
  const removed = specs.length - filtered.length;

  specs.splice(0, specs.length, ...filtered);
  return removed;
}

export const REMOVED_EXACT_DUPLICATE_FORMULA_COUNT = removeExactDuplicateFormulaSpecs(ALL_FORMULA_SPECS);
