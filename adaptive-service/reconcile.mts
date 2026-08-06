import { neon } from "jsr:@neon/serverless@1.0.1";
import { runAdaptiveOnline } from "./core/engine.mts";
import {
  ADAPTIVE_CONFIG_VERSION,
  ADAPTIVE_ENGINE_VERSION,
} from "./core/types.mts";
import type {
  AdaptiveLearningState,
  AdaptivePendingPrediction,
} from "./core/types.mts";
import { parseStrictHistory } from "./core/history.mts";
import {
  applyAdaptiveGuardrail,
  historyFingerprint,
  isStoredHistoryCompatible,
  type GuardrailRunPayload,
} from "./guardrail.mts";
import {
  planAdaptiveReconciliation,
  type ReconciliationMarketSnapshot,
  type ReconciliationStateSnapshot,
  type ReconciliationTarget,
} from "./reconcile-plan.mts";

type SqlClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

export type ReconciliationTrigger = "cron" | "manual" | "api";

export interface ReconciliationOptions {
  trigger: ReconciliationTrigger;
  marketLimit?: number;
  requestedMarketId?: string | null;
  force?: boolean;
}

export interface ReconciliationSummary {
  runId: string;
  trigger: ReconciliationTrigger;
  status: "success" | "partial" | "failed";
  marketsAvailable: number;
  marketsPlanned: number;
  marketsProcessed: number;
  targetsProcessed: number;
  fullReplayTargets: number;
  incrementalTargets: number;
  noopTargets: number;
  settledPredictions: number;
  selectionsPublished: number;
  selectionsSettled: number;
  errorCount: number;
  remainingMarkets: number;
  details: Array<Record<string, unknown>>;
  startedAt: string;
  finishedAt: string;
}

interface SupabaseMarketRow {
  id?: unknown;
  name?: unknown;
  history_data?: unknown;
}

interface ParsedMarket extends ReconciliationMarketSnapshot {
  draws: string[];
  historyFingerprint: string;
}

type RollingDetection = "overlap" | "latest-fallback" | null;

const DEFAULT_MARKET_LIMIT = 4;
const MAX_MARKET_LIMIT = 50;
const BACKGROUND_METHOD = "bbfs" as const;
const BACKGROUND_DIGIT_COUNT = 7;

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} belum dikonfigurasi pada adaptive-engine-service.`);
  return value;
}

function marketLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_MARKET_LIMIT;
  return Math.max(1, Math.min(MAX_MARKET_LIMIT, Math.trunc(Number(value))));
}

function databaseClient(): SqlClient {
  return neon(requiredEnv("NEON_DATABASE_URL")) as unknown as SqlClient;
}

function rollingWindowDetection(
  previousDraws: readonly string[],
  currentDraws: readonly string[],
  stateHistoryLength: number,
  stateLastDraw: string | null,
): RollingDetection {
  if (stateHistoryLength !== currentDraws.length || currentDraws.length < 2) return null;

  const comparablePreviousWindow =
    previousDraws.length === currentDraws.length &&
    previousDraws[previousDraws.length - 1] === stateLastDraw;
  if (comparablePreviousWindow) {
    const overlap = previousDraws.slice(1).every((draw, index) => draw === currentDraws[index]);
    return overlap ? "overlap" : null;
  }

  const latestDraw = currentDraws[currentDraws.length - 1];
  return stateLastDraw !== latestDraw ? "latest-fallback" : null;
}

async function fetchSupabaseMarkets(): Promise<{ markets: ParsedMarket[]; errors: Array<Record<string, unknown>> }> {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const endpoint = new URL("/rest/v1/markets", supabaseUrl);
  endpoint.searchParams.set("select", "id,name,history_data");
  endpoint.searchParams.set("order", "order.asc");

  const response = await fetch(endpoint, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Supabase markets gagal (${response.status}): ${message.slice(0, 240)}`);
  }

  const rows = await response.json() as SupabaseMarketRow[];
  const markets: ParsedMarket[] = [];
  const errors: Array<Record<string, unknown>> = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const id = String(row.id ?? "").trim();
    const name = String(row.name ?? id).trim();
    const historyData = typeof row.history_data === "string" ? row.history_data : "";
    if (!id || !historyData) continue;

    try {
      const draws = parseStrictHistory(historyData);
      if (draws.length < 2) continue;
      markets.push({
        id,
        name,
        historyLength: draws.length,
        lastDraw: draws[draws.length - 1],
        historyFingerprint: await historyFingerprint(draws),
        draws,
      });
    } catch (error) {
      errors.push({
        marketId: id,
        marketName: name,
        stage: "parse-history",
        error: error instanceof Error ? error.message : "Histori tidak valid.",
      });
    }
  }

  return { markets, errors };
}

