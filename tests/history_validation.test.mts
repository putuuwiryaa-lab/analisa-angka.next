import assert from "node:assert/strict";
import {
  HistoryDataFormatError,
  latestStrictHistoryResult,
  parseStrictHistory as parseApplicationHistory,
} from "../lib/engine/history.ts";
import { parseStrictHistory as parseAdaptiveServiceHistory } from "../adaptive-service/core/history.mts";

Deno.test("parser histori menerima separator resmi tanpa mengubah leading zero", () => {
  const historyData = "0123, 4567;8901 | 2345\n6789";
  const expected = ["0123", "4567", "8901", "2345", "6789"];

  assert.deepEqual(parseApplicationHistory(historyData), expected);
  assert.deepEqual(parseAdaptiveServiceHistory(historyData), expected);
  assert.equal(latestStrictHistoryResult(historyData), "6789");
});

Deno.test("latest result strict tidak melewati token malformed di tengah histori", () => {
  assert.throws(
    () => latestStrictHistoryResult("1234 TOKEN_RUSAK 5678"),
    (error: unknown) => {
      assert.ok(error instanceof HistoryDataFormatError);
      assert.deepEqual(error.invalidTokens, ["TOKEN_RUSAK (urutan 2)"]);
      return true;
    },
  );
});

Deno.test("parser aplikasi dan Adaptive service menolak token yang sama", () => {
  const historyData = "1234 999 5678 bad";

  let applicationMessage = "";
  let adaptiveMessage = "";

  try {
    parseApplicationHistory(historyData);
  } catch (error) {
    applicationMessage = error instanceof Error ? error.message : String(error);
  }

  try {
    parseAdaptiveServiceHistory(historyData);
  } catch (error) {
    adaptiveMessage = error instanceof Error ? error.message : String(error);
  }

  assert.equal(applicationMessage, adaptiveMessage);
  assert.match(applicationMessage, /999 \(urutan 2\)/);
  assert.match(applicationMessage, /bad \(urutan 4\)/);
});

Deno.test("histori kosong tetap menghasilkan collection kosong dan latest null", () => {
  assert.deepEqual(parseApplicationHistory(" \n\t "), []);
  assert.deepEqual(parseAdaptiveServiceHistory(" \n\t "), []);
  assert.equal(latestStrictHistoryResult(null), null);
});

Deno.test("route Analisa publik menolak history_data malformed dengan notifikasi 422", async () => {
  const routePaths = [
    "../app/api/analyze/route.ts",
    "../app/api/market-history/route.ts",
    "../app/api/share-predictions/rekap-badge/route.ts",
  ];

  for (const path of routePaths) {
    const route = await Deno.readTextFile(new URL(path, import.meta.url));

    assert.match(route, /parseStrictHistory/, `${path} wajib memakai parser histori strict`);
    assert.match(route, /HistoryDataFormatError/, `${path} wajib mengenali format histori rusak`);
    assert.match(route, /status:\s*422/, `${path} wajib mengirim status 422`);
    assert.equal(
      route.includes(".filter((token) => /^\\d{4}$/.test(token))") ||
        route.includes(".filter((item) => /^\\d{4}$/.test(item))"),
      false,
      `${path} tidak boleh membuang token rusak secara diam-diam`,
    );
  }
});

Deno.test("pesan histori rusak diteruskan sampai notifikasi error Analisa", async () => {
  const [marketClient, analyzeClient, controller, view] = await Promise.all([
    Deno.readTextFile(new URL("../lib/markets/client.ts", import.meta.url)),
    Deno.readTextFile(new URL("../components/analysis/analysisApiClient.ts", import.meta.url)),
    Deno.readTextFile(new URL("../components/analysis/useAnalysisController.ts", import.meta.url)),
    Deno.readTextFile(
      new URL("../app/analyze/[marketId]/[mode]/AnalyzeModeClient.tsx", import.meta.url),
    ),
  ]);

  assert.match(marketClient, /throw new Error\(json\?\.error/);
  assert.match(analyzeClient, /throw new Error\(json\.error/);
  assert.match(controller, /setError\(e\.message/);
  assert.match(view, /\{error\}/);
});
