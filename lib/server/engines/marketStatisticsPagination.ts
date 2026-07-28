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

/**
 * Membaca seluruh statistik yang lolos filter Invest secara bertahap.
 *
 * Offset maju berdasarkan jumlah baris aktual yang dikembalikan, bukan ukuran
 * page yang diminta. Ini tetap aman bila PostgREST/Supabase menerapkan batas
 * response yang lebih kecil dari STAT_PAGE_SIZE.
 */
export async function fetchWinningMarketStatistics(marketId?: string): Promise<MarketStatisticRow[]> {
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
