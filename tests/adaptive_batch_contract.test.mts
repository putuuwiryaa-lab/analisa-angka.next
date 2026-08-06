import assert from "node:assert/strict";
import { parseAdaptiveBatchRequest } from "../adaptive-service/batch-contract.mts";

Deno.test("kontrak Batch Adaptive menormalisasi request dengan versi aktif", () => {
  const result = parseAdaptiveBatchRequest({
    marketIds: ["sgp", " hk ", "sgp"],
    target2D: "belakang",
    method: "bbfs",
    digitCount: 7,
    engineVersion: "hf-apie-v1-online",
    configVersion: "2026-08-04.2",
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      marketIds: ["sgp", "hk"],
      target2D: "belakang",
      method: "bbfs",
      digitCount: 7,
      engineVersion: "hf-apie-v1-online",
      configVersion: "2026-08-04.2",
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
    configVersion: "2026-08-04.2",
  });

  assert.deepEqual(result, {
    ok: false,
    error: "Versi engine dan konfigurasi Adaptive tidak valid.",
  });
});
