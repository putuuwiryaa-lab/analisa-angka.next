import { neon } from "jsr:@neon/serverless@1.0.1";
import {
  latestReconciliationRun,
  runAdaptiveReconciliation,
} from "./reconcile.mts";
import {
  loadAdaptiveEvaluationDashboard,
  type EvaluationDashboardRequest,
} from "./evaluation.mts";
import {
  applyAdaptiveGuardrail,
  isStoredHistoryCompatible,
  type GuardrailRunPayload,
} from "./guardrail.mts";

type AdaptiveTarget = "depan" | "tengah" | "belakang";
type AdaptiveMethod = "ai" | "bbfs";

interface AdaptiveSelectionPayload {
  method: AdaptiveMethod;
  digitCount: number;
  digits: number[];
  estimatedSuccess: number;
  baselineSuccess: number;
  lift: number;
  selectionMargin: number;
}

interface AdaptivePredictionPayload {
  engineVersion: string;
  configVersion: string;
  target2D: AdaptiveTarget;
  historyLength: number;
  historyCutoffKey: string;
  latestDraw: string;
  pairProbabilities: number[];
  leftProbabilities: number[];
  rightProbabilities: number[];
  expertWeights: Record<string, number>;
  signalStrength: "low" | "medium" | "high";
  selection: AdaptiveSelectionPayload;
  replay?: Record<string, unknown>;
}

interface StorePredictionRequest {
  marketId: string;
  marketName: string;
  targetDrawKey: string;
  prediction: AdaptivePredictionPayload;
}

interface LoadContextRequest {
  marketId: string;
  target2D: AdaptiveTarget;
  engineVersion: string;
  configVersion: string;
  historyDraws?: string[];
}

interface StoreOnlineRunRequest extends StorePredictionRequest {
  state: {
    engineVersion: string;
    configVersion: string;
    target2D: AdaptiveTarget;
    processedHistoryLength: number;
    lastProcessedDraw: string | null;
    expertWeights: Record<string, number>;
    familyWeights: Record<string, number>;
    horizonWeights: Record<string, number>;
    stateRevision: number;
  };
  settlement: null | (Record<string, unknown> & {
    predictionId?: string;
    combinedLoss?: number;
  });
  historyDraws: string[];
}

interface ReconcileRequest {
  trigger?: "manual" | "api";
  marketId?: string;
  marketLimit?: number;
  force?: boolean;
}

const databaseUrl = Deno.env.get("NEON_DATABASE_URL")?.trim();
const serviceSecret = Deno.env.get("ADAPTIVE_SERVICE_SECRET")?.trim();

if (!databaseUrl) throw new Error("NEON_DATABASE_URL belum dikonfigurasi.");
if (!serviceSecret) throw new Error("ADAPTIVE_SERVICE_SECRET belum dikonfigurasi.");

