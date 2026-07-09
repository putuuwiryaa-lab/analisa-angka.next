import { NextResponse } from "next/server";
import { runAnalysis } from "@/lib/server/engines/predictionEngine";
import { requireActiveAccess } from "@/lib/server/access";
import { createAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

const ANALYZE_WINDOW = 20;

const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

type TargetPair = "depan" | "tengah" | "belakang";
type AnalysisScope = "default" | "4d" | "3d" | "2d_depan" | "2d_tengah" | "2d_belakang";
type RawMarket = Record<string, unknown>;
type MarketSupabaseClient = ReturnType<typeof createAdminClient>;

const BBFS_GGBK_PARAM = 10;

function isInternalRequest(headers: Headers) {
  const input =
    headers.get("x-internal-secret") ||
    headers.get("x-internal-api-secret") ||
    "";

  return Boolean(INTERNAL_API_SECRET && input && input === INTERNAL_API_SECRET);
}

async function requestIsAllowed(request: Request) {
  if (isInternalRequest(request.headers)) return true;

  const access = await requireActiveAccess(request.headers);
  return access.ok ? true : access;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeMarketId(value: string) {
  return safeDecode(value).trim().toLowerCase();
}

function marketLookupValues(value: string) {
  const raw = value.trim();
  const decoded = safeDecode(raw).trim();
  const encoded = encodeURIComponent(decoded);

  return Array.from(
    new Set([raw, decoded, encoded, decoded.toUpperCase(), decoded.toLowerCase()].filter(Boolean)),
  );
}

function readMarketField(market: unknown, field: string) {
  if (!market || typeof market !== "object") return undefined;
  return Reflect.get(market, field);
}

function marketIdOf(market: RawMarket) {
  return String(market.id ?? market.slug ?? market.code ?? market.name ?? "");
}

function marketNameOf(market: RawMarket) {
  return String(market.name ?? market.title ?? market.id ?? market.slug ?? "Pasaran");
}

function extractHistoryData(market: RawMarket) {
  return String(
    readMarketField(market, "history_data") ??
      readMarketField(market, "historyData") ??
      readMarketField(market, "history") ??
      readMarketField(market, "data") ??
      readMarketField(market, "results") ??
      readMarketField(market, "result") ??
      "",
  );
}

function parseHistoryTokens(historyData: string) {
  return historyData
    .split(/[\s\n\r\t,;|]+/)
    .map((token) => token.trim())
    .filter((token) => /^\d{4}$/.test(token));
}

function sanitizeData(data: unknown): string[] | null {
  if (!Array.isArray(data)) return null;

  const cleaned = data
    .map((item) => String(item || "").trim())
    .filter((item) => /^\d{4}$/.test(item));

  if (cleaned.length < 17) return null;

  return cleaned.slice(-ANALYZE_WINDOW);
}

async function findMarketByColumn(
  supabase: MarketSupabaseClient,
  column: "id" | "name",
  values: string[],
) {
  const { data, error } = await supabase.from("markets").select("*").in(column, values).limit(1);
  if (error) throw error;
  return ((data || [])[0] as RawMarket | undefined) || null;
}

async function findMarketByNameIlike(supabase: MarketSupabaseClient, value: string) {
  const name = safeDecode(value).trim();
  if (!name) return null;

  const { data, error } = await supabase.from("markets").select("*").ilike("name", name).limit(1);
  if (error) throw error;
  return ((data || [])[0] as RawMarket | undefined) || null;
}

async function loadMarketHistoryData(marketId: string) {
  const supabase = createAdminClient();
  const lookupValues = marketLookupValues(marketId);
  const requested = normalizeMarketId(marketId);

  const market =
    (await findMarketByColumn(supabase, "id", lookupValues)) ??
    (await findMarketByColumn(supabase, "name", lookupValues)) ??
    (await findMarketByNameIlike(supabase, marketId));

  if (!market) return null;

  const resolvedId = normalizeMarketId(marketIdOf(market));
  const resolvedName = normalizeMarketId(marketNameOf(market));
  const matched =
    resolvedId === requested ||
    resolvedName === requested ||
    lookupValues.includes(marketIdOf(market)) ||
    lookupValues.includes(marketNameOf(market));

  if (!matched) return null;

  return parseHistoryTokens(extractHistoryData(market));
}

async function resolveAnalyzeData(marketId: string, data: unknown, internal: boolean) {
  if (marketId) {
    const history = await loadMarketHistoryData(marketId);
    if (!history) {
      return { data: null, error: `Data histori ${marketId} belum disetup oleh Admin!`, status: 404 } as const;
    }

    const cleaned = sanitizeData(history);
    if (!cleaned) {
      return { data: null, error: `Data ${marketId} kurang. Minimal 17 result.`, status: 400 } as const;
    }

    return { data: cleaned, error: "", status: 200 } as const;
  }

  // Backward compatibility khusus request internal tepercaya.
  // Request user biasa tidak boleh lagi mengirim histori manual.
  if (internal) {
    const cleaned = sanitizeData(data);
    if (!cleaned) {
      return { data: null, error: "Data internal tidak valid.", status: 400 } as const;
    }

    return { data: cleaned, error: "", status: 200 } as const;
  }

  return { data: null, error: "marketId wajib dikirim untuk analisa.", status: 400 } as const;
}

function sanitizeTargetPair(value: unknown): TargetPair {
  return value === "depan" || value === "tengah" || value === "belakang"
    ? value
    : "belakang";
}

function sanitizeAnalysisScope(value: unknown): AnalysisScope {
  return value === "4d" ||
    value === "3d" ||
    value === "2d_depan" ||
    value === "2d_tengah" ||
    value === "2d_belakang"
    ? value
    : "default";
}

function isAi2DScope(scope: AnalysisScope): boolean {
  return scope === "2d_depan" || scope === "2d_tengah" || scope === "2d_belakang";
}

function isBbfsGgbkScope(scope: AnalysisScope): boolean {
  return scope === "3d" || isAi2DScope(scope);
}

function normalizeScopeForType(type: string, scope: AnalysisScope): AnalysisScope {
  if (type === "ai" && isAi2DScope(scope)) return "default";
  return scope;
}

function targetPairFromScope(scope: AnalysisScope, fallback: TargetPair): TargetPair {
  if (scope === "2d_depan") return "depan";
  if (scope === "2d_tengah") return "tengah";
  if (scope === "2d_belakang") return "belakang";
  return fallback;
}

function aiParamIsValid(param: number, scope: AnalysisScope) {
  if (scope === "3d") return [1, 3, 5, 7, 8].includes(param);
  if (scope === "4d") return [1, 2, 4].includes(param);
  return [2, 4, 6, 7, 8].includes(param);
}

function bbfsParamIsValid(param: number, scope: AnalysisScope) {
  if ([7, 8, 9].includes(param)) return true;
  return param === BBFS_GGBK_PARAM && isBbfsGgbkScope(scope);
}

export async function POST(request: Request) {
  const internal = isInternalRequest(request.headers);
  const allowed = await requestIsAllowed(request);
  if (allowed !== true) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  try {
    const body = await request.json().catch(() => ({}));
    const { data, param, target_pair, analysis_scope } = body;
    const type = String(body.type || "");
    const marketId = String(body.marketId || body.market_id || "").trim();

    const allowedTypes = new Set(["ai", "bbfs", "mati", "jumlah", "shio", "rekap"]);
    const safeParam = Number(param || 1);
    const rawScope = sanitizeAnalysisScope(analysis_scope);

    const isBBFS = type === "bbfs";
    const isAI = type === "ai";
    const safeScope = normalizeScopeForType(type, rawScope);
    const engineType = isBBFS ? "ai" : type;

    const targetPair =
      isBBFS || isAI
        ? targetPairFromScope(rawScope, sanitizeTargetPair(target_pair))
        : sanitizeTargetPair(target_pair);

    const paramIsValid = isBBFS
      ? bbfsParamIsValid(safeParam, safeScope)
      : isAI
        ? aiParamIsValid(safeParam, safeScope)
        : Number.isInteger(safeParam) && safeParam >= 1 && safeParam <= 8;

    if (
      !allowedTypes.has(type) ||
      !Number.isInteger(safeParam) ||
      !paramIsValid ||
      (isBBFS && safeScope === "default")
    ) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 },
      );
    }

    const resolvedData = await resolveAnalyzeData(marketId, data, internal);
    if (!resolvedData.data) {
      return NextResponse.json(
        { error: resolvedData.error },
        { status: resolvedData.status },
      );
    }

    const result = runAnalysis(engineType, resolvedData.data, safeParam, {
      analysisScope: safeScope,
      targetPair,
      forceDigitResult: isBBFS,
    });

    return NextResponse.json({
      ...result,
      market_id: marketId || null,
      target_pair: targetPair,
      analysis_scope: safeScope,
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json(
      { error: "Gagal memproses analisa" },
      { status: 500 },
    );
  }
}
