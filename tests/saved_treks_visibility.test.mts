import assert from "node:assert/strict";
import { visibleSavedTreksForScan } from "../lib/shared/saved-scan.ts";
import { formatSavedTrekCopyAll, formatScanCopyValues } from "../lib/shared/scan-copy.ts";

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

Deno.test("Salin Semua takes only visible saved Treks, preserving order and numeric format", () => {
  const treks = [
    { id: "sgp-ai-1", marketId: "singapore", scanMode: "ai_2d_belakang" as const, predictionValues: [9, 0, 1, 7] },
    { id: "sgp-pos", marketId: "singapore", scanMode: "posisi" as const, predictionValues: [6, 1] },
    { id: "hk-ai", marketId: "hongkong", scanMode: "ai_2d_belakang" as const, predictionValues: [1, 1, 2, 3] },
    { id: "sgp-ai-2", marketId: "singapore", scanMode: "ai_2d_belakang" as const, predictionValues: [6, 2, 3, 4] },
  ];
  const visible = visibleSavedTreksForScan(treks, "singapore", "ai_2d_belakang");
  const groups = [{ items: [visible[0]] }, { items: [visible[1]] }];
  assert.equal(formatSavedTrekCopyAll(groups), "9017\n6234");
  assert.equal(formatSavedTrekCopyAll([]), "");
  assert.equal(formatSavedTrekCopyAll([{ items: [] }]), "");
  assert.equal(formatSavedTrekCopyAll([{ items: [
    { scanMode: "jalur_2d", predictionValues: [1, 3] },
    { scanMode: "shio", predictionValues: [0, 11] },
    { scanMode: "ai_2d_belakang", predictionValues: [] },
  ] }]), "13\n01-12");
  assert.equal(formatScanCopyValues(visible[0].predictionValues, visible[0].scanMode), "9017");
  assert.equal(treks.length, 4, "Copy must not modify stored treks");
});

Deno.test("saved Trek copy controls are wired to visible groups and each row", async () => {
  const section = await Deno.readTextFile(new URL(
    "../app/scan/_components/SavedTreksSection.tsx",
    import.meta.url,
  ));
  assert.match(section, /formatSavedTrekCopyAll\(groups\)/);
  assert.match(section, /aria-label="Salin semua Trek Tersimpan yang ditampilkan"/);
  assert.match(section, /formatScanCopyValues\(saved\.predictionValues, saved\.scanMode\)/);
  assert.ok(section.indexOf("onClick={() => onView(saved)}") <
    section.indexOf("formatScanCopyValues(saved.predictionValues, saved.scanMode)"));
  assert.ok(section.indexOf("formatScanCopyValues(saved.predictionValues, saved.scanMode)") <
    section.indexOf("onClick={() => onDelete(saved.id)}"));
  assert.match(section, /role="alert"/);
  assert.match(section, /role="status"/);
});
