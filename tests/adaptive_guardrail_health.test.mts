import assert from "node:assert/strict";
import {
  buildAdaptiveGuardrailHealth,
  type GuardrailHealthInput,
} from "../adaptive-service/guardrail-health.mts";

function input(overrides?: Partial<GuardrailHealthInput>): GuardrailHealthInput {
  return {
    marketId: "sgp",
    target2D: "belakang",
    migration: {
      historyFingerprintColumn: true,
      persistGuardrailFunction: true,
      driftEventsTable: true,
    },
    state: {
      driftState: "stable",
      detectorState: {
        sampleCount: 4,
        meanLoss: 0.72,
        ewmaLoss: 0.7,
        pageHinkley: 0.02,
        alertStreak: 0,
        recoveryStreak: 0,
        reason: "warmup",
      },
      historyFingerprint: "abcdef0123456789",
      stateRevision: 8,
      processedHistoryLength: 170,
      updatedAt: "2026-08-04T09:00:00Z",
    },
    settlementCount: 4,
    driftEventCount: 0,
    latestEvent: null,
    ...overrides,
  };
}

Deno.test("health melaporkan migration_required ketika objek schema belum lengkap", () => {
  const health = buildAdaptiveGuardrailHealth(input({
    migration: {
      historyFingerprintColumn: true,
      persistGuardrailFunction: false,
      driftEventsTable: true,
    },
  }));

  assert.equal(health.ok, false);
  assert.equal(health.operational, false);
  assert.equal(health.status, "migration_required");
  assert.equal(health.migration.completedObjects, 2);
  assert.ok(health.issues.includes("persist_guardrail function missing"));
});

Deno.test("health menunggu state ketika migration selesai tetapi engine belum pernah dijalankan", () => {
  const health = buildAdaptiveGuardrailHealth(input({ state: null }));
  assert.equal(health.ok, true);
  assert.equal(health.status, "waiting_for_state");
  assert.equal(health.runtime.stateFound, false);
});

Deno.test("health menunggu run pascamigrasi sebelum fingerprint tersimpan", () => {
  const base = input();
  const health = buildAdaptiveGuardrailHealth(input({
    state: base.state ? { ...base.state, historyFingerprint: null } : null,
  }));

  assert.equal(health.status, "waiting_for_run");
  assert.equal(health.operational, false);
  assert.equal(health.runtime.fingerprintStored, false);
});

Deno.test("health warmup aktif setelah fingerprint tersimpan tetapi sampel belum sepuluh", () => {
  const health = buildAdaptiveGuardrailHealth(input());
  assert.equal(health.status, "warmup");
  assert.equal(health.operational, true);
  assert.equal(health.runtime.detector.sampleCount, 4);
  assert.equal(health.runtime.fingerprintPrefix, "abcdef012345");
});

Deno.test("health active setelah sepuluh settlement dan menormalisasi event terbaru", () => {
  const base = input();
  const health = buildAdaptiveGuardrailHealth(input({
    state: base.state ? {
      ...base.state,
      driftState: "warning",
      detectorState: {
        sampleCount: 12,
        meanLoss: 0.68,
        ewmaLoss: 0.75,
        pageHinkley: 0.14,
        alertStreak: 1,
        recoveryStreak: 0,
        lastLoss: 0.92,
        reason: "ewma-and-page-hinkley",
      },
    } : null,
    settlementCount: 12,
    driftEventCount: 1,
    latestEvent: {
      eventType: "warning",
      previousState: "stable",
      nextState: "warning",
      detectorData: { reason: "ewma", sampleCount: 12 },
      createdAt: "2026-08-04T10:00:00Z",
    },
  }));

  assert.equal(health.status, "active");
  assert.equal(health.runtime.driftState, "warning");
  assert.equal(health.runtime.detector.alertStreak, 1);
  assert.equal(health.runtime.latestEvent?.nextState, "warning");
  assert.equal(health.runtime.latestEvent?.sampleCount, 12);
});
