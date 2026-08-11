import assert from "node:assert/strict";
import { formatMarketName } from "../lib/markets/format.ts";

Deno.test("formatMarketName membuat label market konsisten tanpa mengubah identitas", () => {
  const marketId = "Swedia";

  assert.equal(formatMarketName("Swedia", marketId), "SWEDIA");
  assert.equal(formatMarketName("  singapore   6d  ", marketId), "SINGAPORE 6D");
  assert.equal(formatMarketName("GERMANY", marketId), "GERMANY");
  assert.equal(formatMarketName("São Paulo", marketId), "SÃO PAULO");
  assert.equal(marketId, "Swedia");
});

Deno.test("formatMarketName memakai fallback aman untuk nilai kosong atau tidak valid", () => {
  assert.equal(formatMarketName("", "sgp"), "SGP");
  assert.equal(formatMarketName(null, " hk "), "HK");
  assert.equal(formatMarketName({ name: "SGP" }), "PASARAN");
  assert.equal(formatMarketName(undefined, undefined), "PASARAN");
});

Deno.test("jalur label market utama memakai formatter bersama", async () => {
  const files = await Promise.all([
    Deno.readTextFile(new URL("../app/api/markets/route.ts", import.meta.url)),
    Deno.readTextFile(new URL("../app/api/market-history/route.ts", import.meta.url)),
    Deno.readTextFile(new URL("../app/api/scan/route.ts", import.meta.url)),
    Deno.readTextFile(new URL("../app/api/batch-scan/route.ts", import.meta.url)),
    Deno.readTextFile(new URL("../components/analysis/AnalysisPageChrome.tsx", import.meta.url)),
    Deno.readTextFile(new URL("../app/share-prediksi/utils.ts", import.meta.url)),
    Deno.readTextFile(new URL("../components/statistics/StatisticCard.tsx", import.meta.url)),
  ]);

  for (const source of files) {
    assert.match(source, /formatMarketName/);
  }

  assert.doesNotMatch(files[3], /function titleCase/);
  assert.doesNotMatch(
    files[5],
    /raw\.toLowerCase\(\)\.replace/,
  );
});
