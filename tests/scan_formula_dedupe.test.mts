import { strict as assert } from "node:assert";
import { REMOVED_EXACT_DUPLICATE_FORMULA_COUNT } from "../lib/engine/exact-formula-dedupe.ts";
import { ALL_FORMULA_SPECS } from "../lib/engine/formulas.ts";

const POSITION_ORDER = ["A", "C", "K", "E"] as const;
const CROSS_PREFIXES = ["XIX", "XMB", "XML", "XRG"] as const;
const names = ALL_FORMULA_SPECS.map((spec) => spec.formula);
const nameSet = new Set(names);

Deno.test("scan formula registry removes all 207 proven duplicates", () => {
  assert.equal(REMOVED_EXACT_DUPLICATE_FORMULA_COUNT, 171);
  assert.equal(ALL_FORMULA_SPECS.length, 4087);
  assert.equal(nameSet.size, names.length);

  // The other 36 duplicates are removed at generation time by dropping -5,
  // which is identical to +5 under modulo 10.
  assert.equal(names.filter((name) => /^[ACKE][1-9]\+5$/.test(name)).length, 36);
  assert.equal(names.filter((name) => /^[ACKE][1-9]-5$/.test(name)).length, 0);
});

Deno.test("adjacent digital-root aliases keep JR and remove duplicate RG", () => {
  assert.equal(names.filter((name) => /^JR-(AC|CK|KE)[1-9]$/.test(name)).length, 27);
  assert.equal(names.filter((name) => /^RG-(AC|CK|KE)[1-9]$/.test(name)).length, 0);
});

Deno.test("commutative cross formulas keep only the canonical orientation", () => {
  for (const prefix of CROSS_PREFIXES) {
    const formulas = names.filter((name) => name.startsWith(`${prefix}-`));
    assert.equal(formulas.length, 36);

    for (let leftIndex = 0; leftIndex < POSITION_ORDER.length; leftIndex += 1) {
      for (let rightIndex = 0; rightIndex < POSITION_ORDER.length; rightIndex += 1) {
        if (leftIndex === rightIndex) continue;

        const left = POSITION_ORDER[leftIndex];
        const right = POSITION_ORDER[rightIndex];

        for (const leftN of [1, 2, 3]) {
          for (const rightN of [1, 2, 3]) {
            if (leftN === rightN) continue;

            const formula = `${prefix}-${left}${leftN}-${right}${rightN}`;
            assert.equal(nameSet.has(formula), leftIndex < rightIndex, formula);
          }
        }
      }
    }
  }
});
