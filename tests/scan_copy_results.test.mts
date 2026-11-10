import assert from "node:assert/strict";
import { formatScanCopyAll, formatScanCopyLabels, formatScanCopyValues } from "../lib/shared/scan-copy.ts";

Deno.test("copy one Scan result uses numeric display conventions for AI, Shio, and Jalur", () => {
  assert.equal(formatScanCopyValues([9, 0, 1, 7], "ai_2d_belakang"), "9017");
  assert.equal(formatScanCopyValues([6, 2, 3, 4], "bbfs_2d_belakang"), "6234");
  assert.equal(formatScanCopyValues([1], "jalur_2d"), "1");
  assert.equal(formatScanCopyValues([1, 3], "jalur_2d"), "13");
  assert.equal(formatScanCopyValues([0, 11], "shio"), "01-12");
  assert.equal(formatScanCopyValues([0, 1, 2], "off_shio"), "01-02-03");
});

Deno.test("copy all preserves displayed ranking, duplicates and line breaks", () => {
  const rows = [
    { angkaHidup: [9, 0, 1, 7], scanMode: "ai_2d_belakang" as const },
    { angkaHidup: [6, 2, 3, 4], scanMode: "ai_2d_belakang" as const },
    { angkaHidup: [9, 0, 1, 7], scanMode: "ai_2d_belakang" as const },
  ];
  assert.equal(formatScanCopyAll(rows), "9017\n6234\n9017");
  assert.equal(formatScanCopyAll([]), "");
  assert.equal(
    formatScanCopyAll([{ angkaHidup: [1, 2], scanMode: "jalur_2d" }]),
    "12",
  );
});

Deno.test("copy icon is next to View and Save; copy-all is in results header", async () => {
  const [section, shared] = await Promise.all([
    Deno.readTextFile(new URL("../app/scan/_components/ScanResultSection.tsx", import.meta.url)),
    Deno.readTextFile(new URL("../app/scan/_lib.ts", import.meta.url)),
  ]);
  assert.match(section, /aria-label="Salin semua hasil Scan"/);
  assert.match(section, /formatScanCopyAll\(result\.items\)/);
  assert.ok(section.indexOf('aria-label="Salin semua hasil Scan"') < section.indexOf("result.items.map"));
  assert.match(section, /formatScanCopyValues\(item\.angkaHidup, item\.scanMode\)/);
  assert.match(section, /aria-label=\{`Salin hasil \$\{index \+ 1\}`\}/);
  assert.ok(section.indexOf("onClick={() => onView(item)}") <
    section.indexOf("formatScanCopyValues(item.angkaHidup, item.scanMode)"));
  assert.ok(section.indexOf("formatScanCopyValues(item.angkaHidup, item.scanMode)") <
    section.indexOf("onClick={() => onSave(item)}"));
  assert.match(section, /role="status"/);
  assert.match(shared, /return formatScanCopyValues\(values, mode\)/);
});

Deno.test("all Scan modes copy digits tightly, with Shio keeping hyphen separators", () => {
  const regularModes = [
    "posisi", "ai_2d_belakang", "bbfs_2d_belakang", "jalur_2d",
    "jumlah_2d_belakang", "ai_3d", "bbfs_3d",
    "off_posisi", "off_2d_belakang", "off_jumlah_2d_belakang", "off_3d",
  ] as const;
  for (const mode of regularModes) {
    assert.equal(formatScanCopyValues([3, 4, 5, 6, 7, 8, 9, 0, 1], mode), "345678901", mode);
    assert.equal(formatScanCopyLabels(["3", "4", "5", "6", "7", "8", "9", "0", "1"], mode), "345678901", mode);
  }
  for (const mode of ["shio", "off_shio"] as const) {
    assert.equal(formatScanCopyValues([0, 1, 11], mode), "01-02-12", mode);
    assert.equal(formatScanCopyLabels(["01", "02", "12"], mode), "01-02-12", mode);
  }
});

Deno.test("Salin Trek detail uses compact formatting for history and pending rows", async () => {
  const source = await Deno.readTextFile(new URL("../app/scan/_lib.ts", import.meta.url));
  assert.match(source, /scanMode: item\.scanMode/);
  assert.match(source, /scanMode: saved\.scanMode/);
  assert.match(source, /formatScanCopyLabels\(row\.values\.map\(\(value\) => value\.label\), detail\.scanMode\)/);
  assert.match(source, /formatScanCopyLabels\(detail\.pendingValues, detail\.scanMode\)/);
  assert.doesNotMatch(source, /row\.values\.map\(\(value\) => value\.label\)\.join\(" "\)/);
  assert.doesNotMatch(source, /detail\.pendingValues\.join\(" "\)/);
});
