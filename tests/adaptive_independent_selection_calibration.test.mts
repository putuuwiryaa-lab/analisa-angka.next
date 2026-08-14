import assert from "node:assert/strict";
import { runAdaptiveOnline } from "../adaptive-service/core/engine.mts";
import { buildBaselineExperts } from "../adaptive-service/core/experts.mts";
import { optimizeDigitSelection } from "../adaptive-service/core/optimizer.mts";
import {
  ADAPTIVE_CONFIG_VERSION,
  ADAPTIVE_REPLAY_WARMUP,
  ADAPTIVE_SELECTION_COUNT,
  ADAPTIVE_SELECTION_SPECS,
} from "../adaptive-service/core/types.mts";
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

function aiHit(digits: readonly number[], left: number, right: number): boolean {
  const selected = new Set(digits);
  return selected.has(left) || selected.has(right);
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

Deno.test("V2 hanya menerbitkan AI1-6 dan BBFS5-9", () => {
  const run = runAdaptiveOnline(HISTORY, "belakang", "bbfs", 7);
  assert.equal(run.prediction.selections.length, ADAPTIVE_SELECTION_COUNT);
  assert.deepEqual(
    run.prediction.selections.map((item) => `${item.method}:${item.digitCount}`),
    ADAPTIVE_SELECTION_SPECS.map((item) => `${item.method}:${item.digitCount}`),
  );
  assert.equal(run.prediction.replay.mode, "full");
  assert.equal(run.prediction.replay.startHistoryLength, ADAPTIVE_REPLAY_WARMUP);

  for (const published of run.prediction.selections) {
    assert.equal(
      published.calibrationStateRevision,
      Math.max(0, HISTORY.length - ADAPTIVE_REPLAY_WARMUP),
    );
  }
});

Deno.test("WIN membekukan selection weights dan MISS saja yang recalibrate", () => {
  const first = runAdaptiveOnline(HISTORY, "belakang", "bbfs", 7);
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
  assert.equal(updates.length, ADAPTIVE_SELECTION_COUNT);
  assert.equal(
    new Set(updates.map((update) => `${update.method}:${update.digitCount}`)).size,
    ADAPTIVE_SELECTION_COUNT,
  );

  const bbfs7Update = updates.find((update) =>
    update.method === "bbfs" && update.digitCount === 7
  );
  const bbfs8Update = updates.find((update) =>
    update.method === "bbfs" && update.digitCount === 8
  );
  const ai6Update = updates.find((update) =>
    update.method === "ai" && update.digitCount === 6
  );
  assert.ok(bbfs7Update);
  assert.ok(bbfs8Update);
  assert.ok(ai6Update);
  assert.equal(bbfs7Update.hit, false);
  assert.equal(bbfs8Update.hit, true);

  // BBFS8 WIN: tetap dievaluasi untuk audit, tetapi bobot tidak berubah.
  assert.ok(Object.keys(bbfs8Update.expertLosses).length > 0);
  assert.deepEqual(bbfs8Update.weightsAfter, bbfs8Update.weightsBefore);

  // BBFS7 MISS: jalur recalibration tetap aktif.
  assert.ok(Object.keys(bbfs7Update.expertLosses).length > 0);
  assert.equal(weightMapsDiffer(bbfs7Update.weightsAfter, bbfs7Update.weightsBefore), true);

  const nextBbfs7 = selection(next.prediction.selections, "bbfs", 7);
  const nextBbfs8 = selection(next.prediction.selections, "bbfs", 8);
  const nextAi6 = selection(next.prediction.selections, "ai", 6);

  assert.deepEqual(nextBbfs7.calibrationWeights, bbfs7Update.weightsAfter);
  assert.deepEqual(nextBbfs8.calibrationWeights, bbfs8Update.weightsAfter);
  assert.deepEqual(nextAi6.calibrationWeights, ai6Update.weightsAfter);
  assert.equal(nextBbfs7.calibrationStateRevision, bbfs7Update.stateRevisionAfter);
  assert.equal(nextBbfs8.calibrationStateRevision, bbfs8Update.stateRevisionAfter);
  assert.equal(nextAi6.calibrationStateRevision, ai6Update.stateRevisionAfter);

  assert.ok(weightMapsDiffer(nextBbfs7.calibrationWeights, nextBbfs8.calibrationWeights));
});

Deno.test("MISS memberi credit kepada expert selection yang mengenai actual", () => {
  const first = runAdaptiveOnline(HISTORY, "belakang", "ai", 1);
  const published = selection(first.prediction.selections, "ai", 1);
  const experts = buildBaselineExperts(HISTORY, "belakang");
  let actual: { left: number; right: number } | null = null;

  for (let left = 0; left < 10 && !actual; left++) {
    for (let right = 0; right < 10; right++) {
      if (aiHit(published.digits, left, right)) continue;
      const outcomes = experts.map((expert) => {
        const expertSelection = optimizeDigitSelection(expert.pairProbabilities, "ai", 1);
        return aiHit(expertSelection.digits, left, right);
      });
      if (outcomes.some(Boolean) && outcomes.some((hit) => !hit)) {
        actual = { left, right };
        break;
      }
    }
  }

  assert.ok(actual, "Pair uji MISS dengan expert hit dan miss tidak ditemukan.");
  const next = runAdaptiveOnline(
    [...HISTORY, `00${actual.left}${actual.right}`],
    "belakang",
    "ai",
    1,
    first.state,
    pendingFromRun(first),
  );
  assert.ok(next.settlement);
  const update = next.settlement.selectionCalibrationUpdates.find((item) =>
    item.method === "ai" && item.digitCount === 1
  );
  assert.ok(update);
  assert.equal(update.hit, false);

  let correctExperts = 0;
  let wrongExperts = 0;
  for (const expert of experts) {
    const expertSelection = optimizeDigitSelection(expert.pairProbabilities, "ai", 1);
    const hit = aiHit(expertSelection.digits, actual.left, actual.right);
    assert.equal(update.expertLosses[expert.id], hit ? 0 : 1);
    if (hit) {
      correctExperts += 1;
      assert.ok(update.weightsAfter[expert.id] > update.weightsBefore[expert.id]);
    } else {
      wrongExperts += 1;
      assert.ok(update.weightsAfter[expert.id] < update.weightsBefore[expert.id]);
    }
  }
  assert.ok(correctExperts > 0);
  assert.ok(wrongExperts > 0);

  // Confidence Brier tetap tersedia untuk audit dan terpisah dari action loss.
  assert.ok(update.calibrationLoss > 0 && update.calibrationLoss < 1);
});

Deno.test("run tanpa settlement mempertahankan state selection yang sama", () => {
  const first = runAdaptiveOnline(HISTORY, "belakang", "ai", 6);
  const pending = pendingFromRun(first);
  const repeated = runAdaptiveOnline(
    HISTORY,
    "belakang",
    "ai",
    6,
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

Deno.test("migration 011-014 menyimpan contract, credit, dan regime policy V2", async () => {
  const migration011 = await Deno.readTextFile(
    new URL("../sql/neon/011_adaptive_v2_back_only.sql", import.meta.url),
  );
  const migration012 = await Deno.readTextFile(
    new URL("../sql/neon/012_freeze_selection_weights_on_win.sql", import.meta.url),
  );
  const migration013 = await Deno.readTextFile(
    new URL("../sql/neon/013_selection_action_credit.sql", import.meta.url),
  );
  const migration014 = await Deno.readTextFile(
    new URL("../sql/neon/014_adaptive_regime_evidence.sql", import.meta.url),
  );
  const reconciliation = await Deno.readTextFile(
    new URL("../adaptive-service/reconcile.mts", import.meta.url),
  );

  assert.equal(ADAPTIVE_CONFIG_VERSION, "2026-08-15.2");
  assert.match(migration011, /hf-apie-v2-back/);
  assert.match(migration011, /tepat 11 selection/);
  assert.match(migration011, /selectionCalibrationPublished/);
  assert.match(migration011, /selectionCalibrationUpdated/);
  assert.match(migration011, /store_online_run_v1_calibration_base/);
  assert.match(migration012, /2026-08-08\.1/);
  assert.match(migration012, /selectionWinPolicy', 'freeze'/);
  assert.match(migration012, /selectionLossPolicy', 'recalibrate'/);
  assert.match(migration012, /config_version = '2026-08-07\.1'/);
  assert.match(migration013, /2026-08-15\.1/);
  assert.match(migration013, /selectionLossPolicy', 'miss-action-loss'/);
  assert.match(migration013, /selectionCreditPolicy', 'expert-hit-0-miss-1'/);
  assert.match(migration013, /confidenceLossPolicy', 'brier-audit-only'/);
  assert.match(migration013, /config_version = '2026-08-08\.1'/);
  assert.match(migration014, /2026-08-15\.2/);
  assert.match(migration014, /regimeDetectionPolicy', 'pearson-multiscale-evidence-v1'/);
  assert.match(migration014, /regimeFallbackHorizon', 170/);
  assert.match(migration014, /regimeEvidenceThreshold', 30/);
  assert.match(migration014, /adaptiveDecayPolicy', 'shared-regime-scale'/);
  assert.match(migration014, /config_version = '2026-08-15\.1'/);
  assert.match(reconciliation, /ADAPTIVE_SELECTION_COUNT/);
  assert.match(reconciliation, /Migration 011 belum aktif/);
});
