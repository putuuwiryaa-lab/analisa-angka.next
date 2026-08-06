import assert from "node:assert/strict";
import {
  LEGACY_PREDICTION_STORE_PATH,
  retiredLegacyPredictionStore,
} from "../adaptive-service/legacy-endpoint.mts";

Deno.test("endpoint prediction legacy selalu dihentikan dengan 410", async () => {
  const response = retiredLegacyPredictionStore(
    new Request(`https://adaptive.example${LEGACY_PREDICTION_STORE_PATH}`, {
      method: "POST",
      body: JSON.stringify({ marketId: "sgp" }),
    }),
  );

  assert.ok(response);
  assert.equal(response.status, 410);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    error: "Endpoint prediction legacy sudah dinonaktifkan. Gunakan /runs/store dengan snapshot lengkap 18 selection.",
    replacement: "/runs/store",
  });
});

Deno.test("request Adaptive lain diteruskan ke handler utama", () => {
  const response = retiredLegacyPredictionStore(
    new Request("https://adaptive.example/runs/store", { method: "POST" }),
  );

  assert.equal(response, null);
});
