import assert from "node:assert/strict";
import type { Kolom } from "../lib/engine/types.ts";
import type { TrackedSavedScan } from "../lib/shared/saved-scan-state.ts";
import {
  overallSavedScanSyncStatus,
  savedTrekSyncStatus,
  type SavedScanSyncInfo,
} from "../lib/shared/saved-scan-sync.ts";

function trek(id = "one"): TrackedSavedScan {
  return {
    id,
    marketId: "hongkong",
    formula: "A1",
    scanMode: "posisi",
    targetPos: "E",
    target2D: "belakang",
    target3D: "belakang",
    kolomHidup: ["A"] as Kolom[],
    historyTail: ["1510"],
    historyLength: 1,
    snapshotRows: [{
      displayDraw: "1000",
      patokanDraw: "1000",
      targetDraw: "1510",
      patokan: 1,
      deret: [1, 2, 3, 4, 5, 6, 7, 8, 9, 0],
      targetDigit: 0,
      targetDigits: [0],
      kolomKena: "J",
    }],
    savedLatestDraw: "1510",
    predictionValues: [1],
  };
}

function info(overrides: Partial<SavedScanSyncInfo> = {}): SavedScanSyncInfo {
  return {
    refreshing: false,
    refreshError: "",
    statusById: {},
    checkedAt: null,
    ...overrides,
  };
}

Deno.test("a saved prediction is not marked current before successful server verification", () => {
  const saved = trek();
  assert.equal(savedTrekSyncStatus(saved, info()), "unchecked");
  assert.equal(overallSavedScanSyncStatus([saved], info()), "unchecked");
  assert.equal(
    savedTrekSyncStatus(saved, info({ refreshing: true })),
    "syncing",
  );
});

Deno.test("successful refresh confirms the current result even when prediction digits do not change", () => {
  const saved = trek();
  const verified = info({
    checkedAt: "2026-11-07T00:00:00.000Z",
    statusById: { one: "synced" },
  });
  assert.equal(savedTrekSyncStatus(saved, verified), "synced");
  assert.equal(overallSavedScanSyncStatus([saved], verified), "synced");
});

Deno.test("one failed, unverified or legacy trek prevents an all-green status", () => {
  const first = trek("one");
  const second = trek("two");
  const oneVerified = info({ statusById: { one: "synced" } });
  assert.equal(overallSavedScanSyncStatus([first, second], oneVerified), "unchecked");
  assert.equal(
    overallSavedScanSyncStatus([first, second], info({
      statusById: { one: "synced", two: "failed" },
    })),
    "failed",
  );
  assert.equal(savedTrekSyncStatus({ ...second, snapshotRows: [] }, oneVerified), "legacy");
  assert.equal(
    overallSavedScanSyncStatus([first, { ...second, snapshotRows: [] }], oneVerified),
    "legacy",
  );
});

Deno.test("network and individual errors never show synced", () => {
  const saved = trek();
  const previouslyVerified = info({ statusById: { one: "synced" } });
  assert.equal(
    savedTrekSyncStatus(saved, { ...previouslyVerified, refreshError: "Offline" }),
    "failed",
  );
  assert.equal(
    savedTrekSyncStatus({ ...saved, trackingError: "Riwayat terputus" }, previouslyVerified),
    "failed",
  );
  assert.equal(overallSavedScanSyncStatus([], previouslyVerified), "unchecked");
});

Deno.test("saved trek refresh includes Jalur columns and verified UI wiring", async () => {
  const api = await Deno.readTextFile(
    new URL("../app/api/scan/saved/route.ts", import.meta.url),
  );
  const hook = await Deno.readTextFile(
    new URL("../app/scan/useSavedScanTracking.ts", import.meta.url),
  );
  const section = await Deno.readTextFile(
    new URL("../app/scan/_components/SavedTreksSection.tsx", import.meta.url),
  );
  assert.match(api, /isJalurMode\(item\.scanMode\)[\s\S]*?JALUR_KOLOM/);
  assert.match(hook, /cache: "no-store"/);
  assert.match(hook, /setVerification\(/);
  assert.match(section, /overallSavedScanSyncStatus\(/);
  assert.match(section, /savedTrekSyncStatus\(/);
  assert.match(section, /Sudah Terbaru/);
});
