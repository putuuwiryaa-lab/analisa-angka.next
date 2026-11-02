import assert from "node:assert/strict";
import { jalurFrom2D, numbersForJalur } from "../lib/engine/jalur.ts";

Deno.test("Jalur reference lists every 2D value once, with leading-zero display", () => {
  const jalurs = [1, 2, 3] as const;
  const groups = jalurs.map((jalur) => numbersForJalur(jalur));

  assert.deepEqual(groups.map((group) => group.length), [34, 33, 33]);
  assert.deepEqual(groups[0].slice(0, 5).map((n) => String(n).padStart(2, "0")), [
    "00", "01", "04", "07", "10",
  ]);
  assert.equal(groups[1][0], 2);
  assert.equal(groups[2][0], 3);

  const combined = groups.flat();
  assert.equal(combined.length, 100);
  assert.equal(new Set(combined).size, 100);
  assert.deepEqual([...combined].sort((a, b) => a - b), Array.from({ length: 100 }, (_, n) => n));

  for (const jalur of jalurs) {
    const numbers = numbersForJalur(jalur);
    assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b));
    for (const number of numbers) assert.equal(jalurFrom2D(number), jalur);
  }
});

Deno.test("reference panel stays below frequency and exclusive to Jalur Scan, even with zero results", async () => {
  const [section, panel] = await Promise.all([
    Deno.readTextFile(new URL("../app/scan/_components/ScanResultSection.tsx", import.meta.url)),
    Deno.readTextFile(new URL("../app/scan/_components/JalurReferencePanel.tsx", import.meta.url)),
  ]);

  const afterFrequency = section.lastIndexOf("JalurReferencePanel />");
  assert.ok(afterFrequency > section.indexOf("Frekuensi"));
  assert.match(section, /isJalurMode\(result\.config\.scanMode\) \? <JalurReferencePanel \/> : null/);
  assert.ok(afterFrequency > section.indexOf("result.items.length ?"));

  assert.match(panel, /numbersForJalur\(jalur\)/);
  assert.match(panel, /role="group" aria-label="Pilih jalur"/);
  assert.match(panel, /aria-pressed=\{selected === jalur\}/);
  assert.match(panel, /aria-expanded=\{open\}/);
  assert.match(panel, /navigator\.clipboard\.writeText\(text\)/);
  assert.match(panel, /bukan hasil Scan atau prediksi/);
});
