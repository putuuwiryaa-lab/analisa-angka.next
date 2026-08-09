import assert from "node:assert/strict";
import { parseAdaptiveBatchRequest } from "../adaptive-service/batch-contract.mts";
import {
  adaptiveBatchSnapshotIssue,
  ADAPTIVE_PUBLICATION_SELECTION_COUNT,
  buildAdaptiveBatchSnapshotRequest,
} from "../lib/adaptive/batch-snapshot.ts";
import {
  ADAPTIVE_AI_DIGIT_COUNTS,
  ADAPTIVE_BBFS_DIGIT_COUNTS,
  ADAPTIVE_CONFIG_VERSION,
  ADAPTIVE_ENGINE_VERSION,
  ADAPTIVE_SELECTION_COUNT,
  ADAPTIVE_TARGETS,
  isAdaptiveSelection,
  isAdaptiveTarget,
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

Deno.test("pilihan Batch Adaptive persis mengikuti 11 selection V2 belakang", () => {
  assert.deepEqual([...ADAPTIVE_TARGETS], ["belakang"]);
  assert.deepEqual([...ADAPTIVE_AI_DIGIT_COUNTS], [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...ADAPTIVE_BBFS_DIGIT_COUNTS], [5, 6, 7, 8, 9]);

  assert.equal(isAdaptiveTarget("belakang"), true);
  assert.equal(isAdaptiveTarget("depan"), false);
  assert.equal(isAdaptiveTarget("tengah"), false);

  for (let digitCount = 1; digitCount <= 9; digitCount += 1) {
    assert.equal(isAdaptiveSelection("ai", digitCount), digitCount <= 6);
    assert.equal(isAdaptiveSelection("bbfs", digitCount), digitCount >= 5);
  }
});

Deno.test("UI dan API Batch memakai kontrak Adaptive V2 terpusat", async () => {
  const [page, route] = await Promise.all([
    Deno.readTextFile(new URL("../app/scan/batch/page.tsx", import.meta.url)),
    Deno.readTextFile(new URL("../app/api/batch-scan/route.ts", import.meta.url)),
  ]);

  assert.match(page, /ADAPTIVE_AI_DIGIT_COUNTS/);
  assert.match(page, /ADAPTIVE_BBFS_DIGIT_COUNTS/);
  assert.match(page, /Belakang \(Adaptive V2\)/);
  assert.match(
    page,
    /target2D:\s*adaptive\s*\?\s*ADAPTIVE_TARGETS\[0\]\s*:\s*target2D/,
  );

  assert.match(route, /isAdaptiveTarget\(body\.target2D\)/);
  assert.match(route, /isAdaptiveSelection\(method, digitCount\)/);
  assert.doesNotMatch(
    route,
    /clamp\(body\.digitCount,\s*method === "ai" \? 4 : 7,\s*1,\s*9\)/,
  );
});
