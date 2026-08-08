import { NextRequest, NextResponse } from "next/server";
import { NO_STORE_HEADERS, PRIVATE_SHORT_CACHE_HEADERS } from "@/lib/server/cacheHeaders";
import { requireActiveAccess } from "@/lib/server/access";
import { createAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HISTORY_WINDOW = 20;
const HISTORY_SERVER_CACHE_TTL_MS = 30 * 1000;

type RawMarket = Record<string, unknown>;
type MarketSupabaseClient = ReturnType<typeof createAdminClient>;
type MarketHistoryPayload = {
  success: true;
  market_id: string;
  market_name: string;
  latest_result: string;
  history_count: number;
  data: string[];
};

type HistoryCacheEntry = {
  expiresAt: number;
  value: MarketHistoryPayload;
};

const historyCache = new Map<string, HistoryCacheEntry>();
const historyInFlight = new Map<string, Promise<MarketHistoryPayload | null>>();

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

function marketIdOf(market: RawMarket) {
  return String(market.id ?? market.slug ?? market.code ?? market.name ?? "");
}

function marketNameOf(market: RawMarket) {
  return String(market.name ?? market.title ?? market.id ?? market.slug ?? "Pasaran");
}

function extractHistoryData(market: RawMarket) {
  return String(
    market.history_data ??
      market.historyData ??
      market.history ??
      market.data ??
      market.results ??
      market.result ??
      "",
  );
}

function parseHistoryTokens(historyData: string) {
  return historyData
    .split(/[\s\n\r\t,;|]+/)
    .map((token) => token.trim())
    .filter((token) => /^\d{4}$/.test(token));
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

async function loadMarketHistory(marketId: string): Promise<MarketHistoryPayload | null> {
  const key = normalizeMarketId(marketId);
  const now = Date.now();
  const cached = historyCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;
  if (cached) historyCache.delete(key);

  const pending = historyInFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
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

    const history = parseHistoryTokens(extractHistoryData(market));
    const value: MarketHistoryPayload = {
      success: true,
      market_id: marketIdOf(market),
      market_name: marketNameOf(market),
      latest_result: history[history.length - 1] || "----",
      history_count: history.length,
      data: history.slice(-HISTORY_WINDOW),
    };

    historyCache.set(key, { value, expiresAt: Date.now() + HISTORY_SERVER_CACHE_TTL_MS });
    const resolvedKey = normalizeMarketId(value.market_id);
    if (resolvedKey && resolvedKey !== key) {
      historyCache.set(resolvedKey, { value, expiresAt: Date.now() + HISTORY_SERVER_CACHE_TTL_MS });
    }
    return value;
  })();

  historyInFlight.set(key, request);
  try {
    return await request;
  } finally {
    historyInFlight.delete(key);
  }
}

export async function GET(request: NextRequest) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status, headers: NO_STORE_HEADERS });
  }

  try {
    const marketId = safeDecode(request.nextUrl.searchParams.get("marketId") || "").trim();
    if (!marketId) {
      return NextResponse.json({ success: false, error: "marketId kosong." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const payload = await loadMarketHistory(marketId);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: `Data histori ${marketId} belum disetup oleh Admin!` },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(payload, {
      headers: PRIVATE_SHORT_CACHE_HEADERS,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal memuat histori pasaran";
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
