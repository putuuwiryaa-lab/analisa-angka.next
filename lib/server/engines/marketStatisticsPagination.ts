import "server-only";
import { createAdminClient } from "@/lib/server/supabase-admin";
import {
  MAX_LOSS_STREAK_ALLOWED,
  MIN_WINS_15,
  MIN_WINS_LAST_5,
} from "@/lib/analysis/statistics";

export type MarketStatisticRow = {
  market_id: string;
  market_name?: string | null;
  group_key: string;
  mode: string;
  position: string | null;
  param: number;
  target_pair: string | null;
  analysis_scope: string | null;
  wins_15: number;
  wins_last_5: number;
  max_loss_streak: number;
  score: number | null;
};

const STAT_SELECT =
  "market_id,market_name,group_key,mode,position,param,target_pair,analysis_scope,wins_15,wins_last_5,max_loss_streak,score";
const STAT_PAGE_SIZE = 1000;
const STAT_CACHE_TTL_MS = 60 * 1000;

type StatisticsCacheEntry = {
  expiresAt: number;
  rows: MarketStatisticRow[];
};

const statisticsCache = new Map<string, StatisticsCacheEntry>();
const statisticsInFlight = new Map<string, Promise<MarketStatisticRow[]>>();

function normalizeMarketId(value: string) {
  return value.trim().toLowerCase();
}

function statisticsCacheKey(marketId?: string) {
  return marketId ? normalizeMarketId(marketId) : "*";
}

async function loadWinningMarketStatistics(marketId?: string): Promise<MarketStatisticRow[]> {
  const supabase = createAdminClient();
  const rows: MarketStatisticRow[] = [];
  let from = 0;
  let expectedCount: number | null = null;

  while (true) {
    let query = supabase
      .from("market_statistics")
      .select(STAT_SELECT, { count: "exact" })
      .eq("is_active", true)
      .gte("wins_15", MIN_WINS_15)
      .gte("wins_last_5", MIN_WINS_LAST_5)
      .lte("max_loss_streak", MAX_LOSS_STREAK_ALLOWED);

    if (marketId) query = query.eq("market_id", marketId);

    const { data, error, count } = await query
      .order("market_id", { ascending: true })
      .order("market_name", { ascending: true })
      .order("group_key", { ascending: true })
      .order("mode", { ascending: true })
      .order("position", { ascending: true })
      .order("param", { ascending: true })
      .order("target_pair", { ascending: true })
      .order("analysis_scope", { ascending: true })
      .order("score", { ascending: false })
      .order("wins_15", { ascending: false })
      .order("wins_last_5", { ascending: false })
      .order("max_loss_streak", { ascending: true })
      .range(from, from + STAT_PAGE_SIZE - 1);

    if (error) throw error;
    if (count !== null) {
      if (expectedCount === null) expectedCount = count;
      else if (count !== expectedCount) {
        throw new Error("market_statistics berubah saat pagination sedang berjalan. Coba ulangi request.");
      }
    }

    const page = (data || []) as MarketStatisticRow[];
    if (page.length === 0) break;

    rows.push(...page);
    from += page.length;

    if (expectedCount !== null && rows.length >= expectedCount) break;
    if (expectedCount === null && page.length < STAT_PAGE_SIZE) break;
  }

  if (expectedCount !== null && rows.length !== expectedCount) {
    throw new Error(
      `Pembacaan market_statistics tidak konsisten: terbaca ${rows.length} dari ${expectedCount} baris.`,
    );
  }

  return rows;
}

/**
 * Reads statistics with a short per-isolate cache. The data is global (not user
 * specific), while route-level access checks still run before this function.
 * Concurrent cold requests share the same Promise instead of repeating the
 * same paginated Supabase scan.
 */
export async function fetchWinningMarketStatistics(marketId?: string): Promise<MarketStatisticRow[]> {
  const key = statisticsCacheKey(marketId);
  const now = Date.now();
  const cached = statisticsCache.get(key);
  if (cached && cached.expiresAt > now) return cached.rows;
  if (cached) statisticsCache.delete(key);

  if (marketId) {
    const globalCache = statisticsCache.get("*");
    if (globalCache && globalCache.expiresAt > now) {
      const normalizedId = normalizeMarketId(marketId);
      const rows = globalCache.rows.filter((row) => normalizeMarketId(row.market_id) === normalizedId);
      statisticsCache.set(key, { rows, expiresAt: globalCache.expiresAt });
      return rows;
    }
  }

  const pending = statisticsInFlight.get(key);
  if (pending) return pending;

  if (marketId) {
    const globalPending = statisticsInFlight.get("*");
    if (globalPending) {
      const normalizedId = normalizeMarketId(marketId);
      const request = globalPending.then((rows) => rows.filter((row) => normalizeMarketId(row.market_id) === normalizedId));
      statisticsInFlight.set(key, request);
      try {
        const rows = await request;
        statisticsCache.set(key, { rows, expiresAt: Date.now() + STAT_CACHE_TTL_MS });
        return rows;
      } finally {
        statisticsInFlight.delete(key);
      }
    }
  }

  const request = loadWinningMarketStatistics(marketId);
  statisticsInFlight.set(key, request);

  try {
    const rows = await request;
    statisticsCache.set(key, { rows, expiresAt: Date.now() + STAT_CACHE_TTL_MS });
    return rows;
  } finally {
    statisticsInFlight.delete(key);
  }
}

export function groupMarketStatistics(rows: MarketStatisticRow[]) {
  const byMarket = new Map<string, MarketStatisticRow[]>();
  const names = new Map<string, string>();

  for (const row of rows) {
    if (!row.market_id) continue;
    const bucket = byMarket.get(row.market_id) || [];
    bucket.push(row);
    byMarket.set(row.market_id, bucket);
    if (row.market_name) names.set(row.market_id, row.market_name);
  }

  return { byMarket, names };
}
