import assert from "node:assert/strict";

const source = await Deno.readTextFile(
  new URL("../adaptive-service/evaluation.mts", import.meta.url),
);

Deno.test("dashboard evaluasi hanya membaca prediction yang tetap settled", () => {
  const evaluationQueryStart = source.indexOf("from adaptive.evaluations e");
  const stateQueryStart = source.indexOf("from adaptive.engine_states");

  assert.ok(evaluationQueryStart >= 0, "query evaluation tidak ditemukan");
  assert.ok(stateQueryStart > evaluationQueryStart, "batas query evaluation tidak ditemukan");

  const evaluationQuery = source.slice(evaluationQueryStart, stateQueryStart);
  assert.match(evaluationQuery, /join adaptive\.predictions p\s+on p\.id = e\.prediction_id/);
  assert.match(evaluationQuery, /p\.engine_version = \$\{ADAPTIVE_ENGINE_VERSION\}/);
  assert.match(evaluationQuery, /p\.config_version = \$\{ADAPTIVE_CONFIG_VERSION\}/);
  assert.match(evaluationQuery, /p\.status = 'settled'/);
});
