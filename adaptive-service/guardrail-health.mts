import { neon } from "jsr:@neon/serverless@1.0.1";
import {
  ADAPTIVE_CONFIG_VERSION,
  ADAPTIVE_ENGINE_VERSION,
} from "./core/types.mts";
import {
  buildAdaptiveGuardrailHealth,
  type GuardrailHealthInput,
  type GuardrailHealthTarget,
} from "./guardrail-health-analytics.mts";

export {
  buildAdaptiveGuardrailHealth,
  type GuardrailHealthInput,
  type GuardrailHealthTarget,
  type GuardrailOperationalStatus,
} from "./guardrail-health-analytics.mts";

export interface GuardrailHealthRequest {
  marketId: string;
  target2D: GuardrailHealthTarget;
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

function finite(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nonNegativeInteger(value: unknown): number {
  return Math.max(0, Math.trunc(finite(value)));
}

function booleanValue(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
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
        (array_agg(event.event_type order by event.created_at desc))[1] as event_type,
        (array_agg(event.previous_state order by event.created_at desc))[1] as previous_state,
        (array_agg(event.next_state order by event.created_at desc))[1] as next_state,
        (array_agg(event.detector_data order by event.created_at desc))[1] as detector_data,
        max(event.created_at) as created_at
      from adaptive.drift_events event
      join adaptive.predictions prediction
        on prediction.id = event.prediction_id
      where event.market_id = ${request.marketId}
        and event.target_2d = ${request.target2D}
        and prediction.engine_version = ${ADAPTIVE_ENGINE_VERSION}
        and prediction.config_version = ${ADAPTIVE_CONFIG_VERSION}
    `,
  ]);

  const schemaRow = schemaRows[0] ?? {};
  const stateRow = stateRows[0] ?? null;
  const eventRow = eventRows[0] ?? {};
  const eventCount = nonNegativeInteger(eventRow.event_count);
  const input: GuardrailHealthInput = {
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
  };

  return buildAdaptiveGuardrailHealth(input);
}
