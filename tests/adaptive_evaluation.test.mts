import assert from "node:assert/strict";
import {
  buildAdaptiveEvaluationDashboard,
  type EvaluationRow,
} from "../adaptive-service/evaluation-analytics.mts";

function evaluation(
  index: number,
  options?: {
    hit?: boolean;
    estimated?: number;
    combinedLoss?: number;
    weightDelta?: number;
  },
): EvaluationRow {
  const before = 0.4;
  const after = before + (options?.weightDelta ?? 0);
  return {
    predictionId: `prediction-${index}`,
    actualPair: index,
    pairBrier: 0.8 + index / 100,
    leftBrier: 0.7,
    rightBrier: 0.6,
    combinedLoss: options?.combinedLoss ?? 0.75,
    expertLosses: {
      "pair-h14": 0.5 + index / 100,
      "transition-h14": 0.7 + index / 100,
    },
    weightsBefore: { "pair-h14": before, "transition-h14": 0.6 },
    weightsAfter: { "pair-h14": after, "transition-h14": 1 - after },
    createdAt: `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
    selections: [
      {
        method: "bbfs",
        digitCount: 7,
        estimatedSuccess: options?.estimated ?? 0.7,
        baselineSuccess: 0.49,
        lift: (options?.estimated ?? 0.7) - 0.49,
        hit: options?.hit ?? false,
      },
    ],
  };
}

const BASE_OPTIONS = {
  marketId: "SGP",
  target2D: "belakang" as const,
  method: "bbfs" as const,
  digitCount: 7,
  window: 100,
  pendingPredictions: 1,
  state: null,
};

Deno.test("dashboard kosong tetap menghasilkan kontrak audit yang valid", () => {
  const dashboard = buildAdaptiveEvaluationDashboard([], BASE_OPTIONS);
  assert.equal(dashboard.readiness.stage, "empty");
  assert.equal(dashboard.overview.settlements, 0);
  assert.equal(dashboard.overview.pendingPredictions, 1);
  assert.deepEqual(dashboard.selectionMetrics, []);
  assert.deepEqual(dashboard.calibration, []);
});

Deno.test("hit rate, estimasi, baseline, dan calibration bucket dihitung per selection", () => {
  const dashboard = buildAdaptiveEvaluationDashboard(
    [
      evaluation(0, { hit: true, estimated: 0.72 }),
      evaluation(1, { hit: false, estimated: 0.68 }),
      evaluation(2, { hit: true, estimated: 0.75 }),
      evaluation(3, { hit: true, estimated: 0.74 }),
    ],
    BASE_OPTIONS,
  );

  const metric = dashboard.selectionMetrics[0];
  assert.equal(metric.samples, 4);
  assert.equal(metric.hits, 3);
  assert.equal(metric.hitRate, 0.75);
  assert.ok(Math.abs(metric.averageEstimated - 0.7225) < 1e-10);
  assert.ok(Math.abs(metric.averageBaseline - 0.49) < 1e-10);
  assert.equal(dashboard.calibration.reduce((sum, bucket) => sum + bucket.samples, 0), 4);
  assert.equal(dashboard.readiness.selectedSamples, 4);
  assert.equal(dashboard.readiness.enoughForCalibration, false);
});

Deno.test("trend loss membandingkan sepuluh settlement terbaru dengan sepuluh sebelumnya", () => {
  const rows = Array.from({ length: 20 }, (_, index) =>
    evaluation(index, { combinedLoss: index < 10 ? 0.4 : 0.8 }),
  );
  const dashboard = buildAdaptiveEvaluationDashboard(rows, BASE_OPTIONS);
  assert.ok(dashboard.overview.lossTrend !== null);
  assert.ok(Math.abs((dashboard.overview.lossTrend ?? 0) + 0.4) < 1e-10);
  assert.equal(dashboard.readiness.stage, "shadow");
});

Deno.test("perubahan bobot terbaru diurutkan berdasarkan delta absolut", () => {
  const dashboard = buildAdaptiveEvaluationDashboard(
    [evaluation(0, { weightDelta: 0.08 })],
    BASE_OPTIONS,
  );
  assert.equal(dashboard.weightChanges[0].expertId, "pair-h14");
  assert.ok(Math.abs(dashboard.weightChanges[0].delta - 0.08) < 1e-10);
  assert.equal(dashboard.recentSettlements[0].actualPair, "00");
});
