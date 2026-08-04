import assert from "node:assert/strict";
import {
  planAdaptiveReconciliation,
  type ReconciliationMarketSnapshot,
  type ReconciliationStateSnapshot,
} from "../adaptive-service/reconcile-plan.mts";

const MARKETS: ReconciliationMarketSnapshot[] = [
  { id: "sgp", name: "SGP", historyLength: 170, lastDraw: "4353", historyFingerprint: "sgp-new" },
  { id: "hk", name: "HK", historyLength: 140, lastDraw: "7812", historyFingerprint: "hk-new" },
  { id: "sdy", name: "Sydney", historyLength: 120, lastDraw: "9021", historyFingerprint: "sdy-new" },
];

function completeStates(market: ReconciliationMarketSnapshot): ReconciliationStateSnapshot[] {
  return (["depan", "tengah", "belakang"] as const).map((target2D) => ({
    marketId: market.id,
    target2D,
    processedHistoryLength: market.historyLength,
    lastProcessedDraw: market.lastDraw,
    historyFingerprint: market.historyFingerprint,
    pendingHistoryLength: market.historyLength,
  }));
}

Deno.test("market tanpa state dijadwalkan untuk seluruh target", () => {
  const plans = planAdaptiveReconciliation(MARKETS, [], { marketLimit: 2 });
  assert.equal(plans.length, 2);
  assert.deepEqual(plans[0].targets, ["depan", "tengah", "belakang"]);
  assert.equal(plans[0].missingStateCount, 3);
});

Deno.test("state terbaru dilewati tetapi pending lama tetap dijadwalkan", () => {
  const states = completeStates(MARKETS[0]);
  states[1] = { ...states[1], pendingHistoryLength: MARKETS[0].historyLength - 1 };

  const plans = planAdaptiveReconciliation([MARKETS[0]], states, { marketLimit: 4 });
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].targets, ["tengah"]);
});

Deno.test("market dengan state kosong diprioritaskan sebelum incremental", () => {
  const incrementalState: ReconciliationStateSnapshot[] = (["depan", "tengah", "belakang"] as const).map(
    (target2D) => ({
      marketId: "sgp",
      target2D,
      processedHistoryLength: 169,
      lastProcessedDraw: "1111",
      historyFingerprint: "old",
      pendingHistoryLength: 169,
    }),
  );

  const plans = planAdaptiveReconciliation(MARKETS, incrementalState, { marketLimit: 1 });
  assert.equal(plans.length, 1);
  assert.equal(plans[0].marketId, "hk");
  assert.equal(plans[0].missingStateCount, 3);
});

Deno.test("koreksi fingerprint dengan panjang dan cutoff sama tetap dijadwalkan", () => {
  const states = completeStates(MARKETS[0]).map((state) => ({
    ...state,
    historyFingerprint: "sgp-old",
  }));

  const plans = planAdaptiveReconciliation([MARKETS[0]], states, { marketLimit: 4 });
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].targets, ["depan", "tengah", "belakang"]);
  assert.equal(plans[0].correctedHistoryCount, 3);
});

Deno.test("market dengan koreksi histori diprioritaskan", () => {
  const correctedStates = completeStates(MARKETS[0]).map((state) => ({
    ...state,
    historyFingerprint: "sgp-old",
  }));
  const plans = planAdaptiveReconciliation(MARKETS, correctedStates, { marketLimit: 1 });
  assert.equal(plans[0].marketId, "sgp");
  assert.equal(plans[0].correctedHistoryCount, 3);
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
  assert.deepEqual(plans[0].targets, ["depan", "tengah", "belakang"]);
});
