import assert from "node:assert/strict";

const migrationUrl = new URL(
  "../sql/neon/005_adaptive_full_publication.sql",
  import.meta.url,
);

Deno.test("migration full publication mempertahankan kontrak atomik 18 selection", async () => {
  const sql = await Deno.readTextFile(migrationUrl);

  assert.match(sql, /create table if not exists adaptive\.selection_evaluations/i);
  assert.match(sql, /v_selection_count <> 18/i);
  assert.match(sql, /v_stored_selection_count <> 18/i);
  assert.match(sql, /v_settled_selection_count <> 18/i);
  assert.match(sql, /snapshot_complete = true/i);
  assert.match(sql, /selectionsPublished/i);
  assert.match(sql, /selectionsSettled/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
});

Deno.test("migration membatalkan pending snapshot lama yang belum lengkap", async () => {
  const sql = await Deno.readTextFile(migrationUrl);

  assert.match(
    sql,
    /update adaptive\.predictions[\s\S]*status = 'cancelled'[\s\S]*snapshot_complete = false/i,
  );
  assert.match(sql, /status = 'pending'/i);
  assert.match(sql, /selection_count = 0/i);
});
