import { neon } from "jsr:@neon/serverless@1.1.0";

interface StorePredictionRequest {
  marketId: string;
  marketName: string;
  targetDrawKey: string;
  prediction: {
    engineVersion: string;
    configVersion: string;
    target2D: "depan" | "tengah" | "belakang";
    historyLength: number;
    historyCutoffKey: string;
    latestDraw: string;
    pairProbabilities: number[];
    leftProbabilities: number[];
    rightProbabilities: number[];
    expertWeights: Record<string, number>;
    signalStrength: "low" | "medium" | "high";
    selection: {
      method: "ai" | "bbfs";
      digitCount: number;
      digits: number[];
      estimatedSuccess: number;
      baselineSuccess: number;
      lift: number;
      selectionMargin: number;
    };
  };
}

const databaseUrl = Deno.env.get("NEON_DATABASE_URL")?.trim();
const serviceSecret = Deno.env.get("ADAPTIVE_SERVICE_SECRET")?.trim();

if (!databaseUrl) throw new Error("NEON_DATABASE_URL belum dikonfigurasi.");
if (!serviceSecret) throw new Error("ADAPTIVE_SERVICE_SECRET belum dikonfigurasi.");

const sql = neon(databaseUrl);
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function authorized(request: Request): boolean {
  return request.headers.get("authorization") === `Bearer ${serviceSecret}`;
}

function validateRequest(body: StorePredictionRequest): string | null {
  const prediction = body?.prediction;
  const selection = prediction?.selection;

  if (!body?.marketId || !body?.marketName || !body?.targetDrawKey) return "Identitas prediction tidak lengkap.";
  if (!prediction || !["depan", "tengah", "belakang"].includes(prediction.target2D)) return "Target 2D tidak valid.";
  if (!/^\d{4}$/.test(prediction.latestDraw)) return "Latest draw tidak valid.";
  if (prediction.pairProbabilities?.length !== 100) return "Pair probabilities harus berisi 100 nilai.";
  if (prediction.leftProbabilities?.length !== 10 || prediction.rightProbabilities?.length !== 10) {
    return "Marginal probabilities harus berisi 10 nilai.";
  }
  if (!selection || !["ai", "bbfs"].includes(selection.method)) return "Metode selection tidak valid.";
  if (!Number.isInteger(selection.digitCount) || selection.digitCount < 1 || selection.digitCount > 9) {
    return "Jumlah digit harus antara 1 dan 9.";
  }
  if (selection.digits?.length !== selection.digitCount) return "Jumlah output digit tidak konsisten.";
  return null;
}

Deno.serve(async (request) => {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return json({ ok: true, service: "hf-apie-adaptive-persistence" });
  }

  if (request.method !== "POST" || url.pathname !== "/predictions/store") {
    return json({ error: "Not found." }, 404);
  }

  if (!authorized(request)) return json({ error: "Unauthorized." }, 401);

  try {
    const body = await request.json() as StorePredictionRequest;
    const validationError = validateRequest(body);
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
  } catch (error) {
    console.error("[adaptive-service] store prediction failed", error);
    return json({ error: error instanceof Error ? error.message : "Store prediction gagal." }, 500);
  }
});
