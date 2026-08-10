import assert from "node:assert/strict";

Deno.test(
  "Batch memakai dropdown bertema bersama tanpa select native",
  async () => {
    const [batchPage, scanFields, themedSelect] = await Promise.all([
      Deno.readTextFile(new URL("../app/scan/batch/page.tsx", import.meta.url)),
      Deno.readTextFile(
        new URL("../app/scan/_components/ScanFields.tsx", import.meta.url),
      ),
      Deno.readTextFile(
        new URL("../app/scan/_components/ThemedSelect.tsx", import.meta.url),
      ),
    ]);

    assert.match(batchPage, /import ThemedSelect/);
    assert.match(batchPage, /label="Jenis"[\s\S]*?options=\{MODES\}/);
    assert.match(
      batchPage,
      /label="Jumlah digit"[\s\S]*?options=\{digitOptions\}/,
    );
    assert.match(batchPage, /POSITION_OPTIONS/);
    assert.match(batchPage, /TARGET_2D_OPTIONS/);
    assert.match(batchPage, /TARGET_3D_OPTIONS/);
    assert.match(batchPage, /ADAPTIVE_TARGET_OPTIONS/);
    assert.doesNotMatch(batchPage, /<select\b/i);
    assert.doesNotMatch(batchPage, /<option\b/i);

    assert.match(scanFields, /import ThemedSelect/);
    assert.doesNotMatch(scanFields, /function ThemedSelect/);

    assert.match(themedSelect, /^"use client";/);
    assert.match(themedSelect, /aria-haspopup="listbox"/);
    assert.match(themedSelect, /role="listbox"/);
    assert.match(themedSelect, /role="option"/);
    assert.match(themedSelect, /aria-selected=\{selected\}/);
    assert.match(themedSelect, /event\.key === "Escape"/);
    assert.match(themedSelect, /bg-surface-2/);
    assert.match(themedSelect, /border-border-strong/);
  },
);
