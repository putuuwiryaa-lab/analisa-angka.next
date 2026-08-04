import assert from "node:assert/strict";
import {
  defaultDriftDetectorState,
  historyFingerprint,
  isStoredHistoryCompatible,
  updateDriftDetector,
  type DriftDetectorState,
  type DriftState,
} from "../adaptive-service/guardrail.mts";

function applyLosses(losses: number[]): { state: DriftState; detector: DriftDetectorState } {
  let state: DriftState = "stable";
  let detector = defaultDriftDetectorState();

  losses.forEach((loss, index) => {
    const update = updateDriftDetector(
      state,
      detector,
      {
        predictionId: `prediction-${index}`,
        combinedLoss: loss,
      },
      `2026-08-04T00:${String(index).padStart(2, "0")}:00Z`,
    );
    state = update.nextState;
    detector = update.detectorState;
  });

  return { state, detector };
}

Deno.test("fingerprint histori stabil dan sensitif terhadap koreksi internal", async () => {
  const original = ["1234", "5678", "9012"];
  const same = [...original];
  const corrected = ["1234", "5679", "9012"];

  assert.equal(await historyFingerprint(original), await historyFingerprint(same));
  assert.notEqual(await historyFingerprint(original), await historyFingerprint(corrected));
});

Deno.test("state tanpa fingerprint lama tetap kompatibel dan dapat dibackfill", async () => {
  const draws = ["1234", "5678", "9012"];
  const result = await isStoredHistoryCompatible({
    draws,
    processedHistoryLength: 3,
    lastProcessedDraw: "9012",
    storedFingerprint: null,
  });

  assert.equal(result.compatible, true);
  assert.equal(result.correctionDetected, false);
  assert.ok(result.currentFingerprint);
});

Deno.test("koreksi result tengah memaksa context lama ditolak", async () => {
  const previous = ["1234", "5678", "9012"];
  const corrected = ["1234", "5679", "9012"];
  const result = await isStoredHistoryCompatible({
    draws: corrected,
    processedHistoryLength: 3,
    lastProcessedDraw: "9012",
    storedFingerprint: await historyFingerprint(previous),
  });

  assert.equal(result.compatible, false);
  assert.equal(result.correctionDetected, true);
});

Deno.test("detector tidak mengeluarkan warning sebelum sepuluh baseline settlement", () => {
  const result = applyLosses(Array.from({ length: 10 }, () => 0.2));
  assert.equal(result.state, "stable");
  assert.equal(result.detector.sampleCount, 10);
  assert.equal(result.detector.reason, "warmup");
});

Deno.test("penurunan loss yang persisten bergerak dari warning ke drift", () => {
  const result = applyLosses([
    ...Array.from({ length: 10 }, () => 0.2),
    1,
    1,
    1,
  ]);

  assert.equal(result.state, "drift");
  assert.equal(result.detector.badSignal, true);
  assert.ok(result.detector.pageHinkley > 0);
});

Deno.test("settlement duplikat tidak menambah sample detector", () => {
  const first = updateDriftDetector(
    "stable",
    defaultDriftDetectorState(),
    { predictionId: "same", combinedLoss: 0.4 },
  );
  const duplicate = updateDriftDetector(
    first.nextState,
    first.detectorState,
    { predictionId: "same", combinedLoss: 1 },
  );

  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.detectorState.sampleCount, 1);
  assert.equal(duplicate.detectorState.lastLoss, 0.4);
});
