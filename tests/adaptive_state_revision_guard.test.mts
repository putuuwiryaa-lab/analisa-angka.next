import assert from "node:assert/strict";

const sql = await Deno.readTextFile(
  new URL("../sql/neon/008_adaptive_optimistic_concurrency.sql", import.meta.url),
);
const reconcile = await Deno.readTextFile(
  new URL("../adaptive-service/reconcile.mts", import.meta.url),
);

Deno.test("state token is checked after the lock", () => {
  const lock = sql.indexOf("pg_advisory_xact_lock");
  const read = sql.indexOf("from adaptive.engine_states");
  const write = sql.indexOf("store_online_run_revision_base(p_payload)");
  assert.ok(lock >= 0 && read > lock && write > read);
  assert.match(sql, /expectedStateRevision/);
  assert.match(sql, /expectedHistoryFingerprint/);
  assert.match(sql, /errcode = '40001'/);
});

Deno.test("reconciliation sends the token it read", () => {
  assert.match(reconcile, /expectedStateRevision: context\.expectedStateRevision/);
  assert.match(reconcile, /expectedHistoryFingerprint: context\.expectedHistoryFingerprint/);
});
