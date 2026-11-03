import assert from "node:assert/strict";
import { visibleSavedTreksForScan } from "../lib/shared/saved-scan.ts";

Deno.test("Trek Tersimpan shows only the same pasaran and Jenis Scan", () => {
  const treks = [
    { id: "sgp-ai", marketId: "singapore", scanMode: "ai_2d_belakang" as const },
    { id: "sgp-kpl", marketId: "singapore", scanMode: "posisi" as const },
    { id: "sgp-bbfs", marketId: "singapore", scanMode: "bbfs_2d_belakang" as const },
    { id: "hk-ai", marketId: "hongkong", scanMode: "ai_2d_belakang" as const },
    { id: "sgp-ai-2", marketId: "singapore", scanMode: "ai_2d_belakang" as const },
  ];
  assert.deepEqual(
    visibleSavedTreksForScan(treks, "singapore", "ai_2d_belakang").map((trek) => trek.id),
    ["sgp-ai", "sgp-ai-2"],
  );
  assert.deepEqual(
    visibleSavedTreksForScan(treks, "singapore", "posisi").map((trek) => trek.id),
    ["sgp-kpl"],
  );
  assert.deepEqual(
    visibleSavedTreksForScan(treks, "hongkong", "ai_2d_belakang").map((trek) => trek.id),
    ["hk-ai"],
  );
  assert.deepEqual(visibleSavedTreksForScan(treks, "singapore", "jalur_2d"), []);
  assert.deepEqual(visibleSavedTreksForScan(treks, "", "ai_2d_belakang"), []);
  assert.equal(treks.length, 5, "Hidden treks must not be deleted");
});

Deno.test("Scan uses filtered saved groups and count, while tracking all saved treks", async () => {
  const source = await Deno.readTextFile(
    new URL("../app/scan/ScanPageClient.tsx", import.meta.url),
  );
  assert.match(source, /visibleSavedTreksForScan\(savedTreks, marketId, scanMode\)/);
  assert.match(source, /buildSavedGroups\(visibleSavedTreks\)/);
  assert.match(source, /total=\{visibleSavedTreks\.length\}/);
  assert.match(source, /useSavedScanTracking\(\s*savedTreks,/);
  assert.match(source, /localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(savedTreks\)\)/);
});
