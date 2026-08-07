import assert from "node:assert/strict";
import {
  planAdaptiveReconciliation,
  type ReconciliationMarketSnapshot,
  type ReconciliationStateSnapshot,
} from "../adaptive-service/reconcile-plan.mts";
import { ADAPTIVE_SELECTION_COUNT } from "../adaptive-service/core/types.mts";

const MARKETS: ReconciliationMarketSnapshot[] = [
  { id: "sgp", name: "SGP", historyLength: 170, lastDraw: "4353", historyFingerprint: "sgp-new" },
  { id: "hk", name: "HK", historyLength: 140, lastDraw: "7812", historyFingerprint: "hk-new" },
  { id: "sdy", name: "Sydney", historyLength: 120, lastDraw: "9021", historyFingerprint: "sdy-new" },
];

function completeStates(market: ReconciliationMarketSnapshot): ReconciliationStateSnapshot[] {
  return [{
    marketId: market.id,
    target2D: "belakang",
    processedHistoryLength: market.historyLength,
    lastProcessedDraw: market.lastDraw,
    historyFingerprint: market.historyFingerprint,
    pendingHistoryLength: market.historyLength,
    oldestPendingHistoryLength: market.historyLength,
    pendingCount: 1,
    pendingSelectionCount: ADAPTIVE_SELECTION_COUNT,
    pendingSnapshotComplete: true,
  }];
}

Deno.test("market tanpa state dijadwalkan hanya untuk 2D belakang", () => {
  const plans = planAdaptiveReconciliation(MARKETS, [], { marketLimit: 2 });
  assert.equal(plans.length, 2);
  assert.deepEqual(plans[0].targets, ["belakang"]);
  assert.equal(plans[0].missingStateCount, 1);
});

Deno.test("state terbaru dilewati tetapi pending lama tetap dijadwalkan", () => {
  const states = completeStates(MARKETS[0]);
  states[0] = {
    ...states[0],
    pendingHistoryLength: MARKETS[0].historyLength - 1,
    oldestPendingHistoryLength: MARKETS[0].historyLength - 1,
  };

  const plans = planAdaptiveReconciliation([MARKETS[0]], states, { marketLimit: 4 });
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].targets, ["belakang"]);
});

Deno.test("pending terbaru current tidak menyembunyikan backlog settlement lama", () => {
  const states = completeStates(MARKETS[0]);
  states[0] = {
    ...states[0],
    pendingHistoryLength: MARKETS[0].historyLength,
    oldestPendingHistoryLength: MARKETS[0].historyLength - 1,
    pendingCount: 2,
  };

  const plans = planAdaptiveReconciliation([MARKETS[0]], states, { marketLimit: 4 });
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].targets, ["belakang"]);
});

Deno.test("snapshot tanpa pending prediction dijadwalkan ulang", () => {
  const states = completeStates(MARKETS[0]);
  states[0] = {
    ...states[0],
    pendingHistoryLength: null,
    oldestPendingHistoryLength: null,
    pendingCount: 0,
    pendingSelectionCount: null,
    pendingSnapshotComplete: false,
  };

  const plans = planAdaptiveReconciliation([MARKETS[0]], states, { marketLimit: 4 });
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].targets, ["belakang"]);
  assert.equal(plans[0].incompleteSnapshotCount, 1);
});

Deno.test("snapshot dengan selection count bukan 11 dijadwalkan ulang", () => {
  const states = completeStates(MARKETS[0]);
  states[0] = {
    ...states[0],
    pendingSelectionCount: 18,
    pendingSnapshotComplete: false,
  };

  const plans = planAdaptiveReconciliation([MARKETS[0]], states, { marketLimit: 4 });
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].targets, ["belakang"]);
  assert.equal(plans[0].incompleteSnapshotCount, 1);
});

Deno.test("market dengan state kosong diprioritaskan sebelum incremental", () => {
  const incrementalState: ReconciliationStateSnapshot[] = [{
    marketId: "sgp",
    target2D: "belakang",
    processedHistoryLength: 169,
    lastProcessedDraw: "1111",
    historyFingerprint: "old",
    pendingHistoryLength: 169,
    oldestPendingHistoryLength: 169,
    pendingCount: 1,
    pendingSelectionCount: ADAPTIVE_SELECTION_COUNT,
    pendingSnapshotComplete: true,
  }];

  const plans = planAdaptiveReconciliation(MARKETS, incrementalState, { marketLimit: 1 });
  assert.equal(plans.length, 1);
  assert.equal(plans[0].marketId, "hk");
  assert.equal(plans[0].missingStateCount, 1);
});

Deno.test("koreksi fingerprint dengan panjang dan cutoff sama tetap dijadwalkan", () => {
  const states = completeStates(MARKETS[0]).map((state) => ({
    ...state,
    historyFingerprint: "sgp-old",
  }));

  const plans = planAdaptiveReconciliation([MARKETS[0]], states, { marketLimit: 4 });
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].targets, ["belakang"]);
  assert.equal(plans[0].correctedHistoryCount, 1);
});

Deno.test("market dengan koreksi histori diprioritaskan", () => {
  const correctedStates = completeStates(MARKETS[0]).map((state) => ({
    ...state,
    historyFingerprint: "sgp-old",
  }));
  const plans = planAdaptiveReconciliation(MARKETS, correctedStates, { marketLimit: 1 });
  assert.equal(plans[0].marketId, "sgp");
  assert.equal(plans[0].correctedHistoryCount, 1);
});

Deno.test("requested market hanya memproses market yang diminta", () => {
  const plans = planAdaptiveReconciliation(MARKETS, [], {
    marketLimit: 50,
    requestedMarketId: "sdy",
  });
  assert.equal(plans.length, 1);
  assert.equal(plans[0].marketId, "sdy");
});

Deno.test("force menjadwalkan ulang state yang sudah terbaru", () => {
  const plans = planAdaptiveReconciliation(
    [MARKETS[0]],
    completeStates(MARKETS[0]),
    { marketLimit: 1, force: true },
  );
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].targets, ["belakang"]);
});
