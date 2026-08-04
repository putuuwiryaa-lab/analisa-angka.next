import {
  ADAPTIVE_CONFIG_VERSION,
  ADAPTIVE_ENGINE_VERSION,
} from "./core/types.mts";

export type GuardrailHealthTarget = "depan" | "tengah" | "belakang";
export type GuardrailOperationalStatus =
  | "migration_required"
  | "waiting_for_state"
  | "waiting_for_run"
  | "warmup"
  | "active";

export interface GuardrailHealthInput {
  marketId: string;
  target2D: GuardrailHealthTarget;
  migration: {
    historyFingerprintColumn: boolean;
    persistGuardrailFunction: boolean;
    driftEventsTable: boolean;
  };
  state: null | {
    driftState: unknown;
    detectorState: unknown;
    historyFingerprint: unknown;
    stateRevision: unknown;
    processedHistoryLength: unknown;
    updatedAt: unknown;
  };
  settlementCount: unknown;
  driftEventCount: unknown;
  latestEvent: null | {
    eventType: unknown;
    previousState: unknown;
    nextState: unknown;
    detectorData: unknown;
    createdAt: unknown;
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function finite(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nonNegativeInteger(value: unknown): number {
  return Math.max(0, Math.trunc(finite(value)));
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function driftState(value: unknown): "stable" | "warning" | "drift" | "recovery" {
  return value === "warning" || value === "drift" || value === "recovery"
    ? value
    : "stable";
}

export function buildAdaptiveGuardrailHealth(input: GuardrailHealthInput) {
  const schemaReady = input.migration.historyFingerprintColumn &&
    input.migration.persistGuardrailFunction &&
    input.migration.driftEventsTable;
  const stateFound = Boolean(input.state);
  const detector = objectValue(input.state?.detectorState);
  const fingerprint = optionalText(input.state?.historyFingerprint);
  const fingerprintStored = Boolean(fingerprint);
  const sampleCount = nonNegativeInteger(detector.sampleCount);

  let status: GuardrailOperationalStatus;
  if (!schemaReady) status = "migration_required";
  else if (!stateFound) status = "waiting_for_state";
  else if (!fingerprintStored) status = "waiting_for_run";
  else if (sampleCount < 10) status = "warmup";
  else status = "active";

  const issues: string[] = [];
  if (!input.migration.historyFingerprintColumn) issues.push("history_fingerprint column missing");
  if (!input.migration.persistGuardrailFunction) issues.push("persist_guardrail function missing");
  if (!input.migration.driftEventsTable) issues.push("drift_events table missing");
  if (schemaReady && !stateFound) issues.push("engine state not initialized");
  if (schemaReady && stateFound && !fingerprintStored) issues.push("waiting for first post-migration run");
  if (schemaReady && fingerprintStored && sampleCount < 10) issues.push("detector warmup below 10 settlements");

  const latestEventData = objectValue(input.latestEvent?.detectorData);
  const latestEvent = input.latestEvent ? {
    eventType: driftState(input.latestEvent.eventType),
    previousState: driftState(input.latestEvent.previousState),
    nextState: driftState(input.latestEvent.nextState),
    reason: optionalText(latestEventData.reason),
    sampleCount: nonNegativeInteger(latestEventData.sampleCount),
    createdAt: optionalText(input.latestEvent.createdAt),
  } : null;

  return {
    ok: schemaReady,
    operational: status === "warmup" || status === "active",
    status,
    mode: "observe-only" as const,
    detectorVersion: "ewma-ph-v1" as const,
    scope: {
      marketId: input.marketId,
      target2D: input.target2D,
      engineVersion: ADAPTIVE_ENGINE_VERSION,
      configVersion: ADAPTIVE_CONFIG_VERSION,
    },
    migration: {
      ...input.migration,
      ready: schemaReady,
      completedObjects: [
        input.migration.historyFingerprintColumn,
        input.migration.persistGuardrailFunction,
        input.migration.driftEventsTable,
      ].filter(Boolean).length,
      requiredObjects: 3,
    },
    runtime: {
      stateFound,
      fingerprintStored,
      fingerprintPrefix: fingerprint?.slice(0, 12) ?? null,
      driftState: driftState(input.state?.driftState),
      stateRevision: nonNegativeInteger(input.state?.stateRevision),
      processedHistoryLength: nonNegativeInteger(input.state?.processedHistoryLength),
      settlementCount: nonNegativeInteger(input.settlementCount),
      driftEventCount: nonNegativeInteger(input.driftEventCount),
      updatedAt: optionalText(input.state?.updatedAt),
      detector: {
        sampleCount,
        meanLoss: finite(detector.meanLoss),
        ewmaLoss: finite(detector.ewmaLoss),
        pageHinkley: Math.max(0, finite(detector.pageHinkley)),
        alertStreak: nonNegativeInteger(detector.alertStreak),
        recoveryStreak: nonNegativeInteger(detector.recoveryStreak),
        lastLoss: detector.lastLoss === null || detector.lastLoss === undefined
          ? null
          : finite(detector.lastLoss),
        reason: optionalText(detector.reason) ?? (stateFound ? "uninitialized" : "no-state"),
        updatedAt: optionalText(detector.updatedAt),
      },
      latestEvent,
    },
    issues,
  };
}
