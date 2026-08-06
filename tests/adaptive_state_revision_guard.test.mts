import assert from "node:assert/strict";

const migrationUrl = new URL(
  "../sql/neon/008_adaptive_optimistic_concurrency.sql",
  import.meta.url,
);
const reconcileUrl = new URL("../adaptive-service/reconcile.mts", import.meta.url);
const httpUrl = new URL("../adaptive-service/http.mts", import.meta.url);
const persistenceUrl = new URL("../lib/adaptive/persistence.ts", import.meta.url);

const [sql, reconcile, http, persistence] = await Promise.all([
  Deno.readTextFile(migrationUrl),
  Deno.readTextFile(reconcileUrl),
  Deno.readTextFile(httpUrl),
  Deno.readTextFile(persistenceUrl),
]);

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

Deno.test("reconciliation membawa token state walaupun context ditolak untuk replay", () => {
  assert.match(
    reconcile,
    /expectedStateRevision: stateRow \? Number\(stateRow\.state_revision \?\? 0\) : null/,
  );
  assert.match(
    reconcile,
    /expectedHistoryFingerprint: stateRow\?\.history_fingerprint/,
  );
  assert.match(
    reconcile,
    /expectedStateRevision: context\.expectedStateRevision/,
  );
  assert.match(
    reconcile,
    /expectedHistoryFingerprint: context\.expectedHistoryFingerprint/,
  );
});

Deno.test("service context dan persistence client meneruskan token yang sama", () => {
  assert.match(http, /expectedStateRevision: stateRow \? Number\(stateRow\.state_revision \?\? 0\) : null/);
  assert.match(http, /expectedHistoryFingerprint: stateRow\?\.history_fingerprint/);
  assert.match(http, /Expected state revision tidak valid/);
  assert.match(http, /Expected history fingerprint tidak valid/);
  assert.match(persistence, /expectedStateRevision: payload\.expectedStateRevision/);
  assert.match(persistence, /expectedHistoryFingerprint: typeof payload\.expectedHistoryFingerprint/);
  assert.match(persistence, /expectedStateRevision: contextToken\.expectedStateRevision/);
  assert.match(persistence, /expectedHistoryFingerprint: contextToken\.expectedHistoryFingerprint/);
});

Deno.test("wrapper mengembalikan audit optimistic concurrency", () => {
  assert.match(sql, /'optimisticConcurrencyChecked', true/);
  assert.match(sql, /'expectedStateRevision', v_expected_state_revision/);
  assert.match(sql, /'observedStateRevision', v_current_state_revision/);
  assert.match(sql, /'expectedHistoryFingerprint', v_expected_history_fingerprint/);
  assert.match(sql, /'observedHistoryFingerprint', v_current_history_fingerprint/);
});
