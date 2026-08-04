import { neon } from "jsr:@neon/serverless@1.0.1";
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

export interface GuardrailHealthRequest {
  marketId: string;
  target2D: GuardrailHealthTarget;
}

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

type SqlClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} belum dikonfigurasi pada adaptive-engine-service.`);
  return value;
}

function databaseClient(): SqlClient {
  return neon(requiredEnv("NEON_DATABASE_URL")) as unknown as SqlClient;
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

function booleanValue(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
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

export async function loadAdaptiveGuardrailHealth(
  request: GuardrailHealthRequest,
) {
  const sql = databaseClient();

  const [schemaRows, stateRows, settlementRows, eventRows] = await Promise.all([
    sql`
      select
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'adaptive'
            and table_name = 'engine_states'
            and column_name = 'history_fingerprint'
        ) as history_fingerprint_column,
        to_regprocedure('adaptive.persist_guardrail(jsonb)') is not null
          as persist_guardrail_function,
        to_regclass('adaptive.drift_events') is not null
          as drift_events_table
    `,
    sql`
      select
        drift_state,
        detector_state,
        to_jsonb(s)->>'history_fingerprint' as history_fingerprint,
        state_revision,
        processed_history_length,
        updated_at
      from adaptive.engine_states s
      where market_id = ${request.marketId}
        and target_2d = ${request.target2D}
        and engine_version = ${ADAPTIVE_ENGINE_VERSION}
        and config_version = ${ADAPTIVE_CONFIG_VERSION}
      limit 1
    `,
    sql`
      select count(*)::integer as settlement_count
      from adaptive.evaluations e
      join adaptive.predictions p
        on p.id = e.prediction_id
      where p.market_id = ${request.marketId}
        and p.target_2d = ${request.target2D}
        and p.engine_version = ${ADAPTIVE_ENGINE_VERSION}
        and p.config_version = ${ADAPTIVE_CONFIG_VERSION}
    `,
    sql`
      select
        count(*)::integer as event_count,
        (array_agg(event_type order by created_at desc))[1] as event_type,
        (array_agg(previous_state order by created_at desc))[1] as previous_state,
        (array_agg(next_state order by created_at desc))[1] as next_state,
        (array_agg(detector_data order by created_at desc))[1] as detector_data,
        max(created_at) as created_at
      from adaptive.drift_events
      where market_id = ${request.marketId}
        and target_2d = ${request.target2D}
    `,
  ]);

  const schemaRow = schemaRows[0] ?? {};
  const stateRow = stateRows[0] ?? null;
  const eventRow = eventRows[0] ?? {};
  const eventCount = nonNegativeInteger(eventRow.event_count);

  return buildAdaptiveGuardrailHealth({
    marketId: request.marketId,
    target2D: request.target2D,
    migration: {
      historyFingerprintColumn: booleanValue(schemaRow.history_fingerprint_column),
      persistGuardrailFunction: booleanValue(schemaRow.persist_guardrail_function),
      driftEventsTable: booleanValue(schemaRow.drift_events_table),
    },
    state: stateRow ? {
      driftState: stateRow.drift_state,
      detectorState: stateRow.detector_state,
      historyFingerprint: stateRow.history_fingerprint,
      stateRevision: stateRow.state_revision,
      processedHistoryLength: stateRow.processed_history_length,
      updatedAt: stateRow.updated_at,
    } : null,
    settlementCount: settlementRows[0]?.settlement_count,
    driftEventCount: eventCount,
    latestEvent: eventCount > 0 ? {
      eventType: eventRow.event_type,
      previousState: eventRow.previous_state,
      nextState: eventRow.next_state,
      detectorData: eventRow.detector_data,
      createdAt: eventRow.created_at,
    } : null,
  });
}
