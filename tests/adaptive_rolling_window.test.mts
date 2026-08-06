import assert from "node:assert/strict";
import { runAdaptiveOnline } from "../lib/adaptive/engine.ts";
import { planAdaptiveReconciliation } from "../adaptive-service/reconcile-plan.mts";
import type { AdaptivePendingPrediction } from "../lib/adaptive/types.ts";

const HISTORY = [
  "1234", "5678", "9012", "3456", "7890", "1122", "3344", "5566", "7788", "9900",
  "1357", "2468", "8642", "7531", "1029", "3847", "5610", "7293", "9475", "2751",
];

function pendingFromRun(run: ReturnType<typeof runAdaptiveOnline>): AdaptivePendingPrediction {
  return {
    predictionId: "00000000-0000-0000-0000-000000000170",
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

Deno.test("rolling window panjang tetap melakukan settlement pada result terbaru", () => {
  const initial = runAdaptiveOnline(HISTORY, "belakang", "bbfs", 7);
  const pending = pendingFromRun(initial);
  const rollingHistory = [...HISTORY.slice(1), "4587"];

  const next = runAdaptiveOnline(
    rollingHistory,
    "belakang",
    "bbfs",
    7,
    initial.state,
    pending,
    { rollingWindowAdvance: true },
  );

  assert.equal(rollingHistory.length, HISTORY.length);
  assert.equal(next.prediction.historyLength, HISTORY.length);
  assert.equal(next.state.processedHistoryLength, HISTORY.length);
  assert.equal(next.state.lastProcessedDraw, "4587");
  assert.equal(next.prediction.replay.mode, "incremental");
  assert.equal(next.prediction.replay.processedSteps, 1);
  assert.ok(next.settlement);
  assert.equal(next.settlement.predictionId, pending.predictionId);
  assert.equal(next.settlement.actualPair, 87);
  assert.equal(Object.keys(next.settlement.aiResults).length, 9);
  assert.equal(Object.keys(next.settlement.bbfsResults).length, 9);
});

Deno.test("window panjang tetap tanpa marker tidak menyelesaikan pending", () => {
  const initial = runAdaptiveOnline(HISTORY, "belakang", "bbfs", 7);
  const rollingHistory = [...HISTORY.slice(1), "4587"];
  const next = runAdaptiveOnline(
    rollingHistory,
    "belakang",
    "bbfs",
    7,
    initial.state,
    pendingFromRun(initial),
  );

  assert.equal(next.settlement, null);
  assert.equal(next.prediction.replay.mode, "full");
});

Deno.test("planner membedakan rolling advance dari koreksi histori", () => {
  const market = {
    id: "sgp",
    name: "Singapore",
    historyLength: 170,
    lastDraw: "4587",
    historyFingerprint: "new-fingerprint",
  };
  const baseState = {
    marketId: "sgp",
    target2D: "belakang" as const,
    processedHistoryLength: 170,
    lastProcessedDraw: "1234",
    historyFingerprint: "old-fingerprint",
    pendingHistoryLength: 170,
    oldestPendingHistoryLength: 170,
    pendingCount: 1,
    pendingSelectionCount: 18,
    pendingSnapshotComplete: true,
  };

  const rolling = planAdaptiveReconciliation([market], [baseState], { marketLimit: 4 });
  assert.equal(rolling.length, 1);
  assert.deepEqual(rolling[0].targets, ["belakang"]);
  assert.equal(rolling[0].correctedHistoryCount, 0);

  const correction = planAdaptiveReconciliation(
    [market],
    [{ ...baseState, lastProcessedDraw: "4587" }],
    { marketLimit: 4 },
  );
  assert.equal(correction.length, 1);
  assert.equal(correction[0].correctedHistoryCount, 1);
});

Deno.test("migration 009 menerima rolling tanpa menekan settlement", async () => {
  const migration = await Deno.readTextFile(
    new URL("../sql/neon/009_adaptive_fixed_rolling_window.sql", import.meta.url),
  );
  const reconciliation = await Deno.readTextFile(
    new URL("../adaptive-service/reconcile.mts", import.meta.url),
  );

  assert.match(migration, /rollingWindowAdvance/);
  assert.match(migration, /rollingWindowAdvanceAccepted/);
  assert.match(migration, /v_history_correction_detected := false/);
  assert.match(reconciliation, /rollingWindowAdvance: context\.rollingWindowAdvance/);
  assert.match(reconciliation, /\{ rollingWindowAdvance: context\.rollingWindowAdvance \}/);
});
