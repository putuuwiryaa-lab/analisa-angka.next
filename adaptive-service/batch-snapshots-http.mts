import { neon } from "jsr:@neon/serverless@1.0.1";
import {
  loadAdaptiveBatchSnapshots,
  validateAdaptiveBatchSnapshotRequest,
  type AdaptiveBatchSnapshotRequest,
  type AdaptiveBatchSqlClient,
  type AdaptiveBatchTarget,
} from "./batch-snapshots.mts";

const databaseUrl = Deno.env.get("NEON_DATABASE_URL")?.trim();
const serviceSecret = Deno.env.get("ADAPTIVE_SERVICE_SECRET")?.trim();

if (!databaseUrl) throw new Error("NEON_DATABASE_URL belum dikonfigurasi.");
if (!serviceSecret) throw new Error("ADAPTIVE_SERVICE_SECRET belum dikonfigurasi.");

const sql = neon(databaseUrl) as unknown as AdaptiveBatchSqlClient;
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const TARGETS = new Set<AdaptiveBatchTarget>(["depan", "tengah", "belakang"]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function authorized(request: Request): boolean {
  return request.headers.get("authorization") === `Bearer ${serviceSecret}`;
}

function normalizeLatestResults(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, string> = {};
  for (const [marketId, result] of Object.entries(value)) {
    const normalizedId = marketId.trim();
    const normalizedResult = String(result ?? "").trim();
    if (normalizedId && /^\d{4}$/.test(normalizedResult)) {
      output[normalizedId] = normalizedResult;
    }
  }
  return output;
}

function normalizeRequest(value: unknown): AdaptiveBatchSnapshotRequest {
  const body = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const target = String(body.target2D ?? "");
  return {
    marketIds: Array.isArray(body.marketIds)
      ? body.marketIds.map((item) => String(item))
      : [],
    target2D: TARGETS.has(target as AdaptiveBatchTarget)
      ? target as AdaptiveBatchTarget
      : "belakang",
    digitCount: Number(body.digitCount),
    topRanks: Array.isArray(body.topRanks)
      ? body.topRanks.map(Number)
      : [1],
    latestResults: normalizeLatestResults(body.latestResults),
  };
}

export async function adaptiveBatchSnapshotHandler(request: Request): Promise<Response> {
  if (!authorized(request)) return json({ error: "Unauthorized." }, 401);
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const body = normalizeRequest(await request.json().catch(() => ({})));
    const validationError = validateAdaptiveBatchSnapshotRequest(body);
    if (validationError) return json({ error: validationError }, 400);

    const results = await loadAdaptiveBatchSnapshots(sql, body);
    return json({ results });
  } catch (error) {
    console.error("[adaptive-service:snapshots/batch] request failed", error);
    return json({
      error: error instanceof Error ? error.message : "Snapshot Adaptive gagal.",
    }, 500);
  }
}
