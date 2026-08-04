import { neon } from "jsr:@neon/serverless@1.0.1";
import {
  buildAdaptiveEvaluationDashboard,
  type EvaluationMethod,
  type EvaluationRow,
  type EvaluationSelectionSample,
  type EvaluationStateSnapshot,
  type EvaluationTarget,
} from "./evaluation-analytics.mts";
import {
  ADAPTIVE_CONFIG_VERSION,
  ADAPTIVE_ENGINE_VERSION,
} from "./core/types.ts";

type SqlClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

export interface EvaluationDashboardRequest {
  marketId: string;
  target2D: EvaluationTarget;
  method: EvaluationMethod;
  digitCount: number;
  window?: number;
}

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

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function numberRecord(value: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(objectValue(value))
      .map(([key, raw]) => [key, finite(raw, Number.NaN)] as const)
      .filter(([, number]) => Number.isFinite(number)),
  );
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeSelections(value: unknown): EvaluationSelectionSample[] {
  return arrayValue(value).flatMap((item) => {
    const row = objectValue(item);
    const method = row.method;
    const digitCount = finite(row.digitCount, 0);
    if ((method !== "ai" && method !== "bbfs") || digitCount < 1 || digitCount > 9) return [];
    return [{
      method,
      digitCount,
      estimatedSuccess: finite(row.estimatedSuccess),
      baselineSuccess: finite(row.baselineSuccess),
      lift: finite(row.lift),
      hit: row.hit === true || row.hit === "true",
    } satisfies EvaluationSelectionSample];
  });
}

function normalizeEvaluation(row: Record<string, unknown>): EvaluationRow {
  return {
    predictionId: String(row.prediction_id ?? ""),
    actualPair: finite(row.actual_pair),
    pairBrier: finite(row.pair_brier),
    leftBrier: finite(row.left_brier),
    rightBrier: finite(row.right_brier),
    combinedLoss: finite(row.combined_loss),
    expertLosses: numberRecord(row.expert_losses),
    weightsBefore: numberRecord(row.weights_before),
    weightsAfter: numberRecord(row.weights_after),
    createdAt: String(row.created_at ?? ""),
    selections: normalizeSelections(row.selections),
  };
}

export async function loadAdaptiveEvaluationDashboard(
  request: EvaluationDashboardRequest,
) {
  const sql = databaseClient();
  const window = Math.max(10, Math.min(200, Math.trunc(request.window ?? 100)));

  const [evaluationRows, stateRows, pendingRows] = await Promise.all([
    sql`
      select
        p.id::text as prediction_id,
        e.actual_pair,
        e.pair_brier,
        e.left_brier,
        e.right_brier,
        e.combined_loss,
        e.expert_losses,
        e.weights_before,
        e.weights_after,
        e.created_at,
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'method', s.method,
              'digitCount', s.digit_count,
              'estimatedSuccess', s.estimated_success,
              'baselineSuccess', s.baseline_success,
              'lift', s.lift,
              'hit', case
                when s.method = 'ai'
                  then coalesce((e.ai_results ->> s.digit_count::text)::boolean, false)
                else coalesce((e.bbfs_results ->> s.digit_count::text)::boolean, false)
              end
            )
            order by s.method, s.digit_count
          )
          from adaptive.published_selections s
          where s.prediction_id = p.id
        ), '[]'::jsonb) as selections
      from adaptive.evaluations e
      join adaptive.predictions p
        on p.id = e.prediction_id
      where p.market_id = ${request.marketId}
        and p.target_2d = ${request.target2D}
        and p.engine_version = ${ADAPTIVE_ENGINE_VERSION}
        and p.config_version = ${ADAPTIVE_CONFIG_VERSION}
      order by e.created_at desc
      limit ${window}
    `,
    sql`
      select
        state_revision,
        processed_history_length,
        replay_count,
        drift_state,
        expert_weights,
        family_weights,
        horizon_weights,
        updated_at
      from adaptive.engine_states
      where market_id = ${request.marketId}
        and target_2d = ${request.target2D}
        and engine_version = ${ADAPTIVE_ENGINE_VERSION}
        and config_version = ${ADAPTIVE_CONFIG_VERSION}
      limit 1
    `,
    sql`
      select count(*)::integer as pending_count
      from adaptive.predictions
      where market_id = ${request.marketId}
        and target_2d = ${request.target2D}
        and engine_version = ${ADAPTIVE_ENGINE_VERSION}
        and config_version = ${ADAPTIVE_CONFIG_VERSION}
        and status = 'pending'
    `,
  ]);

  const stateRow = stateRows[0];
  const driftState = String(stateRow?.drift_state ?? "stable");
  const state: EvaluationStateSnapshot | null = stateRow ? {
    stateRevision: finite(stateRow.state_revision),
    processedHistoryLength: finite(stateRow.processed_history_length),
    replayCount: finite(stateRow.replay_count),
    driftState: driftState === "warning" || driftState === "drift" || driftState === "recovery"
      ? driftState
      : "stable",
    expertWeights: numberRecord(stateRow.expert_weights),
    familyWeights: numberRecord(stateRow.family_weights),
    horizonWeights: numberRecord(stateRow.horizon_weights),
    updatedAt: stateRow.updated_at ? String(stateRow.updated_at) : null,
  } : null;

  return buildAdaptiveEvaluationDashboard(
    evaluationRows.map(normalizeEvaluation),
    {
      marketId: request.marketId,
      target2D: request.target2D,
      method: request.method,
      digitCount: request.digitCount,
      window,
      pendingPredictions: finite(pendingRows[0]?.pending_count),
      state,
    },
  );
}