async function fetchStateSnapshots(sql: SqlClient): Promise<ReconciliationStateSnapshot[]> {
  const rows = await sql`
    select
      s.market_id,
      s.target_2d,
      s.processed_history_length,
      s.last_processed_draw,
      s.updated_at,
      to_jsonb(s)->>'history_fingerprint' as history_fingerprint,
      pending.history_length as pending_history_length,
      pending.oldest_history_length as oldest_pending_history_length,
      pending.pending_count,
      pending.selection_count as pending_selection_count,
      pending.snapshot_complete as pending_snapshot_complete
    from adaptive.engine_states s
    left join lateral (
      select
        p.history_length,
        (min(p.history_length) over ())::integer as oldest_history_length,
        (count(*) over ())::integer as pending_count,
        count(ps.id)::integer as selection_count,
        coalesce(
          (to_jsonb(p)->>'snapshot_complete')::boolean,
          count(ps.id) = 18
        ) as snapshot_complete
      from adaptive.predictions p
      left join adaptive.published_selections ps
        on ps.prediction_id = p.id
      where p.market_id = s.market_id
        and p.target_2d = s.target_2d
        and p.engine_version = s.engine_version
        and p.config_version = s.config_version
        and p.status = 'pending'
      group by p.id
      order by p.history_length desc, p.created_at desc
      limit 1
    ) pending on true
    where s.engine_version = ${ADAPTIVE_ENGINE_VERSION}
      and s.config_version = ${ADAPTIVE_CONFIG_VERSION}
  `;

  return rows.flatMap((row: Record<string, unknown>) => {
    const target2D = String(row.target_2d);
    if (target2D !== "depan" && target2D !== "tengah" && target2D !== "belakang") return [];
    return [{
      marketId: String(row.market_id),
      target2D,
      processedHistoryLength: Number(row.processed_history_length ?? 0),
      lastProcessedDraw: row.last_processed_draw ? String(row.last_processed_draw) : null,
      historyFingerprint: row.history_fingerprint ? String(row.history_fingerprint) : null,
      pendingHistoryLength: row.pending_history_length === null || row.pending_history_length === undefined
        ? null
        : Number(row.pending_history_length),
      oldestPendingHistoryLength:
        row.oldest_pending_history_length === null || row.oldest_pending_history_length === undefined
          ? null
          : Number(row.oldest_pending_history_length),
      pendingCount: row.pending_count === null || row.pending_count === undefined
        ? 0
        : Number(row.pending_count),
      pendingSelectionCount: row.pending_selection_count === null || row.pending_selection_count === undefined
        ? null
        : Number(row.pending_selection_count),
      pendingSnapshotComplete: row.pending_snapshot_complete === true || row.pending_snapshot_complete === "true",
      updatedAt: row.updated_at ? String(row.updated_at) : null,
    } satisfies ReconciliationStateSnapshot];
  });
}

async function loadStoredHistoryWindow(sql: SqlClient, marketId: string): Promise<string[]> {
  const rows = await sql`
    select
      result_4d,
      source_sequence
    from adaptive.result_snapshots
    where market_id = ${marketId}
      and draw_key = 'seq:' || source_sequence::text
    order by source_sequence asc
  `;

  const draws: string[] = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const sequence = Number(row.source_sequence);
    const draw = String(row.result_4d ?? "");
    if (sequence !== index + 1 || !/^\d{4}$/.test(draw)) return [];
    draws.push(draw);
  }
  return draws;
}

