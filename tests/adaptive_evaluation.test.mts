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
    calibrationLoss?: number;
    globalWeightDelta?: number;
    selectionWeightDelta?: number;
    globalPairLoss?: number;
    selectionPairLoss?: number;
  },
): EvaluationRow {
  const hit = options?.hit ?? false;
  const estimated = options?.estimated ?? 0.7;
  const globalBefore = 0.4;
  const globalAfter = globalBefore + (options?.globalWeightDelta ?? 0);
  const selectionBefore = 0.45;
  const selectionAfter = selectionBefore + (options?.selectionWeightDelta ?? 0);
  return {
    predictionId: `prediction-${index}`,
    actualPair: index,
    pairBrier: 0.8 + index / 100,
    leftBrier: 0.7,
    rightBrier: 0.6,
    combinedLoss: options?.combinedLoss ?? 0.75,
    expertLosses: {
      "pair-h14": options?.globalPairLoss ?? 0.5 + index / 100,
      "transition-h14": 0.7 + index / 100,
    },
    weightsBefore: { "pair-h14": globalBefore, "transition-h14": 1 - globalBefore },
    weightsAfter: { "pair-h14": globalAfter, "transition-h14": 1 - globalAfter },
    createdAt: `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
    selections: [
      {
        method: "bbfs",
        digitCount: 7,
        estimatedSuccess: estimated,
        baselineSuccess: 0.49,
        lift: estimated - 0.49,
        hit,
        calibrationLoss: options?.calibrationLoss ?? Math.pow(estimated - (hit ? 1 : 0), 2),
        calibrationExpertLosses: {
          "pair-h14": options?.selectionPairLoss ?? 0.3 + index / 100,
          "transition-h14": 0.6 + index / 100,
        },
        calibrationWeightsBefore: {
          "pair-h14": selectionBefore,
          "transition-h14": 1 - selectionBefore,
        },
        calibrationWeightsAfter: {
          "pair-h14": selectionAfter,
          "transition-h14": 1 - selectionAfter,
        },
        calibrationStateRevisionBefore: index,
        calibrationStateRevisionAfter: index + 1,
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

Deno.test("audit kesalahan menunjukkan actual, digit terbit, dan perubahan bobot setelah MISS", () => {
  const rows = Array.from({ length: 20 }, (_, index) =>
    evaluation(index, {
      hit: index >= 10,
      estimated: index === 0 ? 0.89 : 0.7,
      selectionWeightDelta: index === 0 ? 0.08 : 0,
      selectionPairLoss: index === 0 ? 0 : 1,
    }),
  );
  rows[0].selections[0].digits = [1, 2, 3, 4, 5, 6, 7];
  const dashboard = buildAdaptiveEvaluationDashboard(rows, BASE_OPTIONS);
  const mistakes = dashboard.missAnalysis;

  assert.equal(mistakes.recentSamples, 10);
  assert.equal(mistakes.recentMisses, 10);
  assert.equal(mistakes.previousSamples, 10);
  assert.equal(mistakes.previousMisses, 0);
  assert.ok(mistakes.latestMiss);
  assert.equal(mistakes.latestMiss.actualPair, "00");
  assert.deepEqual(mistakes.latestMiss.digits, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(mistakes.latestMiss.estimatedSuccess, 0.89);
  assert.equal(mistakes.latestMiss.expertsHit, 1);
  assert.equal(mistakes.latestMiss.expertsEvaluated, 2);
  assert.ok(Math.abs((mistakes.latestMiss.weightShift ?? 0) - 0.08) < 1e-10);
});

Deno.test("tanpa MISS tidak membuat contoh kesalahan palsu", () => {
  const rows = [evaluation(0, { hit: true }), evaluation(1, { hit: true })];
  const result = buildAdaptiveEvaluationDashboard(rows, BASE_OPTIONS);
  assert.equal(result.missAnalysis.recentSamples, 2);
  assert.equal(result.missAnalysis.recentMisses, 0);
  assert.equal(result.missAnalysis.previousSamples, 0);
  assert.equal(result.missAnalysis.latestMiss, null);
});

Deno.test("trend loss memakai calibration loss selection aktif", () => {
  const rows = Array.from({ length: 20 }, (_, index) =>
    evaluation(index, {
      calibrationLoss: index < 10 ? 0.4 : 0.8,
      combinedLoss: index < 10 ? 0.9 : 0.1,
    }),
  );
  const dashboard = buildAdaptiveEvaluationDashboard(rows, BASE_OPTIONS);
  assert.ok(dashboard.selectionOverview.lossTrend !== null);
  assert.ok(Math.abs((dashboard.selectionOverview.lossTrend ?? 0) + 0.4) < 1e-10);
  assert.ok(Math.abs((dashboard.overview.lossTrend ?? 0) - 0.8) < 1e-10);
  assert.equal(dashboard.readiness.stage, "shadow");
});

Deno.test("signal dan perubahan bobot memakai audit selection aktif, bukan global", () => {
  const row = evaluation(0, {
    globalWeightDelta: 0.18,
    selectionWeightDelta: 0.03,
    globalPairLoss: 0.9,
    selectionPairLoss: 0.2,
  });
  row.selections.push({
    method: "bbfs",
    digitCount: 8,
    estimatedSuccess: 0.8,
    baselineSuccess: 0.64,
    lift: 0.16,
    hit: false,
    calibrationLoss: 0.64,
    calibrationExpertLosses: { "pair-h14": 0.95, "transition-h14": 0.05 },
    calibrationWeightsBefore: { "pair-h14": 0.2, "transition-h14": 0.8 },
    calibrationWeightsAfter: { "pair-h14": 0.4, "transition-h14": 0.6 },
    calibrationStateRevisionBefore: 10,
    calibrationStateRevisionAfter: 11,
  });

  const dashboard = buildAdaptiveEvaluationDashboard(
    [row],
    BASE_OPTIONS,
  );
  const pairChange = dashboard.weightChanges.find((change) => change.expertId === "pair-h14");
  assert.ok(pairChange);
  assert.ok(Math.abs((pairChange?.delta ?? 0) - 0.03) < 1e-10);
  assert.ok(dashboard.weightChanges.every((change) => Math.abs(change.delta) < 0.04));
  assert.equal(dashboard.expertPerformance[0].expertId, "pair-h14");
  assert.ok(Math.abs(dashboard.expertPerformance[0].meanLoss - 0.2) < 1e-10);
  assert.equal(dashboard.selectionOverview.latestUpdate?.policy, "recalibrated");
  assert.equal(dashboard.selectionOverview.latestUpdate?.stateRevisionAfter, 1);
  assert.ok(Math.abs((dashboard.recentSettlements[0].calibrationLoss ?? 0) - 0.49) < 1e-10);
  assert.equal(dashboard.recentSettlements[0].actualPair, "00");
});
