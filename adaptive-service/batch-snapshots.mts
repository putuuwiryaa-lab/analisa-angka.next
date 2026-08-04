import { rankDigitSelections } from "./core/optimizer.mts";
import {
  ADAPTIVE_CONFIG_VERSION,
  ADAPTIVE_ENGINE_VERSION,
  type AdaptiveSelection,
} from "./core/types.mts";

export type AdaptiveBatchSqlClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

export type AdaptiveBatchTarget = "depan" | "tengah" | "belakang";
export type AdaptiveBatchSnapshotStatus = "fresh" | "stale" | "missing";

export interface AdaptiveBatchSnapshotRequest {
  marketIds: string[];
  target2D: AdaptiveBatchTarget;
  digitCount: number;
  topRanks: number[];
  latestResults?: Record<string, string>;
}

export interface AdaptiveBatchSnapshotSelection {
  rank: number;
  digits: number[];
  estimatedSuccess: number;
  baselineSuccess: number;
  lift: number;
  selectionMargin: number;
}

export interface AdaptiveBatchSnapshotResult {
  marketId: string;
  marketName: string;
  status: AdaptiveBatchSnapshotStatus;
  latestDraw: string | null;
  expectedLatestDraw: string | null;
  signalStrength: "low" | "medium" | "high" | null;
  driftState: "stable" | "warning" | "drift" | "recovery" | null;
  stateRevision: number | null;
  selections: AdaptiveBatchSnapshotSelection[];
}

const MAX_BATCH_MARKETS = 35;
const VALID_TARGETS = new Set<AdaptiveBatchTarget>(["depan", "tengah", "belakang"]);
const VALID_RANKS = new Set([1, 2, 3]);

function normalizeMarketIds(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function normalizeTopRanks(values: readonly number[]): number[] {
  const normalized = [...new Set(values.map(Number))]
    .filter((rank) => Number.isInteger(rank) && VALID_RANKS.has(rank))
    .sort((a, b) => a - b);
  return normalized.length ? normalized : [1];
}

function normalizeLatestResults(value: Record<string, string> | undefined): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [marketId, result] of Object.entries(value ?? {})) {
    const normalizedId = marketId.trim();
    const normalizedResult = String(result).trim();
    if (normalizedId && /^\d{4}$/.test(normalizedResult)) {
      output[normalizedId] = normalizedResult;
    }
  }
  return output;
}

export function validateAdaptiveBatchSnapshotRequest(
  request: AdaptiveBatchSnapshotRequest,
): string | null {
  const marketIds = normalizeMarketIds(request.marketIds);
  if (!marketIds.length) return "Pilih minimal 1 pasaran.";
  if (marketIds.length > MAX_BATCH_MARKETS) {
    return `Maksimal ${MAX_BATCH_MARKETS} pasaran.`;
  }
  if (!VALID_TARGETS.has(request.target2D)) return "Target Adaptive tidak valid.";
  if (!Number.isInteger(request.digitCount) || request.digitCount < 1 || request.digitCount > 9) {
    return "Jumlah digit Adaptive harus antara 1 dan 9.";
  }
  if (!normalizeTopRanks(request.topRanks).length) return "Peringkat Adaptive tidak valid.";
  return null;
}

function asProbabilityMatrix(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length !== 100) return null;
  const matrix = value.map(Number);
  return matrix.every(Number.isFinite) ? matrix : null;
}

function asSignalStrength(value: unknown): AdaptiveBatchSnapshotResult["signalStrength"] {
  return value === "low" || value === "medium" || value === "high" ? value : null;
}

function asDriftState(value: unknown): AdaptiveBatchSnapshotResult["driftState"] {
  return value === "stable" || value === "warning" || value === "drift" || value === "recovery"
    ? value
    : null;
}

function rankedSelections(
  matrix: readonly number[],
  digitCount: number,
  topRanks: readonly number[],
): { requested: AdaptiveBatchSnapshotSelection[]; best: AdaptiveSelection } {
  const maxRank = Math.max(...topRanks);
  const ranked = rankDigitSelections(matrix, "bbfs", digitCount, maxRank);
  const requested = topRanks.flatMap((rank) => {
    const selection = ranked[rank - 1];
    return selection
      ? [{
        rank,
        digits: selection.digits,
        estimatedSuccess: selection.estimatedSuccess,
        baselineSuccess: selection.baselineSuccess,
        lift: selection.lift,
        selectionMargin: selection.selectionMargin,
      }]
      : [];
  });
  return { requested, best: ranked[0] };
}

