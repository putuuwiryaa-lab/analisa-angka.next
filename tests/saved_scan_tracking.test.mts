import { strict as assert } from "node:assert";
import { runFormulaByName } from "../lib/engine/acke-engine.ts";
import { replaySavedScan } from "../lib/engine/saved-scan.ts";
import { KOLOM, SHIO_KOLOM, type Kolom, type ScanMode } from "../lib/engine/types.ts";
import {
  mergeSavedScanUpdates,
  savedScanRequest,
  type TrackedSavedScan,
} from "../lib/shared/saved-scan-state.ts";
import { savedScanRevision, scanRowSucceeded } from "../lib/shared/saved-scan.ts";

const originalDraws = ["9181", "3268", "6196"];
const columns: Kolom[] = [KOLOM[5], KOLOM[6], KOLOM[8], KOLOM[0], KOLOM[1], KOLOM[2]];
function savedTrek(mode: ScanMode = "bbfs_2d_belakang"): TrackedSavedScan {
  const result = runFormulaByName(originalDraws, "A1", {
    patokanPos: "A",
    patokanN: 1,
    targetPos: "K",
    L: 14,
    scanMode: mode,
  });
  return {
    id: "saved",
    marketId: "hongkong",
    formula: "A1",
    scanMode: mode,
    targetPos: "K",
    target2D: "belakang",
    target3D: "belakang",
    kolomHidup: columns,
    historyTail: originalDraws,
    historyLength: originalDraws.length,
    snapshotRows: result.rows,
    savedLatestDraw: result.latestDraw,
    predictionValues: columns.map(
      (column) => result.deretLive[KOLOM.indexOf(column as (typeof KOLOM)[number])],
    ),
  };
}

Deno.test(
  "a new result evaluates the old pending digits and keeps the same formula and columns",
  () => {
    const saved = savedTrek();
    assert.deepEqual(saved.predictionValues, [1, 2, 4, 6, 7, 8]);
    const request = savedScanRequest(saved)!;
    const update = replaySavedScan([...originalDraws, "9978"], request);
    assert.equal(update.rows.length, 1);
    assert.equal(update.rows[0].displayDraw, "6196");
    assert.equal(update.rows[0].targetDraw, "9978");
    assert.equal(
      scanRowSucceeded(saved.scanMode, update.rows[0].targetDigits, saved.predictionValues),
      true,
    );
    const [next] = mergeSavedScanUpdates(
      [saved],
      [{ id: saved.id, revision: update.revision, update }],
    );
    assert.equal(next.formula, saved.formula);
    assert.deepEqual(next.kolomHidup, saved.kolomHidup);
    assert.deepEqual(next.snapshotRows.slice(0, 2), saved.snapshotRows);
    assert.equal(next.savedLatestDraw, "9978");
    assert.deepEqual(next.predictionValues, [4, 5, 7, 9, 0, 1]);
  },
);

Deno.test(
  "a failed result is retained and the formula continues to produce a next prediction",
  () => {
    const saved = savedTrek();
    const update = replaySavedScan([...originalDraws, "9902"], savedScanRequest(saved)!);
    assert.equal(
      scanRowSucceeded(saved.scanMode, update.rows[0].targetDigits, saved.predictionValues),
      false,
    );
    const [next] = mergeSavedScanUpdates(
      [saved],
      [{ id: saved.id, revision: update.revision, update }],
    );
    assert.equal(next.snapshotRows.length, 3);
    assert.equal(next.savedLatestDraw, "9902");
    assert.deepEqual(next.predictionValues, [4, 5, 7, 9, 0, 1]);
  },
);

Deno.test("all missed draws are appended in order after reopening the page", () => {
  const saved = savedTrek();
  const update = replaySavedScan(
    [...originalDraws, "9978", "3301", "8845"],
    savedScanRequest(saved)!,
  );
  assert.deepEqual(
    update.rows.map((row) => row.targetDraw),
    ["9978", "3301", "8845"],
  );
  assert.deepEqual(
    update.rows.map((row) => row.displayDraw),
    ["6196", "9978", "3301"],
  );
  assert.equal(update.latestDraw, "8845");
});

Deno.test("refreshing twice does not append duplicate evaluation rows", () => {
  const saved = savedTrek();
  const draws = [...originalDraws, "9978"];
  const update = replaySavedScan(draws, savedScanRequest(saved)!);
  const next = mergeSavedScanUpdates(
    [saved],
    [{ id: saved.id, revision: update.revision, update }],
  );
  assert.equal(
    mergeSavedScanUpdates(next, [{ id: saved.id, revision: update.revision, update }]),
    next,
  );
  const repeat = replaySavedScan(draws, savedScanRequest(next[0])!);
  assert.equal(repeat.rows.length, 0);
  assert.equal(
    mergeSavedScanUpdates(next, [{ id: saved.id, revision: repeat.revision, update: repeat }]),
    next,
  );
});

