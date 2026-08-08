import assert from "node:assert/strict";

Deno.test("Adaptive UI membaca snapshot dan tidak menjalankan engine lokal", async () => {
  const route = await Deno.readTextFile(
    new URL("../app/api/scan/route.ts", import.meta.url),
  );

  assert.match(route, /loadAdaptivePublishedSnapshot/);
  assert.match(route, /validateAdaptivePublishedSnapshot/);
  assert.doesNotMatch(route, /from ["']@\/lib\/adaptive\/engine["']/);
  assert.doesNotMatch(route, /from ["']@\/lib\/adaptive\/learning["']/);
});

Deno.test("Adaptive reconciliation memakai core engine authoritative", async () => {
  const reconciliation = await Deno.readTextFile(
    new URL("../adaptive-service/reconcile.mts", import.meta.url),
  );

  assert.match(reconciliation, /runAdaptiveOnline.*\.\/core\/engine\.mts/s);
  assert.doesNotMatch(reconciliation, /lib\/adaptive\/engine/);
});

Deno.test("boundary Adaptive didokumentasikan di lib client", async () => {
  const boundary = await Deno.readTextFile(
    new URL("../lib/adaptive/README.md", import.meta.url),
  );

  assert.match(boundary, /adaptive-service\/core/);
  assert.match(boundary, /bukan.*engine reconciliation production/i);
  assert.match(boundary, /Request UI normal tidak menjalankan learning atau reconciliation lokal/);
});
