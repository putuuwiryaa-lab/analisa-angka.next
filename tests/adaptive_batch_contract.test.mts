import assert from "node:assert/strict";
import { parseAdaptiveBatchRequest } from "../adaptive-service/batch-contract.mts";
import {
  adaptiveBatchSnapshotIssue,
  ADAPTIVE_PUBLICATION_SELECTION_COUNT,
  buildAdaptiveBatchSnapshotRequest,
} from "../lib/adaptive/batch-snapshot.ts";
import {
  ADAPTIVE_CONFIG_VERSION,
  ADAPTIVE_ENGINE_VERSION,
  ADAPTIVE_SELECTION_COUNT,
} from "../lib/adaptive/types.ts";

Deno.test("kontrak Batch Adaptive V2 menormalisasi request belakang dengan versi aktif", () => {
  const result = parseAdaptiveBatchRequest({
    marketIds: ["sgp", " hk ", "sgp"],
    target2D: "belakang",
    method: "bbfs",
    digitCount: 7,
    engineVersion: ADAPTIVE_ENGINE_VERSION,
    configVersion: ADAPTIVE_CONFIG_VERSION,
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      marketIds: ["sgp", "hk"],
      target2D: "belakang",
      method: "bbfs",
      digitCount: 7,
      engineVersion: ADAPTIVE_ENGINE_VERSION,
      configVersion: ADAPTIVE_CONFIG_VERSION,
    },
  });
});

Deno.test("kontrak Batch Adaptive V2 menolak target depan dan selection retired", () => {
  const target = parseAdaptiveBatchRequest({
    marketIds: ["sgp"],
    target2D: "depan",
    method: "ai",
    digitCount: 4,
    engineVersion: ADAPTIVE_ENGINE_VERSION,
    configVersion: ADAPTIVE_CONFIG_VERSION,
  });
  assert.deepEqual(target, {
    ok: false,
    error: "Adaptive V2 hanya menyediakan target 2D belakang.",
  });

  const retired = parseAdaptiveBatchRequest({
    marketIds: ["sgp"],
    target2D: "belakang",
    method: "bbfs",
    digitCount: 4,
    engineVersion: ADAPTIVE_ENGINE_VERSION,
    configVersion: ADAPTIVE_CONFIG_VERSION,
  });
  assert.deepEqual(retired, {
    ok: false,
    error: "Kombinasi metode dan jumlah digit Adaptive V2 tidak tersedia.",
  });
});

Deno.test("kontrak Batch Adaptive menolak request tanpa engine/config version", () => {
  const result = parseAdaptiveBatchRequest({
    marketIds: ["sgp"],
    target2D: "belakang",
    method: "ai",
    digitCount: 4,
  });

  assert.deepEqual(result, {
    ok: false,
    error: "Versi engine dan konfigurasi Adaptive tidak valid.",
  });
});

Deno.test("caller Batch selalu mengirim versi engine dan config V2 aktif", () => {
  assert.deepEqual(buildAdaptiveBatchSnapshotRequest({
    marketIds: ["sgp"],
    target2D: "belakang",
    method: "ai",
    digitCount: 4,
  }), {
    marketIds: ["sgp"],
    target2D: "belakang",
    method: "ai",
    digitCount: 4,
    engineVersion: ADAPTIVE_ENGINE_VERSION,
    configVersion: ADAPTIVE_CONFIG_VERSION,
  });
});

Deno.test("metadata snapshot Batch memakai publication count V2", () => {
  assert.equal(ADAPTIVE_PUBLICATION_SELECTION_COUNT, ADAPTIVE_SELECTION_COUNT);
  assert.equal(ADAPTIVE_PUBLICATION_SELECTION_COUNT, 11);

  const complete = {
    engine_version: ADAPTIVE_ENGINE_VERSION,
    config_version: ADAPTIVE_CONFIG_VERSION,
    snapshot_complete: true,
    selection_count: ADAPTIVE_PUBLICATION_SELECTION_COUNT,
  };

  assert.equal(adaptiveBatchSnapshotIssue(complete), null);
  assert.equal(adaptiveBatchSnapshotIssue({
    ...complete,
    config_version: "config-lama",
  }), "version");
  assert.equal(adaptiveBatchSnapshotIssue({
    ...complete,
    selection_count: ADAPTIVE_PUBLICATION_SELECTION_COUNT - 1,
  }), "incomplete");
});