Deno.test("old snapshot treks derive a sequence anchor without losing their history", () => {
  const saved = savedTrek();
  delete saved.historyTail;
  delete saved.historyLength;
  const request = savedScanRequest(saved)!;
  assert.deepEqual(request.historyTail, originalDraws);
  assert.equal(replaySavedScan([...originalDraws, "9978"], request).rows.length, 1);
});

Deno.test("rolling history still matches the saved sequence", () => {
  const saved = savedTrek();
  const request = savedScanRequest(saved)!;
  request.historyLength = 700;
  const update = replaySavedScan(["1234", ...originalDraws, "9978"], request);
  assert.equal(update.rows.length, 1);
  assert.equal(update.latestDraw, "9978");
});

Deno.test("repeated 4D results use their known history index", () => {
  const saved = savedTrek();
  const update = replaySavedScan([...originalDraws, ...originalDraws], savedScanRequest(saved)!);
  assert.equal(update.rows.length, 3);
  assert.equal(update.rows[0].targetDraw, "9181");
});

Deno.test("missing or ambiguous anchors preserve the previous trek and report the gap", () => {
  const saved = savedTrek();
  const request = savedScanRequest(saved)!;
  assert.throws(() => replaySavedScan(["1111", "2222", "3333"], request), /terputus/);
  delete request.historyLength;
  assert.throws(() => replaySavedScan([...originalDraws, ...originalDraws], request), /berulang/);
  const result = {
    id: saved.id,
    revision: savedScanRevision(savedScanRequest(saved)!),
    error: "Riwayat terputus",
  };
  const [next] = mergeSavedScanUpdates([saved], [result]);
  assert.deepEqual(next.snapshotRows, saved.snapshotRows);
  assert.deepEqual(next.predictionValues, saved.predictionValues);
  assert.equal(next.trackingError, result.error);
});

Deno.test("late responses cannot restore deleted treks or overwrite a newly saved formula", () => {
  const saved = savedTrek();
  const update = replaySavedScan([...originalDraws, "9978"], savedScanRequest(saved)!);
  const results = [{ id: saved.id, revision: update.revision, update }];
  assert.deepEqual(mergeSavedScanUpdates([], results), []);
  const replacement = [{ ...saved, formula: "C1" }];
  assert.equal(mergeSavedScanUpdates(replacement, results), replacement);
});

Deno.test("status rules cover AI, BBFS, OFF, position, sum, and Shio including twins", () => {
  assert.equal(scanRowSucceeded("ai_2d_belakang", [0, 2], [2]), true);
  assert.equal(scanRowSucceeded("bbfs_2d_belakang", [0, 2], [2]), false);
  assert.equal(scanRowSucceeded("bbfs_2d_belakang", [2], [2]), true);
  assert.equal(scanRowSucceeded("ai_3d", [1, 2, 3], [1, 2]), true);
  assert.equal(scanRowSucceeded("ai_3d", [1, 2, 3], [1]), false);
  assert.equal(scanRowSucceeded("ai_3d", [1, 1, 1], [1]), true);
  assert.equal(scanRowSucceeded("bbfs_3d", [1, 2, 3], [1, 2]), false);
  for (const mode of [
    "off_posisi",
    "off_2d_belakang",
    "off_jumlah_2d_belakang",
    "off_3d",
    "off_shio",
  ] as const) {
    assert.equal(scanRowSucceeded(mode, [1, 2], [3, 4]), true);
    assert.equal(scanRowSucceeded(mode, [1, 2], [2, 4]), false);
  }
  for (const mode of ["posisi", "jumlah_2d_belakang", "shio"] as const) {
    assert.equal(scanRowSucceeded(mode, [6], [6]), true);
    assert.equal(scanRowSucceeded(mode, [6], [5]), false);
  }
});

Deno.test("cross-lag and fresh formulas replay with the same inputs as Scan", () => {
  const draws = ["1234", "2345", "3456", "4567", "5678", "6789"];
  for (const formula of ["A3+C1", "CMO-A1"]) {
    const result = runFormulaByName(draws, formula, {
      patokanPos: "A",
      patokanN: 1,
      targetPos: "K",
      L: 14,
      scanMode: "bbfs_2d_belakang",
    });
    const request = {
      ...savedScanRequest(savedTrek())!,
      formula,
      historyTail: draws.slice(0, -1),
      historyLength: draws.length - 1,
    };
    const update = replaySavedScan(draws, request);
    assert.deepEqual(update.rows[0], result.rows.at(-1));
  }
});

Deno.test("Shio tracking preserves twelve-column predictions", () => {
  const request = {
    ...savedScanRequest(savedTrek("shio"))!,
    kolomHidup: [SHIO_KOLOM[0], SHIO_KOLOM[11]],
  };
  const update = replaySavedScan([...originalDraws, "9978"], request);
  assert.equal(update.rows[0].deret.length, 12);
  assert.equal(update.predictionValues.length, 2);
});
