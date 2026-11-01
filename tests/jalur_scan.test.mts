import assert from "node:assert/strict";
import { runEngine, runAutoScan } from "../lib/engine/acke-engine.ts";
import { scanRowSucceeded } from "../lib/shared/saved-scan.ts";

Deno.test("Jalur Scan evaluates 2D target as one of three rotating columns", () => {
  const draws = ["1428", "1234", "5678"];
  const result = runEngine(draws, {
    patokanPos: "A",
    patokanN: 1,
    targetPos: "K",
    target2D: "belakang",
    L: 2,
    scanMode: "jalur_2d",
  });

  assert.deepEqual(result.rows.map((row) => row.targetDigits), [[1], [3]]);
  assert.deepEqual(result.rows.map((row) => row.deret), [[1, 2, 3], [1, 2, 3]]);
  assert.deepEqual(result.kolom.map((column) => column.kolom), ["J1", "J2", "J3"]);
  assert.equal(scanRowSucceeded("jalur_2d", [1], [1]), true);
  assert.equal(scanRowSucceeded("jalur_2d", [3], [1]), false);
});

Deno.test("Jalur auto scan keeps one selected group and exact backtest misses", () => {
  const draws = ["1428", "1234", "5678", "9012", "3456"];
  const result = runAutoScan(draws, {
    scanMode: "jalur_2d",
    target2D: "belakang",
    targetPos: "K",
    digitCount: 1,
    L: 1,
    patah: 0,
    stopScan: 3,
  });

  assert.equal(result.config.digitCount, 1);
  assert.ok(result.items.length > 0);
  for (const item of result.items) {
    assert.equal(item.angkaHidup.length, 1);
    assert.ok(item.angkaHidup[0] >= 1 && item.angkaHidup[0] <= 3);
    assert.equal(item.kolomHidup.length, 1);
    assert.equal(item.result.rows.at(-1)?.targetDigits.length, 1);
    const row = item.result.rows.at(-1)!;
    const columnIndex = item.result.kolom.findIndex((column) => column.kolom === item.kolomHidup[0]);
    assert.equal(row.deret[columnIndex], row.targetDigit);
  }
});
