import "server-only";
import { createAdminClient } from "@/lib/server/supabase-admin";
import {
  MIN_WINS_15,
  MIN_WINS_LAST_5,
  MAX_LOSS_STREAK_ALLOWED,
} from "@/lib/analysis/statistics";
import {
  INVEST_CATALOG,
  catalogForRole,
  type InvestCombo,
  type InvestFilter,
} from "./investCatalog";

export type InvestPair = "depan" | "tengah" | "belakang";
export type InvestRecommendationStatus = "UTAMA" | "ROTASI" | "PANAS";

const PAIRS: InvestPair[] = ["depan", "tengah", "belakang"];

const PAIR_POSITIONS: Record<InvestPair, { d1: string; d2: string }> = {
  depan: { d1: "as", d2: "kop" },
  tengah: { d1: "kop", d2: "kepala" },
  belakang: { d1: "kepala", d2: "ekor" },
};

const PAIR_LABEL: Record<InvestPair, string> = {
  depan: "2D DEPAN",
  tengah: "2D TENGAH",
  belakang: "2D BELAKANG",
};

const BBFS_SCOPE: Record<InvestPair, string> = {
  depan: "2d_depan",
  tengah: "2d_tengah",
  belakang: "2d_belakang",
};

interface StatRow {
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
}

const STAT_SELECT =
  "market_id,market_name,group_key,mode,position,param,target_pair,analysis_scope,wins_15,wins_last_5,max_loss_streak,score";

function filterDescriptor(f: InvestFilter, pair: InvestPair) {
  const pos = PAIR_POSITIONS[pair];
  switch (f.kind) {
    case "ai":
      return { group_key: "ai", position: "all", param: f.param, target_pair: pair, analysis_scope: "default" };
    case "off_kepala":
      return { group_key: "off_digit", position: pos.d1, param: f.param, target_pair: "all", analysis_scope: "default" };
    case "off_ekor":
      return { group_key: "off_digit", position: pos.d2, param: f.param, target_pair: "all", analysis_scope: "default" };
    case "off_jumlah":
      return { group_key: "off_jumlah", position: "all", param: f.param, target_pair: pair, analysis_scope: "default" };
    case "off_shio":
      return { group_key: "off_shio", position: "all", param: f.param, target_pair: pair, analysis_scope: "default" };
    case "bbfs":
      return { group_key: "bbfs", position: "all", param: f.param, target_pair: pair, analysis_scope: BBFS_SCOPE[pair] };
    case "parity":
      return { group_key: "ai_parity", position: "all", param: 1, target_pair: pair, analysis_scope: "default" };
    case "size":
      return { group_key: "ai_size", position: "all", param: 1, target_pair: pair, analysis_scope: "default" };
    default:
      throw new Error(`Filter invest tak dikenal: ${(f as InvestFilter).kind}`);
  }
}

function statKey(d: { group_key: string; position: string; param: number; target_pair: string; analysis_scope: string }) {
  return [d.group_key, d.position || "all", d.param, d.target_pair || "all", d.analysis_scope || "default"].join("|");
}

function rowKey(r: StatRow) {
  return [r.group_key, r.position || "all", r.param, r.target_pair || "all", r.analysis_scope || "default"].join("|");
}

function isWinning(r: StatRow) {
  return r.wins_15 >= MIN_WINS_15 && r.wins_last_5 >= MIN_WINS_LAST_5 && r.max_loss_streak <= MAX_LOSS_STREAK_ALLOWED;
}

function buildWinningMap(rows: StatRow[]) {
  const map = new Map<string, StatRow>();
  for (const r of rows) {
    if (!isWinning(r)) continue;
    if (r.group_key === "off_digit" && r.mode !== "mati") continue;
    const k = rowKey(r);
    const prev = map.get(k);
    if (!prev || (r.score ?? 0) > (prev.score ?? 0)) map.set(k, r);
  }
  return map;
}

export interface InvestComboResult {
  id: string;
  label: string;
  expectedLines: number;
  cachedLineCount?: number;
  hitRate: number;
  avgWins15: number;
  avgWinsLast5: number;
  maxLossStreak: number;
  avgScore: number;
  recommendationScore: number;
  recommendationStatus: InvestRecommendationStatus;
  riskNote: string;
  filters: InvestFilter[];
}

export interface InvestPairResult {
  pair: InvestPair;
  pairLabel: string;
  combos: InvestComboResult[];
}

