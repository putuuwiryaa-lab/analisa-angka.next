import { NextResponse } from "next/server";
import crypto from "crypto";
import { loadInvestOverview, loadInvestForMarket, type InvestMarketResult, type InvestPair } from "@/lib/server/engines/investEngine";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { verifyActiveTelegramSession } from "@/lib/server/telegram-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMULA_VERSION = "invest-angka-jadi-v1";

type InvestFilter = { kind: string; param: number };

type MarketRow = Record<string, unknown>;

type MarketCacheInfo = {
  cacheMarketId: string;
  latestResult: string;
};

function normalizeMarketId(value: string) {
  try {
    return decodeURIComponent(value).trim().toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

function marketIdOf(market: MarketRow) {
  return String(market.id ?? market.slug ?? market.code ?? market.name ?? "");
}

function marketNameOf(market: MarketRow) {
  return String(market.name ?? market.title ?? market.id ?? market.slug ?? "Pasaran");
}

function extractHistoryData(market: MarketRow) {
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

function sanitizeFilters(filters: InvestFilter[]) {
  return filters
    .map((item) => ({ kind: String(item.kind || "").trim(), param: Number(item.param || 0) }))
    .filter((item) => item.kind && Number.isInteger(item.param) && item.param > 0 && item.param <= 9)
    .sort((a, b) => (a.kind === b.kind ? a.param - b.param : a.kind.localeCompare(b.kind)));
}

function stableFiltersKey(filters: InvestFilter[]) {
  return sanitizeFilters(filters).map((item) => `${item.kind}:${item.param}`).join("|");
}

function cacheKey(input: {
  marketId: string;
  pair: InvestPair;
  filters: InvestFilter[];
  latestResult: string;
}) {
  const raw = [input.marketId, input.pair, stableFiltersKey(input.filters), input.latestResult, FORMULA_VERSION].join("::");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function collectMarketIds(markets: InvestMarketResult[]) {
  return Array.from(new Set(markets.map((market) => market.marketId).filter(Boolean)));
}

async function loadMarketCacheInfo(marketIds: string[]) {
  const result = new Map<string, MarketCacheInfo>();
  if (!marketIds.length) return result;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("markets").select("*");
    if (error) return result;

    const rows = (data || []) as MarketRow[];
    for (const marketId of marketIds) {
      const requested = normalizeMarketId(marketId);
      const row = rows.find((item) => {
        const id = normalizeMarketId(marketIdOf(item));
        const name = normalizeMarketId(marketNameOf(item));
        return id === requested || name === requested;
      });

      if (!row) continue;

      const history = parseHistoryTokens(extractHistoryData(row));
      const latestResult = history[history.length - 1] || "----";
      if (!latestResult || latestResult === "----") continue;

      result.set(marketId, {
        cacheMarketId: marketIdOf(row),
        latestResult,
      });
    }
  } catch {
    return result;
  }

  return result;
}

async function readCachedLineCounts(cacheKeys: string[]) {
  const result = new Map<string, number>();
  const keys = Array.from(new Set(cacheKeys.filter(Boolean)));
  if (!keys.length) return result;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("invest_angka_jadi_cache")
      .select("cache_key,line_count,expires_at")
      .in("cache_key", keys)
      .gt("expires_at", new Date().toISOString());

    if (error) return result;

    for (const row of (data || []) as Array<{ cache_key?: string | null; line_count?: number | null }>) {
      if (!row.cache_key) continue;
      const lineCount = Number(row.line_count || 0);
      if (lineCount > 0) result.set(row.cache_key, lineCount);
    }
  } catch {
    return result;
  }

  return result;
}

async function attachCachedLineCounts(markets: InvestMarketResult[]) {
  const cacheInfoByMarket = await loadMarketCacheInfo(collectMarketIds(markets));
  const comboCacheKeys = new Map<string, string>();
  const keys: string[] = [];

  for (const market of markets) {
    const cacheInfo = cacheInfoByMarket.get(market.marketId);
    if (!cacheInfo) continue;

    for (const pair of market.pairs) {
      for (const combo of pair.combos) {
        const key = cacheKey({
          marketId: cacheInfo.cacheMarketId,
          pair: pair.pair,
          filters: combo.filters,
          latestResult: cacheInfo.latestResult,
        });
        comboCacheKeys.set(`${market.marketId}::${pair.pair}::${combo.id}`, key);
        keys.push(key);
      }
    }
  }

  const lineCounts = await readCachedLineCounts(keys);

  return markets.map((market) => ({
    ...market,
    pairs: market.pairs.map((pair) => ({
      ...pair,
      combos: pair.combos.map((combo) => {
        const key = comboCacheKeys.get(`${market.marketId}::${pair.pair}::${combo.id}`);
        const cachedLineCount = key ? lineCounts.get(key) : undefined;
        return cachedLineCount ? { ...combo, cachedLineCount } : combo;
      }),
    })),
  }));
}

export async function GET(request: Request) {
  try {
    const access = await verifyActiveTelegramSession(request.headers);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const marketId = new URL(request.url).searchParams.get("marketId");

    const data = marketId
      ? { market: (await attachCachedLineCounts([await loadInvestForMarket(marketId)]))[0] }
      : { markets: await attachCachedLineCounts(await loadInvestOverview()) };

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("INVEST_API_ERROR", e);
    return NextResponse.json({ error: "Gagal memuat rekomendasi invest" }, { status: 500 });
  }
}
