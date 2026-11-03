import assert from "node:assert/strict";
import { runEngine, runAutoScan } from "../lib/engine/acke-engine.ts";
import { compressionProfile, digitsFromColumns } from "../lib/engine/ranking.ts";
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

Deno.test("two Jalur columns cover either group with the same exact Patah rule", () => {
  // Formula A1 gives a stable [1,2,3] Jalur deret for these 4D draws.
  const draws = ["1010", "1024", "1018", "1019"];
  const engine = runEngine(draws, {
    patokanPos: "A",
    patokanN: 1,
    targetPos: "K",
    target2D: "belakang",
    L: 3,
    scanMode: "jalur_2d",
  });
  assert.deepEqual(engine.rows.map((row) => row.targetDigit), [3, 3, 1]);
  assert.equal(compressionProfile(engine, 1, "jalur_2d", 0), null);

  const pair = compressionProfile(engine, 2, "jalur_2d", 0);
  assert.ok(pair);
  assert.deepEqual(pair.displayColumns, ["J1", "J3"]);
  assert.deepEqual(digitsFromColumns(engine, pair.displayColumns), [1, 3]);
  assert.equal(scanRowSucceeded("jalur_2d", [1], [1, 3]), true);
  assert.equal(scanRowSucceeded("jalur_2d", [3], [1, 3]), true);
  assert.equal(scanRowSucceeded("jalur_2d", [2], [1, 3]), false);

  const scan = runAutoScan(draws, {
    scanMode: "jalur_2d",
    target2D: "belakang",
    digitCount: 2,
    L: 3,
    patah: 0,
    stopScan: 5,
  });
  assert.equal(scan.config.digitCount, 2);
  assert.ok(scan.items.length > 0);
  for (const item of scan.items) {
    assert.equal(item.angkaHidup.length, 2);
    assert.equal(new Set(item.angkaHidup).size, 2);
    assert.equal(item.kolomHidup.length, 2);
    assert.ok(item.angkaHidup.every((value) => value >= 1 && value <= 3));
    const misses = item.result.rows.filter((row) => {
      const selected = row.deret.filter((_, columnIndex) => item.kolomHidup.includes(
        item.result.kolom[columnIndex].kolom,
      ));
      return !scanRowSucceeded("jalur_2d", row.targetDigits, selected);
    }).length;
    assert.equal(misses, 0, "Patah must count draws missing both selected Jalur groups");
  }
});

Deno.test("Jalur Scan UI shows bare separated numbers in Scan, saved Trek, and Batch", async () => {
  const [shared, mainUi, batchApi] = await Promise.all([
    Deno.readTextFile(new URL("../lib/shared/scan-mode.ts", import.meta.url)),
    Deno.readTextFile(new URL("../app/scan/_lib.ts", import.meta.url)),
    Deno.readTextFile(new URL("../app/api/batch-scan/route.ts", import.meta.url)),
  ]);
  assert.match(shared, /isJalurMode\(mode\) \? 2/);
  assert.match(mainUi, /return isShioMode\(mode\) \? String\(value \+ 1\)\.padStart\(2, "0"\) : String\(value\)/);
  assert.match(mainUi, /isJalurMode\(mode\) \? " " : ""/);
  assert.match(batchApi, /if \(isJalurMode\(scanMode\)\) return values\.join\(" "\)/);
});