const sql = neon(databaseUrl);
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const TARGETS = new Set<AdaptiveTarget>(["depan", "tengah", "belakang"]);
const METHODS = new Set<AdaptiveMethod>(["ai", "bbfs"]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function authorized(request: Request): boolean {
  return request.headers.get("authorization") === `Bearer ${serviceSecret}`;
}

function isTarget(value: unknown): value is AdaptiveTarget {
  return typeof value === "string" && TARGETS.has(value as AdaptiveTarget);
}

function isMethod(value: unknown): value is AdaptiveMethod {
  return typeof value === "string" && METHODS.has(value as AdaptiveMethod);
}

function validDraws(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((draw) => typeof draw === "string" && /^\d{4}$/.test(draw));
}

function validatePrediction(prediction: AdaptivePredictionPayload | undefined): string | null {
  const selection = prediction?.selection;
  if (!prediction || !isTarget(prediction.target2D)) return "Target 2D tidak valid.";
  if (!/^\d{4}$/.test(prediction.latestDraw)) return "Latest draw tidak valid.";
  if (prediction.pairProbabilities?.length !== 100) return "Pair probabilities harus berisi 100 nilai.";
  if (prediction.leftProbabilities?.length !== 10 || prediction.rightProbabilities?.length !== 10) {
    return "Marginal probabilities harus berisi 10 nilai.";
  }
  if (!selection || !isMethod(selection.method)) return "Metode selection tidak valid.";
  if (!Number.isInteger(selection.digitCount) || selection.digitCount < 1 || selection.digitCount > 9) {
    return "Jumlah digit harus antara 1 dan 9.";
  }
  if (selection.digits?.length !== selection.digitCount) return "Jumlah output digit tidak konsisten.";
  return null;
}

function validateStorePrediction(body: StorePredictionRequest): string | null {
  if (!body?.marketId || !body?.marketName || !body?.targetDrawKey) return "Identitas prediction tidak lengkap.";
  return validatePrediction(body.prediction);
}

function validateOnlineRun(body: StoreOnlineRunRequest): string | null {
  const predictionError = validateStorePrediction(body);
  if (predictionError) return predictionError;
  if (!body.state || body.state.target2D !== body.prediction.target2D) return "State Adaptive tidak valid.";
  if (!Number.isInteger(body.state.processedHistoryLength) || body.state.processedHistoryLength < 2) {
    return "Panjang histori state tidak valid.";
  }
  if (!validDraws(body.historyDraws) || body.historyDraws.length !== body.state.processedHistoryLength) {
    return "Snapshot histori tidak konsisten dengan state.";
  }
  return null;
}

async function loadContext(body: LoadContextRequest): Promise<Response> {
  if (!body?.marketId || !isTarget(body?.target2D) || !body?.engineVersion || !body?.configVersion) {
    return json({ error: "Parameter context tidak lengkap." }, 400);
  }
  if (body.historyDraws !== undefined && !validDraws(body.historyDraws)) {
    return json({ error: "Snapshot histori context tidak valid." }, 400);
  }

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
    where market_id = ${body.marketId}
      and target_2d = ${body.target2D}
      and engine_version = ${body.engineVersion}
      and config_version = ${body.configVersion}
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
    where p.market_id = ${body.marketId}
      and p.target_2d = ${body.target2D}
      and p.engine_version = ${body.engineVersion}
      and p.config_version = ${body.configVersion}
      and p.status = 'pending'
    order by p.history_length desc, p.created_at desc
    limit 1
  `;

  const stateRow = stateRows[0] as Record<string, unknown> | undefined;
  const pendingRow = pendingRows[0] as Record<string, unknown> | undefined;
  const compatibility = stateRow && body.historyDraws
    ? await isStoredHistoryCompatible({
      draws: body.historyDraws,
      processedHistoryLength: Number(stateRow.processed_history_length),
      lastProcessedDraw: stateRow.last_processed_draw ? String(stateRow.last_processed_draw) : null,
      storedFingerprint: stateRow.history_fingerprint ? String(stateRow.history_fingerprint) : null,
    })
    : { compatible: true, correctionDetected: false, currentFingerprint: null };
  const useStoredContext = Boolean(stateRow && compatibility.compatible);

  return json({
    historyCorrectionDetected: compatibility.correctionDetected,
    historyFingerprint: compatibility.currentFingerprint,
    state: useStoredContext && stateRow ? {
      engineVersion: String(stateRow.engine_version),
      configVersion: String(stateRow.config_version),
      target2D: String(stateRow.target_2d),
      processedHistoryLength: Number(stateRow.processed_history_length),
      lastProcessedDraw: stateRow.last_processed_draw ? String(stateRow.last_processed_draw) : null,
      expertWeights: stateRow.expert_weights ?? {},
      familyWeights: stateRow.family_weights ?? {},
      horizonWeights: stateRow.horizon_weights ?? {},
      stateRevision: Number(stateRow.state_revision ?? 0),
    } : null,
    pendingPrediction: useStoredContext && pendingRow ? {
      predictionId: String(pendingRow.prediction_id),
      engineVersion: String(pendingRow.engine_version),
      configVersion: String(pendingRow.config_version),
      target2D: String(pendingRow.target_2d),
      historyLength: Number(pendingRow.history_length),
      pairProbabilities: pendingRow.pair_probabilities,
      leftProbabilities: pendingRow.left_probabilities,
      rightProbabilities: pendingRow.right_probabilities,
      expertWeights: pendingRow.expert_weights ?? {},
      selections: pendingRow.selections ?? [],
    } : null,
  });
}

async function storeLegacyPrediction(body: StorePredictionRequest): Promise<Response> {
  const validationError = validateStorePrediction(body);
  if (validationError) return json({ error: validationError }, 400);

  const prediction = body.prediction;
  const selection = prediction.selection;
  const rows = await sql`
    select adaptive.store_prediction(
      ${body.marketId}::text,
      ${body.marketName}::text,
      ${body.targetDrawKey}::text,
      ${prediction.target2D}::text,
      ${prediction.engineVersion}::text,
      ${prediction.configVersion}::text,
      ${prediction.historyCutoffKey}::text,
      ${prediction.historyLength}::integer,
      ${prediction.latestDraw}::text,
      ${JSON.stringify(prediction.pairProbabilities)}::jsonb,
      ${JSON.stringify(prediction.leftProbabilities)}::jsonb,
      ${JSON.stringify(prediction.rightProbabilities)}::jsonb,
      ${JSON.stringify(prediction.expertWeights)}::jsonb,
      ${prediction.signalStrength}::text,
      ${selection.method}::text,
      ${selection.digitCount}::smallint,
      ${JSON.stringify(selection.digits)}::jsonb,
      ${selection.estimatedSuccess}::real,
      ${selection.baselineSuccess}::real,
      ${selection.lift}::real,
      ${selection.selectionMargin}::real
    ) as prediction_id
  `;

  const predictionId = String((rows[0] as { prediction_id?: unknown } | undefined)?.prediction_id ?? "");
  if (!predictionId) throw new Error("Neon tidak mengembalikan prediction id.");
  return json({ predictionId });
}

async function storeOnlineRun(body: StoreOnlineRunRequest): Promise<Response> {
  const validationError = validateOnlineRun(body);
  if (validationError) return json({ error: validationError }, 400);

  const rows = await sql`
    select adaptive.store_online_run(${JSON.stringify(body)}::jsonb) as result
  `;
  const result = (rows[0] as { result?: unknown } | undefined)?.result;
  if (!result || typeof result !== "object") throw new Error("Neon tidak mengembalikan hasil online run.");

  const guardrailPayload: GuardrailRunPayload = {
    marketId: body.marketId,
    targetDrawKey: body.targetDrawKey,
    prediction: {
      target2D: body.prediction.target2D,
      engineVersion: body.prediction.engineVersion,
      configVersion: body.prediction.configVersion,
    },
    settlement: body.settlement?.predictionId
      ? {
        predictionId: String(body.settlement.predictionId),
        combinedLoss: Number(body.settlement.combinedLoss ?? 0),
      }
      : null,
    historyDraws: body.historyDraws,
  };
  const guardrail = await applyAdaptiveGuardrail(sql, guardrailPayload);
  return json({ ...(result as Record<string, unknown>), guardrail });
}

export async function adaptiveServiceHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return json({
      ok: true,
      service: "hf-apie-adaptive-persistence",
      mode: "online-learning",
      guardrail: "ewma-ph-v1-observe-only",
      reconciliationConfigured: Boolean(
        Deno.env.get("SUPABASE_URL")?.trim() &&
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()
      ),
    });
  }

  if (!authorized(request)) return json({ error: "Unauthorized." }, 401);

  try {
    if (request.method === "POST" && url.pathname === "/context/load") {
      return await loadContext(await request.json() as LoadContextRequest);
    }
    if (request.method === "POST" && url.pathname === "/runs/store") {
      return await storeOnlineRun(await request.json() as StoreOnlineRunRequest);
    }
    if (request.method === "POST" && url.pathname === "/predictions/store") {
      return await storeLegacyPrediction(await request.json() as StorePredictionRequest);
    }
    if (request.method === "POST" && url.pathname === "/evaluation/dashboard") {
      const body = await request.json().catch(() => ({})) as Partial<EvaluationDashboardRequest>;
      const marketId = String(body.marketId ?? "").trim();
      const digitCount = Number(body.digitCount);
      if (!marketId || !isTarget(body.target2D) || !isMethod(body.method)) {
        return json({ error: "Parameter dashboard evaluasi tidak lengkap." }, 400);
      }
      if (!Number.isInteger(digitCount) || digitCount < 1 || digitCount > 9) {
        return json({ error: "Jumlah digit dashboard harus antara 1 dan 9." }, 400);
      }
      const dashboard = await loadAdaptiveEvaluationDashboard({
        marketId,
        target2D: body.target2D,
        method: body.method,
        digitCount,
        window: body.window,
      });
      return json({ dashboard });
    }
    if (request.method === "POST" && url.pathname === "/reconcile") {
      const body = await request.json().catch(() => ({})) as ReconcileRequest;
      const summary = await runAdaptiveReconciliation({
        trigger: body.trigger === "api" ? "api" : "manual",
        marketLimit: body.marketLimit,
        requestedMarketId: body.marketId,
        force: Boolean(body.force),
      });
      return json(summary);
    }
    if (request.method === "POST" && url.pathname === "/reconciliation/latest") {
      return json({ run: await latestReconciliationRun() });
    }
    return json({ error: "Not found." }, 404);
  } catch (error) {
    console.error("[adaptive-service] request failed", error);
    return json({ error: error instanceof Error ? error.message : "Adaptive service gagal." }, 500);
  }
}