async function loadContext(
  sql: SqlClient,
  marketId: string,
  target2D: ReconciliationTarget,
  draws: readonly string[],
  previousDraws: readonly string[],
): Promise<{
  state: AdaptiveLearningState | null;
  pendingPrediction: AdaptivePendingPrediction | null;
  pendingHistoryLength: number | null;
  correctionDetected: boolean;
  rollingWindowAdvance: boolean;
  rollingDetection: RollingDetection;
  expectedStateRevision: number | null;
  expectedHistoryFingerprint: string | null;
}> {
  const stateRows = await sql`
    select
      target_2d,
      engine_version,
      config_version,
      processed_history_length,
      last_processed_draw,
      expert_weights,
      family_weights,
      horizon_weights,
      state_revision,
      to_jsonb(s)->>'history_fingerprint' as history_fingerprint
    from adaptive.engine_states s
    where market_id = ${marketId}
      and target_2d = ${target2D}
      and engine_version = ${ADAPTIVE_ENGINE_VERSION}
      and config_version = ${ADAPTIVE_CONFIG_VERSION}
    limit 1
  `;

  const pendingRows = await sql`
    select
      p.id::text as prediction_id,
      p.engine_version,
      p.config_version,
      p.target_2d,
      p.history_length,
      p.pair_probabilities,
      p.left_probabilities,
      p.right_probabilities,
      p.expert_weights,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'method', s.method,
            'digitCount', s.digit_count,
            'digits', to_jsonb(s.digits),
            'estimatedSuccess', s.estimated_success,
            'baselineSuccess', s.baseline_success,
            'lift', s.lift,
            'selectionMargin', s.selection_margin
          )
          order by s.method, s.digit_count
        )
        from adaptive.published_selections s
        where s.prediction_id = p.id
      ), '[]'::jsonb) as selections
    from adaptive.predictions p
    where p.market_id = ${marketId}
      and p.target_2d = ${target2D}
      and p.engine_version = ${ADAPTIVE_ENGINE_VERSION}
      and p.config_version = ${ADAPTIVE_CONFIG_VERSION}
      and p.status = 'pending'
    order by
      (p.history_length < ${draws.length}) desc,
      case when p.history_length < ${draws.length} then p.history_length end asc,
      p.history_length desc,
      p.created_at desc
    limit 1
  `;

  const stateRow = stateRows[0];
  const pendingRow = pendingRows[0];
  const rollingDetection = stateRow
    ? rollingWindowDetection(
      previousDraws,
      draws,
      Number(stateRow.processed_history_length),
      stateRow.last_processed_draw ? String(stateRow.last_processed_draw) : null,
    )
    : null;
  const rollingWindowAdvance = rollingDetection !== null;
  const compatibility = stateRow
    ? rollingWindowAdvance
      ? { compatible: true, correctionDetected: false, currentFingerprint: null }
      : await isStoredHistoryCompatible({
        draws,
        processedHistoryLength: Number(stateRow.processed_history_length),
        lastProcessedDraw: stateRow.last_processed_draw ? String(stateRow.last_processed_draw) : null,
        storedFingerprint: stateRow.history_fingerprint ? String(stateRow.history_fingerprint) : null,
      })
    : { compatible: false, correctionDetected: false, currentFingerprint: null };
  const useStoredContext = Boolean(stateRow && compatibility.compatible);

  return {
    correctionDetected: rollingWindowAdvance ? false : compatibility.correctionDetected,
    rollingWindowAdvance,
    rollingDetection,
    expectedStateRevision: stateRow ? Number(stateRow.state_revision ?? 0) : null,
    expectedHistoryFingerprint: stateRow?.history_fingerprint
      ? String(stateRow.history_fingerprint)
      : null,
    pendingHistoryLength: pendingRow ? Number(pendingRow.history_length) : null,
    state: useStoredContext && stateRow ? {
      engineVersion: String(stateRow.engine_version),
      configVersion: String(stateRow.config_version),
      target2D,
      processedHistoryLength: Number(stateRow.processed_history_length),
      lastProcessedDraw: stateRow.last_processed_draw ? String(stateRow.last_processed_draw) : null,
      expertWeights: (stateRow.expert_weights ?? {}) as Record<string, number>,
      familyWeights: (stateRow.family_weights ?? {}) as Record<string, number>,
      horizonWeights: (stateRow.horizon_weights ?? {}) as Record<string, number>,
      stateRevision: Number(stateRow.state_revision ?? 0),
    } : null,
    pendingPrediction: useStoredContext && pendingRow ? {
      predictionId: String(pendingRow.prediction_id),
      engineVersion: String(pendingRow.engine_version),
      configVersion: String(pendingRow.config_version),
      target2D,
      historyLength: Number(pendingRow.history_length),
      pairProbabilities: pendingRow.pair_probabilities as number[],
      leftProbabilities: pendingRow.left_probabilities as number[],
      rightProbabilities: pendingRow.right_probabilities as number[],
      expertWeights: (pendingRow.expert_weights ?? {}) as Record<string, number>,
      selections: (pendingRow.selections ?? []) as AdaptivePendingPrediction["selections"],
    } : null,
  };
}

async function createRunRow(
  sql: SqlClient,
  options: Required<Pick<ReconciliationOptions, "trigger">> & ReconciliationOptions,
  startedAt: string,
): Promise<string> {
  const rows = await sql`
    insert into adaptive.reconciliation_runs (
      trigger,
      status,
      requested_market_id,
      market_limit,
      started_at
    ) values (
      ${options.trigger},
      'running',
      ${options.requestedMarketId?.trim() || null},
      ${marketLimit(options.marketLimit)},
      ${startedAt}::timestamptz
    )
    returning id::text
  `;
  return String(rows[0]?.id ?? "");
}

