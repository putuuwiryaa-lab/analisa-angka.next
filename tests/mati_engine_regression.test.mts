import assert from "node:assert/strict";
import {
  buildMatiActiveStats,
  matiRecencyValue,
  selectMatiEliteKeys,
} from "../lib/server/engines/matiEngine.ts";

Deno.test("recency Angka Mati mempertahankan jarak nol untuk digit terbaru", () => {
  const recency = { "0": 0, "1": 8 };

  assert.equal(matiRecencyValue(recency, "0"), 0);
  assert.equal(matiRecencyValue(recency, "1"), 8);
  assert.equal(matiRecencyValue(recency, "9"), 99);
  assert.ok(
    matiRecencyValue(recency, "1") > matiRecencyValue(recency, "0"),
  );
});

Deno.test("seleksi Angka Mati menampilkan rumus skor maksimum sebagai fallback aktif", () => {
  const fallback = selectMatiEliteKeys(
    ["a", "b", "c", "d"],
    { a: 11, b: 13, c: 12, d: 13 },
  );
  assert.deepEqual(fallback, {
    keys: ["b", "d"],
    fallback: true,
  });

  const fallbackStats = buildMatiActiveStats({
    keys: ["a", "b", "c", "d"],
    names: ["R01", "R02", "R03", "R04"],
    scores: { a: 11, b: 13, c: 12, d: 13 },
    eliteSelection: fallback,
    predictions: { a: 1, b: 7, c: 4, d: 8 },
    result: ["7"],
  });
  assert.deepEqual(fallbackStats, [{
    name: "R02",
    score: 13,
    lolos: true,
    fallback: true,
  }]);

  const perfect = selectMatiEliteKeys(
    ["a", "b", "c", "d"],
    { a: 14, b: 13, c: 14, d: 12 },
  );
  assert.deepEqual(perfect, {
    keys: ["a", "c"],
    fallback: false,
  });

  const perfectStats = buildMatiActiveStats({
    keys: ["a", "b", "c", "d"],
    names: ["R01", "R02", "R03", "R04"],
    scores: { a: 14, b: 13, c: 14, d: 12 },
    eliteSelection: perfect,
    predictions: { a: 2, b: 7, c: 2, d: 8 },
    result: ["2"],
  });
  assert.deepEqual(perfectStats.map((stat) => stat.fallback), [false, false]);
});