export async function loadAdaptiveBatchSnapshots(
  sql: AdaptiveBatchSqlClient,
  request: AdaptiveBatchSnapshotRequest,
): Promise<AdaptiveBatchSnapshotResult[]> {
  const validationError = validateAdaptiveBatchSnapshotRequest(request);
  if (validationError) throw new Error(validationError);

  const marketIds = normalizeMarketIds(request.marketIds);
  const topRanks = normalizeTopRanks(request.topRanks);
  const latestResults = normalizeLatestResults(request.latestResults);
  const rows = await sql`
    select distinct on (p.market_id)
      p.id::text as prediction_id,
      p.market_id,
      p.market_name,
      p.latest_draw,
      p.pair_probabilities,
      p.signal_strength,
      p.drift_state,
      p.state_revision,
      p.history_length,
      p.created_at
    from adaptive.predictions p
    where p.market_id in (
      select jsonb_array_elements_text(${JSON.stringify(marketIds)}::jsonb)
    )
      and p.target_2d = ${request.target2D}
      and p.engine_version = ${ADAPTIVE_ENGINE_VERSION}
      and p.config_version = ${ADAPTIVE_CONFIG_VERSION}
      and p.status = 'pending'
    order by p.market_id, p.history_length desc, p.created_at desc
  `;
  const byMarket = new Map(rows.map((row) => [String(row.market_id), row]));
  const upserts: Array<Record<string, unknown>> = [];
  const results: AdaptiveBatchSnapshotResult[] = [];

  for (const marketId of marketIds) {
    const row = byMarket.get(marketId);
    const expectedLatestDraw = latestResults[marketId] ?? null;
    if (!row) {
      results.push({
        marketId,
        marketName: marketId,
        status: "missing",
        latestDraw: null,
        expectedLatestDraw,
        signalStrength: null,
        driftState: null,
        stateRevision: null,
        selections: [],
      });
      continue;
    }

    const latestDraw = String(row.latest_draw ?? "");
    const common = {
      marketId,
      marketName: String(row.market_name ?? marketId),
      latestDraw: /^\d{4}$/.test(latestDraw) ? latestDraw : null,
      expectedLatestDraw,
      signalStrength: asSignalStrength(row.signal_strength),
      driftState: asDriftState(row.drift_state),
      stateRevision: Number.isFinite(Number(row.state_revision)) ? Number(row.state_revision) : null,
    };

    if (expectedLatestDraw && latestDraw !== expectedLatestDraw) {
      results.push({ ...common, status: "stale", selections: [] });
      continue;
    }

    const matrix = asProbabilityMatrix(row.pair_probabilities);
    if (!matrix) {
      results.push({ ...common, status: "missing", selections: [] });
      continue;
    }

    const { requested, best } = rankedSelections(matrix, request.digitCount, topRanks);
    results.push({ ...common, status: "fresh", selections: requested });
    upserts.push({
      prediction_id: String(row.prediction_id),
      digit_count: request.digitCount,
      digits: best.digits,
      estimated_success: best.estimatedSuccess,
      baseline_success: best.baselineSuccess,
      lift: best.lift,
      selection_margin: best.selectionMargin,
    });
  }

  if (upserts.length) {
    await sql`
      insert into adaptive.published_selections (
        prediction_id,
        method,
        digit_count,
        digits,
        estimated_success,
        baseline_success,
        lift,
        selection_margin
      )
      select
        x.prediction_id::uuid,
        'bbfs',
        x.digit_count::smallint,
        array(
          select value::smallint
          from jsonb_array_elements_text(x.digits)
        ),
        x.estimated_success,
        x.baseline_success,
        x.lift,
        x.selection_margin
      from jsonb_to_recordset(${JSON.stringify(upserts)}::jsonb) as x(
        prediction_id text,
        digit_count integer,
        digits jsonb,
        estimated_success real,
        baseline_success real,
        lift real,
        selection_margin real
      )
      on conflict (prediction_id, method, digit_count)
      do update set
        digits = excluded.digits,
        estimated_success = excluded.estimated_success,
        baseline_success = excluded.baseline_success,
        lift = excluded.lift,
        selection_margin = excluded.selection_margin
    `;
  }

  return results;
}
