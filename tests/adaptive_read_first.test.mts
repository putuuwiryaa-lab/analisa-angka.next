import assert from "node:assert/strict";
import { validateAdaptivePublishedSnapshot } from "../lib/adaptive/published-snapshot.ts";
import {
  ADAPTIVE_CONFIG_VERSION,
  ADAPTIVE_ENGINE_VERSION,
  ADAPTIVE_SELECTION_COUNT,
} from "../lib/adaptive/types.ts";

const expected = {
  marketId: "sgp",
  target2D: "belakang" as const,
  method: "bbfs" as const,
  digitCount: 7,
  latestDraw: "4353",
  historyLength: 170,
};

const completeSnapshot = {
  prediction_id: "11111111-1111-1111-1111-111111111111",
  market_id: "sgp",
  market_name: "Singapore",
  target_2d: "belakang",
  latest_draw: "4353",
  history_length: 170,
  engine_version: ADAPTIVE_ENGINE_VERSION,
  config_version: ADAPTIVE_CONFIG_VERSION,
  signal_strength: "high",
  state_revision: 12,
  snapshot_complete: true,
  selection_count: ADAPTIVE_SELECTION_COUNT,
  prediction_created_at: "2026-08-06T12:00:00.000Z",
  method: "bbfs",
  digit_count: 7,
  digits: [0, 1, 2, 3, 4, 5, 6],
  estimated_success: 0.62,
  baseline_success: 0.49,
  lift: 0.13,
  selection_margin: 0.04,
};

Deno.test("snapshot publikasi lengkap dinormalisasi untuk UI read-first", () => {
  const result = validateAdaptivePublishedSnapshot(completeSnapshot, expected);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.value.predictionId, completeSnapshot.prediction_id);
  assert.equal(result.value.signalStrength, "high");
  assert.deepEqual(result.value.digits, completeSnapshot.digits);
  assert.equal(result.value.stateRevision, 12);
});

Deno.test("snapshot dengan cutoff atau panjang histori lama ditolak sebagai stale", () => {
  const staleDraw = validateAdaptivePublishedSnapshot({
    ...completeSnapshot,
    latest_draw: "9999",
  }, expected);
  const staleLength = validateAdaptivePublishedSnapshot({
    ...completeSnapshot,
    history_length: 169,
  }, expected);

  assert.deepEqual(staleDraw, {
    ok: false,
    issue: "stale",
    error: "Snapshot Adaptive belum mengikuti result terbaru.",
  });
  assert.deepEqual(staleLength, staleDraw);
});

Deno.test("snapshot versi lama dan publication tidak lengkap ditolak", () => {
  const oldVersion = validateAdaptivePublishedSnapshot({
    ...completeSnapshot,
    config_version: "config-lama",
  }, expected);
  const incomplete = validateAdaptivePublishedSnapshot({
    ...completeSnapshot,
    selection_count: ADAPTIVE_SELECTION_COUNT - 1,
    snapshot_complete: false,
  }, expected);

  assert.equal(oldVersion.ok, false);
  if (!oldVersion.ok) assert.equal(oldVersion.issue, "version");
  assert.equal(incomplete.ok, false);
  if (!incomplete.ok) assert.equal(incomplete.issue, "incomplete");
});

Deno.test("selection salah atau digit duplikat ditolak", () => {
  const wrongSelection = validateAdaptivePublishedSnapshot({
    ...completeSnapshot,
    method: "ai",
  }, expected);
  const duplicateDigits = validateAdaptivePublishedSnapshot({
    ...completeSnapshot,
    digits: [0, 1, 2, 3, 4, 5, 5],
  }, expected);

  assert.equal(wrongSelection.ok, false);
  if (!wrongSelection.ok) assert.equal(wrongSelection.issue, "selection");
  assert.equal(duplicateDigits.ok, false);
  if (!duplicateDigits.ok) assert.equal(duplicateDigits.issue, "selection");
});

Deno.test("route Adaptive UI hanya membaca snapshot dan tidak menjalankan writer", async () => {
  const route = await Deno.readTextFile(
    new URL("../app/api/scan/route.ts", import.meta.url),
  );

  assert.match(route, /loadAdaptivePublishedSnapshot/);
  assert.match(route, /validateAdaptivePublishedSnapshot/);
  assert.doesNotMatch(route, /runAdaptiveOnline/);
  assert.doesNotMatch(route, /persistAdaptiveRun/);
  assert.doesNotMatch(route, /loadAdaptiveContext/);
});

Deno.test("persistence helper memakai selection count V2 terpusat", async () => {
  const persistence = await Deno.readTextFile(
    new URL("../lib/adaptive/persistence.ts", import.meta.url),
  );

  assert.match(persistence, /ADAPTIVE_SELECTION_COUNT/);
  assert.doesNotMatch(persistence, /selectionsPublished\s*!==\s*18/);
  assert.doesNotMatch(persistence, /selectionsSettled\s*!==\s*18/);
  assert.doesNotMatch(persistence, /18 selection/);
});
