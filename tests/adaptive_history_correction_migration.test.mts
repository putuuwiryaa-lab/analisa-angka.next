import assert from "node:assert/strict";

const migrationUrl = new URL(
  "../sql/neon/007_cancel_corrected_history_pending.sql",
  import.meta.url,
);
const sql = await Deno.readTextFile(migrationUrl);

Deno.test("migration 007 membungkus store_online_run secara idempotent", () => {
  assert.match(
    sql,
    /to_regprocedure\('adaptive\.store_online_run_base\(jsonb\)'\) is null/,
  );
  assert.match(
    sql,
    /alter function adaptive\.store_online_run\(jsonb\)[\s\S]*rename to store_online_run_base/,
  );
  assert.match(
    sql,
    /create or replace function adaptive\.store_online_run\([\s\S]*p_payload jsonb/,
  );
});

Deno.test("migration 007 mendeteksi koreksi dari panjang, cutoff, dan fingerprint prefix", () => {
  assert.match(
    sql,
    /v_processed_history_length > jsonb_array_length\(v_history_draws\)/,
  );
  assert.match(
    sql,
    /v_current_prefix_last_draw is distinct from v_last_processed_draw/,
  );
  assert.match(
    sql,
    /digest\(convert_to\(coalesce\(v_current_prefix, ''\), 'UTF8'\), 'sha256'\)/,
  );
  assert.match(
    sql,
    /string_agg\(draw\.value, '\|' order by draw\.ordinality\)/,
  );
});

Deno.test("pending lineage lama dibatalkan sebelum full-publication store", () => {
  const cancelIndex = sql.indexOf("update adaptive.predictions");
  const baseStoreIndex = sql.indexOf("adaptive.store_online_run_base(p_payload)");

  assert.ok(cancelIndex >= 0, "statement pembatalan pending tidak ditemukan");
  assert.ok(baseStoreIndex >= 0, "pemanggilan fungsi store dasar tidak ditemukan");
  assert.ok(cancelIndex < baseStoreIndex, "pending harus dibatalkan sebelum snapshot baru ditulis");
  assert.match(sql, /and status = 'pending'/);
  assert.match(sql, /get diagnostics v_cancelled_pending_count = row_count/);
});

Deno.test("wrapper mengembalikan audit koreksi dan jumlah pending yang dibatalkan", () => {
  assert.match(sql, /'historyCorrectionDetected', v_history_correction_detected/);
  assert.match(sql, /'pendingPredictionsCancelled', v_cancelled_pending_count/);
});
