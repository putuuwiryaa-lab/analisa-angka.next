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

Deno.test("payload wajib membawa revision dan fingerprint state yang dibaca", () => {
  assert.match(sql, /p_payload \? 'expectedStateRevision'/);
  assert.match(sql, /p_payload \? 'expectedHistoryFingerprint'/);
  assert.match(sql, /expectedStateRevision harus null atau integer non-negatif/);
  assert.match(sql, /expectedHistoryFingerprint harus null atau SHA-256 hex/);
});

Deno.test("context token dibandingkan tepat setelah lock", () => {
  assert.match(
    sql,
    /v_expected_state_revision is distinct from v_current_state_revision/,
  );
  assert.match(
    sql,
    /v_expected_history_fingerprint is distinct from v_current_history_fingerprint/,
  );
  assert.match(sql, /errcode = '40001'/);
});

Deno.test("run pertama hanya menerima context token null", () => {
  assert.match(
    sql,
    /elsif v_expected_state_revision is not null[\s\S]*or v_expected_history_fingerprint is not null/,
  );
  assert.match(sql, /context mengharapkan state yang tidak lagi tersedia/);
});

Deno.test("wrapper mengembalikan audit optimistic concurrency", () => {
  assert.match(sql, /'optimisticConcurrencyChecked', true/);
  assert.match(sql, /'expectedStateRevision', v_expected_state_revision/);
  assert.match(sql, /'observedStateRevision', v_current_state_revision/);
  assert.match(sql, /'expectedHistoryFingerprint', v_expected_history_fingerprint/);
  assert.match(sql, /'observedHistoryFingerprint', v_current_history_fingerprint/);
});
