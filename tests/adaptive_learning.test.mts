import assert from "node:assert/strict";
import { runAdaptiveOnline } from "../lib/adaptive/engine.ts";
import { buildBaselineExperts } from "../lib/adaptive/experts.ts";
import {
  evaluateExpertLosses,
  replayAdaptiveHistory,
  resolveExpertWeights,
  settlePendingPrediction,
  updateExpertWeights,
} from "../lib/adaptive/learning.ts";
import { extractTargetPair } from "../lib/adaptive/targets.ts";
import {
  ADAPTIVE_REPLAY_WARMUP,
  type AdaptivePendingPrediction,
} from "../lib/adaptive/types.ts";

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

function assertWeightsClose(
  actual: Record<string, number>,
  expected: Record<string, number>,
) {
  const ids = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  for (const id of ids) {
    assert.ok(
      Math.abs((actual[id] ?? 0) - (expected[id] ?? 0)) < 1e-10,
      `bobot ${id} berbeda`,
    );
  }
}

Deno.test("incremental replay setara dengan full replay V2 untuk histori yang sama", () => {
  const first = replayAdaptiveHistory(DRAWS.slice(0, 30), "belakang");
  const incremental = replayAdaptiveHistory(DRAWS, "belakang", first.state);
  const full = replayAdaptiveHistory(DRAWS, "belakang");

  assert.equal(first.summary.mode, "full");
  assert.equal(incremental.summary.mode, "incremental");
  assert.equal(incremental.summary.processedSteps, 10);
  assert.equal(full.summary.processedSteps, DRAWS.length - ADAPTIVE_REPLAY_WARMUP);
  assertWeightMap(incremental.state.expertWeights);
  assertWeightMap(full.state.expertWeights);
  assertWeightsClose(incremental.state.expertWeights, full.state.expertWeights);
});

Deno.test("replay V2 tanpa result baru menjadi noop dan mempertahankan bobot", () => {
  const first = replayAdaptiveHistory(DRAWS, "belakang");
  const second = replayAdaptiveHistory(DRAWS, "belakang", first.state);

  assert.equal(second.summary.mode, "noop");
  assert.equal(second.summary.processedSteps, 0);
  assert.deepEqual(second.state.expertWeights, first.state.expertWeights);
});

Deno.test("selection pending belakang di-settle pada result berikutnya", () => {
  const history = DRAWS.slice(0, 25);
  const aiRun = runAdaptiveOnline(history, "belakang", "ai", 4);
  const bbfsRun = runAdaptiveOnline(history, "belakang", "bbfs", 7, aiRun.state);
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
  const settlement = settlePendingPrediction(pending, nextHistory, "belakang");

  assert.ok(settlement);
  assert.equal(settlement.predictionId, pending.predictionId);
  assert.ok(settlement.actualPair >= 0 && settlement.actualPair <= 99);
  assert.ok(settlement.combinedLoss >= 0);
  assert.equal(typeof settlement.aiResults["4"], "boolean");
  assert.equal(typeof settlement.bbfsResults["7"], "boolean");
  assertWeightMap(settlement.weightsBefore);
  assertWeightMap(settlement.weightsAfter);
});

Deno.test("audit settlement backlog menyimpan posterior tepat satu result", () => {
  const history = DRAWS.slice(0, 25);
  const run = runAdaptiveOnline(history, "belakang", "bbfs", 7);
  const pending: AdaptivePendingPrediction = {
    predictionId: "00000000-0000-0000-0000-000000000002",
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

  const backlogHistory = DRAWS.slice(0, 30);
  const settlement = settlePendingPrediction(pending, backlogHistory, "belakang");
  assert.ok(settlement);

  const historicalExperts = buildBaselineExperts(history, "belakang");
  const expectedBefore = resolveExpertWeights(historicalExperts, pending.expertWeights);
  const [actualLeft, actualRight] = extractTargetPair(
    backlogHistory[pending.historyLength],
    "belakang",
  );
  const losses = evaluateExpertLosses(historicalExperts, actualLeft, actualRight);
  const expectedAfter = updateExpertWeights(historicalExperts, expectedBefore, losses);

  assertWeightsClose(settlement.weightsBefore, expectedBefore);
  assertWeightsClose(settlement.weightsAfter, expectedAfter);
});