export interface InvestMarketResult {
  marketId: string;
  marketName: string;
  pairs: InvestPairResult[];
  hasAny: boolean;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const max = (xs: number[]) => (xs.length ? Math.max(...xs) : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

function lineCountOf(combo: InvestComboResult) {
  return Number(combo.cachedLineCount || combo.expectedLines || 0);
}

function historyScore(wins15: number) {
  if (wins15 >= 15) return 32;
  if (wins15 >= 14) return 35;
  if (wins15 >= 13) return 26;
  return 0;
}

function lossStreakScore(maxLossStreak: number) {
  if (maxLossStreak <= 0) return 20;
  if (maxLossStreak === 1) return 17;
  if (maxLossStreak === 2) return 10;
  return 0;
}

function lineScore(lineCount: number) {
  if (lineCount < 53 || lineCount > 67) return 0;
  return Math.max(0, 15 - Math.abs(lineCount - 60));
}

function statusOf(combo: InvestComboResult, score: number): InvestRecommendationStatus {
  if (combo.avgWins15 >= 15 && combo.avgWinsLast5 >= 5) return "PANAS";
  if (score >= 80) return "UTAMA";
  return "ROTASI";
}

function riskNoteOf(status: InvestRecommendationStatus) {
  if (status === "PANAS") return "Kuat, perlu dipantau";
  if (status === "UTAMA") return "Stabil dan realistis";
  return "Kandidat rotasi";
}

function scoreInvestCombo(combo: InvestComboResult) {
  const quality =
    historyScore(combo.avgWins15) +
    Math.min(20, combo.avgWinsLast5 * 4) +
    lossStreakScore(combo.maxLossStreak) +
    lineScore(lineCountOf(combo));

  return round2(Math.max(0, quality));
}

export function rankInvestMarkets(
  markets: InvestMarketResult[],
  _latestResultByMarket: Record<string, string> = {},
): InvestMarketResult[] {
  return markets.map((market) => ({
    ...market,
    pairs: market.pairs.map((pair) => {
      const combos = pair.combos
        .map((combo) => {
          const recommendationScore = scoreInvestCombo(combo);
          const recommendationStatus = statusOf(combo, recommendationScore);
          return {
            ...combo,
            recommendationScore,
            recommendationStatus,
            riskNote: riskNoteOf(recommendationStatus),
          };
        })
        .sort(
          (a, b) =>
            b.recommendationScore - a.recommendationScore ||
            b.avgScore - a.avgScore ||
            b.avgWins15 - a.avgWins15 ||
            a.expectedLines - b.expectedLines,
        );

      return { ...pair, combos };
    }),
  }));
}

export function evaluateMarketInvest(
  marketId: string,
  marketName: string,
  rows: StatRow[],
  catalog: InvestCombo[] = INVEST_CATALOG,
): InvestMarketResult {
  const winMap = buildWinningMap(rows);

  const pairs = PAIRS.map<InvestPairResult>((pair) => {
    const combos: InvestComboResult[] = [];

    for (const combo of catalog) {
      const matches = combo.filters.map((f) => winMap.get(statKey(filterDescriptor(f, pair))));
      if (matches.some((m) => !m)) continue;

      const wins15 = matches.map((m) => m!.wins_15);
      const winsLast5 = matches.map((m) => m!.wins_last_5);
      const lossStreaks = matches.map((m) => m!.max_loss_streak);
      const scores = matches.map((m) => m!.score ?? 0);
      const baseCombo: InvestComboResult = {
        id: combo.id,
        label: combo.label,
        expectedLines: combo.expectedLines,
        hitRate: combo.hitRate,
        avgWins15: round1(avg(wins15)),
        avgWinsLast5: round1(avg(winsLast5)),
        maxLossStreak: max(lossStreaks),
        avgScore: round2(avg(scores)),
        recommendationScore: 0,
        recommendationStatus: "ROTASI",
        riskNote: "Kandidat rotasi",
        filters: combo.filters,
      };

      combos.push(baseCombo);
    }

    return { pair, pairLabel: PAIR_LABEL[pair], combos };
  });

  return {
    marketId,
    marketName,
    pairs,
    hasAny: pairs.some((p) => p.combos.length > 0),
  };
}

export async function loadInvestOverview(catalog: InvestCombo[] = INVEST_CATALOG): Promise<InvestMarketResult[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("market_statistics")
    .select(STAT_SELECT)
    .eq("is_active", true)
    .gte("wins_15", MIN_WINS_15)
    .gte("wins_last_5", MIN_WINS_LAST_5)
    .lte("max_loss_streak", MAX_LOSS_STREAK_ALLOWED)
    .limit(5000);

  if (error) throw error;

  const rows = (data || []) as StatRow[];
  const byMarket = new Map<string, StatRow[]>();
  const names = new Map<string, string>();
  for (const r of rows) {
    if (!r.market_id) continue;
    let bucket = byMarket.get(r.market_id);
    if (!bucket) {
      bucket = [];
      byMarket.set(r.market_id, bucket);
    }
    bucket.push(r);
    if (r.market_name) names.set(r.market_id, r.market_name);
  }

  const results: InvestMarketResult[] = [];
  for (const [marketId, marketRows] of byMarket) {
    results.push(evaluateMarketInvest(marketId, names.get(marketId) || marketId, marketRows, catalog));
  }

  results.sort((a, b) => Number(b.hasAny) - Number(a.hasAny) || a.marketName.localeCompare(b.marketName));
  return results;
}

export async function loadInvestForMarket(marketId: string, catalog: InvestCombo[] = INVEST_CATALOG): Promise<InvestMarketResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("market_statistics")
    .select(STAT_SELECT)
    .eq("market_id", marketId)
    .eq("is_active", true)
    .gte("wins_15", MIN_WINS_15)
    .gte("wins_last_5", MIN_WINS_LAST_5)
    .lte("max_loss_streak", MAX_LOSS_STREAK_ALLOWED)
    .limit(2000);

  if (error) throw error;

  const rows = (data || []) as StatRow[];
  const name = rows.find((r) => r.market_name)?.market_name || marketId;
  return evaluateMarketInvest(marketId, name, rows, catalog);
}

export { INVEST_CATALOG, catalogForRole };
