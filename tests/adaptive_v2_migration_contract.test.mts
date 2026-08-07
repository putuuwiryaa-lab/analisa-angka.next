import assert from "node:assert/strict";

const migration = await Deno.readTextFile(
  new URL("../sql/neon/011_adaptive_v2_back_only.sql", import.meta.url),
);

Deno.test("migration 011 mempertahankan wrapper V1 selama rollout", () => {
  assert.match(migration, /store_online_run_v1_calibration_base/);
  assert.match(migration, /v_engine_version is distinct from 'hf-apie-v2-back'/);
});

Deno.test("migration 011 memvalidasi contract 11 selection V2", () => {
  assert.match(migration, /v_selection_count <> 11/);
  assert.match(migration, /'ai', 1/);
  assert.match(migration, /'ai', 6/);
  assert.match(migration, /'bbfs', 5/);
  assert.match(migration, /'bbfs', 9/);
  assert.match(migration, /target 2D belakang/);
});

Deno.test("migration 011 tidak menghapus audit V1", () => {
  assert.doesNotMatch(migration, /delete\s+from\s+adaptive\.predictions/i);
  assert.doesNotMatch(migration, /delete\s+from\s+adaptive\.evaluations/i);
  assert.match(migration, /set status = 'cancelled'/);
  assert.match(migration, /engine_version = 'hf-apie-v1-online'/);
});

Deno.test("migration 011 mengembalikan count final 11 ke reconciliation", () => {
  assert.match(migration, /'selectionsPublished', 11/);
  assert.match(migration, /'selectionsSettled', case when v_settlement is null then 0 else 11 end/);
  assert.match(migration, /'selectionCalibrationPublished'/);
  assert.match(migration, /'selectionCalibrationUpdated'/);
});
