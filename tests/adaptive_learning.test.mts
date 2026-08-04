import assert from "node:assert/strict";
import { runAdaptiveOnline } from "../lib/adaptive/engine.ts";
import {
  replayAdaptiveHistory,
  settlePendingPrediction,
} from "../lib/adaptive/learning.ts";
import type { AdaptivePendingPrediction } from "../lib/adaptive/types.ts";

const DRAWS = [
  "1234", "5678", "9012", "3456", "7890", "1122", "3344", "5566", "7788", "9900",
  "1357", "2468", "8642", "7531", "1029", "3847", "5610", "7293", "9475", "2751",
  "6184", "4307", "9526", "1748", "8063", "3915", "5270", "6481", "2196", "7854",
  "4632", "9081", "3527", "1469", "6705", "8314", "2940", "7158", "5802", "3697",
];

function assertWeightMap(weights: Record<string, number>) {
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  assert.ok(Object.values(weights).every((weight) => Number.isFinite(weight) && weight >= 0));
  assert.ok(Math.abs(total - 1) < 1e-10, `total bobot ${total}`);
}

Deno.test("incremental replay setara dengan full replay untuk histori yang sama", () => {
  const first = replayAdaptiveHistory(DRAWS.slice(0, 30), "belakang");
  const incremental = replayAdaptiveHistory(DRAWS, "belakang", first.state);
  const full = replayAdaptiveHistory(DRAWS, "belakang");

  assert.equal(first.summary.mode, "full");
  assert.equal(incremental.summary.mode, "incremental");
  assert.equal(incremental.summary.processedSteps, 10);
  assert.equal(full.summary.processedSteps, DRAWS.length - 14);
  assertWeightMap(incremental.state.expertWeights);
  assertWeightMap(full.state.expertWeights);

  const ids = new Set([
    ...Object.keys(incremental.state.expertWeights),
    ...Object.keys(full.state.expertWeights),
  ]);
  for (const id of ids) {
    assert.ok(
      Math.abs((incremental.state.expertWeights[id] ?? 0) - (full.state.expertWeights[id] ?? 0)) < 1e-10,
      `bobot ${id} berbeda`,
    );
  }
});

Deno.test("replay tanpa result baru menjadi noop dan mempertahankan bobot", () => {
  const first = replayAdaptiveHistory(DRAWS, "depan");
  const second = replayAdaptiveHistory(DRAWS, "depan", first.state);

  assert.equal(second.summary.mode, "noop");
  assert.equal(second.summary.processedSteps, 0);
  assert.deepEqual(second.state.expertWeights, first.state.expertWeights);
});

Deno.test("semua selection pending di-settle pada result berikutnya", () => {
  const history = DRAWS.slice(0, 25);
  const aiRun = runAdaptiveOnline(history, "tengah", "ai", 4);
  const bbfsRun = runAdaptiveOnline(history, "tengah", "bbfs", 7, aiRun.state);
  const pending: AdaptivePendingPrediction = {
    predictionId: "00000000-0000-0000-0000-000000000001",
    engineVersion: aiRun.prediction.engineVersion,
    configVersion: aiRun.prediction.configVersion,
    target2D: aiRun.prediction.target2D,
    historyLength: aiRun.prediction.historyLength,
    pairProbabilities: aiRun.prediction.pairProbabilities,
    leftProbabilities: aiRun.prediction.leftProbabilities,
    rightProbabilities: aiRun.prediction.rightProbabilities,
    expertWeights: aiRun.prediction.expertWeights,
    selections: [aiRun.prediction.selection, bbfsRun.prediction.selection],
  };

  const nextHistory = DRAWS.slice(0, 26);
  const nextState = replayAdaptiveHistory(nextHistory, "tengah", aiRun.state).state;
  const settlement = settlePendingPrediction(pending, nextHistory, "tengah", nextState.expertWeights);

  assert.ok(settlement);
  assert.equal(settlement.predictionId, pending.predictionId);
  assert.ok(settlement.actualPair >= 0 && settlement.actualPair <= 99);
  assert.ok(settlement.combinedLoss >= 0);
  assert.equal(typeof settlement.aiResults["4"], "boolean");
  assert.equal(typeof settlement.bbfsResults["7"], "boolean");
  assertWeightMap(settlement.weightsBefore);
  assertWeightMap(settlement.weightsAfter);
});