async function finishRunRow(sql: SqlClient, summary: ReconciliationSummary): Promise<void> {
  await sql`
    update adaptive.reconciliation_runs
    set
      status = ${summary.status},
      markets_available = ${summary.marketsAvailable},
      markets_planned = ${summary.marketsPlanned},
      markets_processed = ${summary.marketsProcessed},
      targets_processed = ${summary.targetsProcessed},
      full_replay_targets = ${summary.fullReplayTargets},
      incremental_targets = ${summary.incrementalTargets},
      noop_targets = ${summary.noopTargets},
      settled_predictions = ${summary.settledPredictions},
      selections_published = ${summary.selectionsPublished},
      selections_settled = ${summary.selectionsSettled},
      error_count = ${summary.errorCount},
      remaining_markets = ${summary.remainingMarkets},
      details = ${JSON.stringify(summary.details)}::jsonb,
      finished_at = ${summary.finishedAt}::timestamptz
    where id = ${summary.runId}::uuid
  `;
}

export async function latestReconciliationRun(): Promise<Record<string, unknown> | null> {
  const sql = databaseClient();
  const rows = await sql`
    select
      id::text,
      trigger,
      status,
      requested_market_id,
      market_limit,
      markets_available,
      markets_planned,
      markets_processed,
      targets_processed,
      full_replay_targets,
      incremental_targets,
      noop_targets,
      settled_predictions,
      selections_published,
      selections_settled,
      error_count,
      remaining_markets,
      details,
      started_at,
      finished_at
    from adaptive.reconciliation_runs
    order by started_at desc
    limit 1
  `;
  return rows[0] ?? null;
}

