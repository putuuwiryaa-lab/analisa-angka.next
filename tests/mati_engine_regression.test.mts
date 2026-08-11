import assert from "node:assert/strict";
import {
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

Deno.test("seleksi Angka Mati menandai rumus skor maksimum sebagai fallback aktif", () => {
  const fallback = selectMatiEliteKeys(
    ["a", "b", "c", "d"],
    { a: 11, b: 13, c: 12, d: 13 },
  );
  assert.deepEqual(fallback, {
    keys: ["b", "d"],
    fallback: true,
  });

  const perfect = selectMatiEliteKeys(
    ["a", "b", "c", "d"],
    { a: 14, b: 13, c: 14, d: 12 },
  );
  assert.deepEqual(perfect, {
    keys: ["a", "c"],
    fallback: false,
  });
});

Deno.test("engine dan panel memakai perbaikan recency serta status fallback", async () => {
  const [engine, panel] = await Promise.all([
    Deno.readTextFile(
      new URL("../lib/server/engines/matiEngine.ts", import.meta.url),
    ),
    Deno.readTextFile(
      new URL("../components/analysis/AnalysisResult.tsx", import.meta.url),
    ),
  ]);

  const recencyComparators = engine.match(
    /matiRecencyValue\(rc, b\) - matiRecencyValue\(rc, a\)/g,
  ) || [];
  assert.equal(recencyComparators.length, 2);
  assert.doesNotMatch(engine, /\(rc\[b\] \|\| 99\) - \(rc\[a\] \|\| 99\)/);
  assert.match(engine, /lolos: eliteKeys\.has\(k\)/);
  assert.match(engine, /fallback: eliteSelection\.fallback/);
  assert.match(panel, /s\.fallback \? "Fallback" : "Elite"/);
});
