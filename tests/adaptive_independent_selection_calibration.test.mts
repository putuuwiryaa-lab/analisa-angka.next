import assert from "node:assert/strict";
import { runAdaptiveOnline } from "../adaptive-service/core/engine.mts";
import type {
  AdaptivePendingPrediction,
  AdaptiveSelection,
} from "../adaptive-service/core/types.mts";

const HISTORY = [
  "1234", "5678", "9012", "3456", "7890", "1122", "3344", "5566", "7788", "9900",
  "1357", "2468", "8642", "7531", "1029", "3847", "5610", "7293", "9475", "2751",
  "6184", "4307", "9526", "1748", "8063", "3915", "5270", "6481", "2196", "7854",
];

function pendingFromRun(run: ReturnType<typeof runAdaptiveOnline>): AdaptivePendingPrediction {
  return {
    predictionId: "00000000-0000-0000-0000-000000000777",
    engineVersion: run.prediction.engineVersion,
    configVersion: run.prediction.configVersion,
    target2D: run.prediction.target2D,
    historyLength: run.prediction.historyLength,
    pairProbabilities: run.prediction.pairProbabilities,
    leftProbabilities: run.prediction.leftProbabilities,
    rightProbabilities: run.prediction.rightProbabilities,
    expertWeights: run.prediction.expertWeights,
    selections: run.prediction.selections,
  };
}

function selection(
  selections: readonly AdaptiveSelection[],
  method: "ai" | "bbfs",
  digitCount: number,
): AdaptiveSelection {
  const found = selections.find((item) =>
    item.method === method && item.digitCount === digitCount
  );
  assert.ok(found, `${method}:${digitCount} tidak ditemukan`);
  return found;
}

function bbfsHit(digits: readonly number[], left: number, right: number): boolean {
  const selected = new Set(digits);
  return selected.has(left) && selected.has(right);
}

function findBbfs8HitBbfs7Miss(
  bbfs7: AdaptiveSelection,
  bbfs8: AdaptiveSelection,
): [number, number] {
  for (let left = 0; left < 10; left++) {
    for (let right = 0; right < 10; right++) {
      if (bbfsHit(bbfs8.digits, left, right) && !bbfsHit(bbfs7.digits, left, right)) {
        return [left, right];
      }
    }
  }
  throw new Error("Tidak ada pair uji BBFS8 hit dan BBFS7 miss.");
}

function weightMapsDiffer(
  left: Readonly<Record<string, number>>,
  right: Readonly<Record<string, number>>,
): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].some((key) => Math.abs((left[key] ?? 0) - (right[key] ?? 0)) > 1e-12);
}

Deno.test("BBFS7, BBFS8, dan AI7 dikalibrasi pada state masing-masing", () => {
  const first = runAdaptiveOnline(HISTORY, "belakang", "bbfs", 7);
  assert.equal(first.prediction.selections.length, 18);

  const firstBbfs7 = selection(first.prediction.selections, "bbfs", 7);
  const firstBbfs8 = selection(first.prediction.selections, "bbfs", 8);
  const [left, right] = findBbfs8HitBbfs7Miss(firstBbfs7, firstBbfs8);
  const actualDraw = `00${left}${right}`;

  const next = runAdaptiveOnline(
    [...HISTORY, actualDraw],
    "belakang",
    "bbfs",
    7,
    first.state,
    pendingFromRun(first),
  );

  assert.ok(next.settlement);
  const updates = next.settlement.selectionCalibrationUpdates;
  assert.equal(updates.length, 18);
  assert.equal(
    new Set(updates.map((update) => `${update.method}:${update.digitCount}`)).size,
    18,
  );

  const bbfs7Update = updates.find((update) =>
    update.method === "bbfs" && update.digitCount === 7
  );
  const bbfs8Update = updates.find((update) =>
    update.method === "bbfs" && update.digitCount === 8
  );
  const ai7Update = updates.find((update) =>
    update.method === "ai" && update.digitCount === 7
  );
  assert.ok(bbfs7Update);
  assert.ok(bbfs8Update);
  assert.ok(ai7Update);
  assert.equal(bbfs7Update.hit, false);
  assert.equal(bbfs8Update.hit, true);

  const nextBbfs7 = selection(next.prediction.selections, "bbfs", 7);
  const nextBbfs8 = selection(next.prediction.selections, "bbfs", 8);
  const nextAi7 = selection(next.prediction.selections, "ai", 7);

  assert.deepEqual(nextBbfs7.calibrationWeights, bbfs7Update.weightsAfter);
  assert.deepEqual(nextBbfs8.calibrationWeights, bbfs8Update.weightsAfter);
  assert.deepEqual(nextAi7.calibrationWeights, ai7Update.weightsAfter);
  assert.equal(nextBbfs7.calibrationStateRevision, bbfs7Update.stateRevisionAfter);
  assert.equal(nextBbfs8.calibrationStateRevision, bbfs8Update.stateRevisionAfter);
  assert.equal(nextAi7.calibrationStateRevision, ai7Update.stateRevisionAfter);

  assert.ok(weightMapsDiffer(nextBbfs7.calibrationWeights, nextBbfs8.calibrationWeights));
  assert.ok(weightMapsDiffer(nextBbfs7.calibrationWeights, nextAi7.calibrationWeights));
});

Deno.test("run tanpa settlement mempertahankan state selection yang sama", () => {
  const first = runAdaptiveOnline(HISTORY, "tengah", "ai", 7);
  const pending = pendingFromRun(first);
  const repeated = runAdaptiveOnline(
    HISTORY,
    "tengah",
    "ai",
    7,
    first.state,
    pending,
  );

  assert.equal(repeated.settlement, null);
  for (const previous of first.prediction.selections) {
    const current = selection(
      repeated.prediction.selections,
      previous.method,
      previous.digitCount,
    );
    assert.deepEqual(current.calibrationWeights, previous.calibrationWeights);
    assert.equal(current.calibrationStateRevision, previous.calibrationStateRevision);
  }
});

Deno.test("migration 010 menyimpan dan mengaudit 18 calibration state", async () => {
  const migration = await Deno.readTextFile(
    new URL("../sql/neon/010_independent_selection_calibration.sql", import.meta.url),
  );
  const reconciliation = await Deno.readTextFile(
    new URL("../adaptive-service/reconcile.mts", import.meta.url),
  );

  assert.match(migration, /calibration_weights/);
  assert.match(migration, /calibration_state_revision/);
  assert.match(migration, /selectionCalibrationPublished/);
  assert.match(migration, /selectionCalibrationUpdated/);
  assert.match(reconciliation, /calibrationWeights/);
  assert.match(reconciliation, /calibrationStateRevision/);
  assert.match(reconciliation, /Migration 010 belum aktif/);
});
