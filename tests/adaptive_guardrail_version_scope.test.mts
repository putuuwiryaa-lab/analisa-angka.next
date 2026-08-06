import assert from "node:assert/strict";

const source = await Deno.readTextFile(
  new URL("../adaptive-service/guardrail-health.mts", import.meta.url),
);

Deno.test("guardrail event health hanya memakai prediction versi aktif", () => {
  const eventQueryStart = source.indexOf("from adaptive.drift_events event");
  assert.ok(eventQueryStart >= 0, "query drift event tidak ditemukan");

  const eventQuery = source.slice(eventQueryStart);
  assert.match(
    eventQuery,
    /join adaptive\.predictions prediction\s+on prediction\.id = event\.prediction_id/,
  );
  assert.match(
    eventQuery,
    /prediction\.engine_version = \$\{ADAPTIVE_ENGINE_VERSION\}/,
  );
  assert.match(
    eventQuery,
    /prediction\.config_version = \$\{ADAPTIVE_CONFIG_VERSION\}/,
  );
  assert.match(eventQuery, /prediction\.status = 'settled'/);
});

Deno.test("settlement health tidak menghitung evaluasi prediction yang diaktifkan kembali", () => {
  const settlementQueryStart = source.indexOf("from adaptive.evaluations e");
  const eventQueryStart = source.indexOf("from adaptive.drift_events event");
  assert.ok(settlementQueryStart >= 0);
  assert.ok(eventQueryStart > settlementQueryStart);

  const settlementQuery = source.slice(settlementQueryStart, eventQueryStart);
  assert.match(settlementQuery, /p\.engine_version = \$\{ADAPTIVE_ENGINE_VERSION\}/);
  assert.match(settlementQuery, /p\.config_version = \$\{ADAPTIVE_CONFIG_VERSION\}/);
  assert.match(settlementQuery, /p\.status = 'settled'/);
});

Deno.test("agregasi latest event memakai alias drift event yang tervalidasi", () => {
  assert.match(
    source,
    /array_agg\(event\.event_type order by event\.created_at desc\)/,
  );
  assert.match(source, /max\(event\.created_at\) as created_at/);
});
