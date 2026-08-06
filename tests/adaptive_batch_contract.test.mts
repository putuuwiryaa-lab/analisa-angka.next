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
} from "../lib/adaptive/types.ts";

Deno.test("kontrak Batch Adaptive menormalisasi request dengan versi aktif", () => {
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

Deno.test("kontrak Batch Adaptive menolak format version yang ambigu", () => {
  const result = parseAdaptiveBatchRequest({
    marketIds: ["sgp"],
    target2D: "depan",
    method: "ai",
    digitCount: 4,
    engineVersion: "hf apie latest",
    configVersion: ADAPTIVE_CONFIG_VERSION,
  });

  assert.deepEqual(result, {
    ok: false,
    error: "Versi engine dan konfigurasi Adaptive tidak valid.",
  });
});

Deno.test("caller Batch selalu mengirim versi engine dan config yang sedang aktif", () => {
  assert.deepEqual(buildAdaptiveBatchSnapshotRequest({
    marketIds: ["sgp"],
    target2D: "tengah",
    method: "ai",
    digitCount: 4,
  }), {
    marketIds: ["sgp"],
    target2D: "tengah",
    method: "ai",
    digitCount: 4,
    engineVersion: ADAPTIVE_ENGINE_VERSION,
    configVersion: ADAPTIVE_CONFIG_VERSION,
  });
});

Deno.test("metadata snapshot Batch menolak versi lama dan publication tidak lengkap", () => {
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
    snapshot_complete: false,
  }), "incomplete");
  assert.equal(adaptiveBatchSnapshotIssue({
    ...complete,
    selection_count: ADAPTIVE_PUBLICATION_SELECTION_COUNT - 1,
  }), "incomplete");
});
