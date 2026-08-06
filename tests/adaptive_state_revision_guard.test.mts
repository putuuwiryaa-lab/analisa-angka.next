import assert from "node:assert/strict";

const migrationUrl = new URL(
  "../sql/neon/008_adaptive_optimistic_concurrency.sql",
  import.meta.url,
);
const sql = await Deno.readTextFile(migrationUrl);

Deno.test("migration 008 membungkus history guard migration 007", () => {
  assert.match(
    sql,
    /to_regprocedure\('adaptive\.store_online_run_base\(jsonb\)'\) is null/,
  );
  assert.match(
    sql,
    /alter function adaptive\.store_online_run\(jsonb\)[\s\S]*rename to store_online_run_revision_base/,
  );
  assert.match(
    sql,
    /adaptive\.store_online_run_revision_base\(p_payload\)/,
  );
});

Deno.test("concurrency guard mengambil lock sebelum membaca state aktif", () => {
  const lockIndex = sql.indexOf("pg_advisory_xact_lock");
  const stateReadIndex = sql.indexOf("from adaptive.engine_states");
  const baseStoreIndex = sql.indexOf("adaptive.store_online_run_revision_base(p_payload)");

  assert.ok(lockIndex >= 0);
  assert.ok(stateReadIndex > lockIndex);
  assert.ok(baseStoreIndex > stateReadIndex);
});

Deno.test("run incremental stale ditolak berdasarkan state revision", () => {
  assert.match(sql, /v_payload_state_revision is distinct from v_current_state_revision/);
  assert.match(sql, /expected revision %s, observed revision %s/);
  assert.match(sql, /errcode = '40001'/);
});

Deno.test("run yang menjadi tidak kompatibel saat menunggu lock tidak dianggap koreksi baru", () => {
  assert.match(sql, /v_history_correction_at_write boolean := false/);
  assert.match(sql, /v_current_processed_history_length > jsonb_array_length\(v_history_draws\)/);
  assert.match(sql, /v_payload_prefix_last_draw is distinct from v_current_last_processed_draw/);
  assert.match(sql, /v_payload_prefix_fingerprint is distinct from v_current_history_fingerprint/);
  assert.match(
    sql,
    /if v_history_correction_at_write then[\s\S]*if v_payload_state_revision <> 0 then[\s\S]*errcode = '40001'/,
  );
});

Deno.test("full replay koreksi sah tetap dapat memakai revision nol", () => {
  assert.match(
    sql,
    /Context loader membuang state lama ketika koreksi histori terdeteksi/,
  );
  assert.match(
    sql,
    /if v_history_correction_at_write then[\s\S]*if v_payload_state_revision <> 0 then/,
  );
});

Deno.test("wrapper mengembalikan audit optimistic concurrency", () => {
  assert.match(sql, /'optimisticConcurrencyChecked', true/);
  assert.match(sql, /'payloadStateRevision', v_payload_state_revision/);
  assert.match(sql, /'observedStateRevision', v_current_state_revision/);
  assert.match(sql, /'historyCorrectionAtWrite', v_history_correction_at_write/);
});