export async function runAdaptiveReconciliation(
  options: ReconciliationOptions,
): Promise<ReconciliationSummary> {
  const sql = databaseClient();
  const startedAt = new Date().toISOString();
  let runId = "";

  try {
    runId = await createRunRow(sql, options, startedAt);
    if (!runId) throw new Error("Neon tidak mengembalikan reconciliation run id.");

    const [{ markets, errors: parseErrors }, states] = await Promise.all([
      fetchSupabaseMarkets(),
      fetchStateSnapshots(sql),
    ]);
    const plans = planAdaptiveReconciliation(markets, states, {
      marketLimit: marketLimit(options.marketLimit),
      requestedMarketId: options.requestedMarketId,
      force: Boolean(options.force),
    });
    const marketMap = new Map(markets.map((market) => [market.id, market]));
    const details: Array<Record<string, unknown>> = [...parseErrors];
    let marketsProcessed = 0;
    let targetsProcessed = 0;
    let fullReplayTargets = 0;
    let incrementalTargets = 0;
    let noopTargets = 0;
    let settledPredictions = 0;
    let selectionsPublished = 0;
    let selectionsSettled = 0;

    for (const plan of plans) {
      const market = marketMap.get(plan.marketId);
      if (!market) continue;
      let marketSucceeded = false;
      let previousDraws: string[] = [];
      try {
        previousDraws = await loadStoredHistoryWindow(sql, market.id);
      } catch (error) {
        details.push({
          marketId: market.id,
          marketName: market.name,
          stage: "load-stored-history",
          warning: error instanceof Error ? error.message : "Window histori tersimpan tidak dapat dibaca.",
        });
      }

      for (const target2D of plan.targets) {
        try {
          const context = await loadContext(
            sql,
            market.id,
            target2D,
            market.draws,
            previousDraws,
          );
          const run = runAdaptiveOnline(
            market.draws,
            target2D,
            BACKGROUND_METHOD,
            BACKGROUND_DIGIT_COUNT,
            context.state,
            context.pendingPrediction,
            { rollingWindowAdvance: context.rollingWindowAdvance },
          );
          const payload = {
            marketId: market.id,
            marketName: market.name,
            targetDrawKey: `next:${run.prediction.historyCutoffKey}`,
            expectedStateRevision: context.expectedStateRevision,
            expectedHistoryFingerprint: context.expectedHistoryFingerprint,
            rollingWindowAdvance: context.rollingWindowAdvance,
            prediction: run.prediction,
            state: run.state,
            settlement: run.settlement,
            historyDraws: run.historyDraws,
          };
          const storeRows = await sql`
            select adaptive.store_online_run(${JSON.stringify(payload)}::jsonb) as result
          `;
          const storeResult = storeRows[0]?.result;
          if (!storeResult || typeof storeResult !== "object") {
            throw new Error("Neon tidak mengembalikan hasil full publication.");
          }
          const stored = storeResult as Record<string, unknown>;
          const publishedCount = Number(stored.selectionsPublished ?? 0);
          const settledCount = Number(stored.selectionsSettled ?? 0);
          if (publishedCount !== 18 || stored.snapshotComplete !== true) {
            throw new Error("Migration 005 belum aktif: snapshot Adaptive belum lengkap 18 selection.");
          }
          if (run.settlement && settledCount !== 18) {
            throw new Error("Settlement Adaptive tidak menghasilkan 18 evaluasi selection.");
          }

          const guardrailPayload: GuardrailRunPayload = {
            marketId: payload.marketId,
            targetDrawKey: payload.targetDrawKey,
            prediction: {
              target2D: run.prediction.target2D,
              engineVersion: run.prediction.engineVersion,
              configVersion: run.prediction.configVersion,
            },
            settlement: run.settlement
              ? {
                predictionId: run.settlement.predictionId,
                combinedLoss: run.settlement.combinedLoss,
              }
              : null,
            historyDraws: run.historyDraws,
          };
          const guardrail = await applyAdaptiveGuardrail(sql, guardrailPayload);

          targetsProcessed += 1;
          selectionsPublished += publishedCount;
          selectionsSettled += settledCount;
          marketSucceeded = true;
          if (run.prediction.replay.mode === "full") fullReplayTargets += 1;
          else if (run.prediction.replay.mode === "incremental") incrementalTargets += 1;
          else noopTargets += 1;
          if (run.settlement) settledPredictions += 1;
          details.push({
            marketId: market.id,
            marketName: market.name,
            target2D,
            replayMode: run.prediction.replay.mode,
            processedSteps: run.prediction.replay.processedSteps,
            settled: Boolean(run.settlement),
            rollingWindowAdvance: context.rollingWindowAdvance,
            rollingDetection: context.rollingDetection,
            rollingOverlapValidated: stored.rollingOverlapValidated === true,
            rollingFallbackUsed: stored.rollingFallbackUsed === true,
            settlementCandidateHistoryLength: context.pendingHistoryLength,
            currentHistoryLength: market.draws.length,
            selectionsPublished: publishedCount,
            selectionsSettled: settledCount,
            snapshotComplete: stored.snapshotComplete === true,
            historyCorrectionDetected: context.correctionDetected,
            optimisticConcurrencyChecked: stored.optimisticConcurrencyChecked === true,
            guardrailStatus: guardrail.status,
            driftState: guardrail.nextState,
            driftEvent: guardrail.eventType,
          });
        } catch (error) {
          details.push({
            marketId: market.id,
            marketName: market.name,
            target2D,
            stage: "reconcile-target",
            error: error instanceof Error ? error.message : "Reconciliation target gagal.",
          });
        }
      }

      if (marketSucceeded) marketsProcessed += 1;
    }

    const errorCount = details.filter((detail) => "error" in detail).length;
    const remainingMarkets = planAdaptiveReconciliation(
      markets,
      await fetchStateSnapshots(sql),
      {
        marketLimit: MAX_MARKET_LIMIT,
        requestedMarketId: options.requestedMarketId,
        force: false,
      },
    ).length;
    const finishedAt = new Date().toISOString();
    const summary: ReconciliationSummary = {
      runId,
      trigger: options.trigger,
      status: errorCount === 0 ? "success" : targetsProcessed > 0 ? "partial" : "failed",
      marketsAvailable: markets.length,
      marketsPlanned: plans.length,
      marketsProcessed,
      targetsProcessed,
      fullReplayTargets,
      incrementalTargets,
      noopTargets,
      settledPredictions,
      selectionsPublished,
      selectionsSettled,
      errorCount,
      remainingMarkets,
      details,
      startedAt,
      finishedAt,
    };
    await finishRunRow(sql, summary);
    return summary;
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "Reconciliation gagal.";
    if (runId) {
      const failed: ReconciliationSummary = {
        runId,
        trigger: options.trigger,
        status: "failed",
        marketsAvailable: 0,
        marketsPlanned: 0,
        marketsProcessed: 0,
        targetsProcessed: 0,
        fullReplayTargets: 0,
        incrementalTargets: 0,
        noopTargets: 0,
        settledPredictions: 0,
        selectionsPublished: 0,
        selectionsSettled: 0,
        errorCount: 1,
        remainingMarkets: 0,
        details: [{ stage: "reconciliation", error: message }],
        startedAt,
        finishedAt,
      };
      await finishRunRow(sql, failed).catch(() => undefined);
    }
    throw error;
  }
}
