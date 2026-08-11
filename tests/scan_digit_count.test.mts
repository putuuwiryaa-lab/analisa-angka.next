import assert from "node:assert/strict";

import {
  isValidScanDigitCount,
  maxScanDigitCount,
} from "../lib/shared/scan-mode.ts";

Deno.test("scan angka hanya menerima 1 sampai 9 digit", () => {
  const numberModes = [
    "posisi",
    "ai_2d_belakang",
    "bbfs_2d_belakang",
    "jumlah_2d_belakang",
    "ai_3d",
    "bbfs_3d",
    "off_posisi",
    "off_2d_belakang",
    "off_jumlah_2d_belakang",
    "off_3d",
  ] as const;

  for (const mode of numberModes) {
    assert.equal(maxScanDigitCount(mode), 9);
    assert.equal(isValidScanDigitCount(mode, 1), true);
    assert.equal(isValidScanDigitCount(mode, 9), true);
    assert.equal(isValidScanDigitCount(mode, 10), false);
  }
});

Deno.test("scan Shio tetap menerima 1 sampai 12 pilihan", () => {
  for (const mode of ["shio", "off_shio"] as const) {
    assert.equal(maxScanDigitCount(mode), 12);
    assert.equal(isValidScanDigitCount(mode, 12), true);
    assert.equal(isValidScanDigitCount(mode, 13), false);
  }
});

Deno.test("jumlah digit harus berupa bilangan bulat positif", () => {
  assert.equal(isValidScanDigitCount("bbfs_2d_belakang", 0), false);
  assert.equal(isValidScanDigitCount("bbfs_2d_belakang", 7.5), false);
  assert.equal(isValidScanDigitCount("bbfs_2d_belakang", "7"), false);
});
