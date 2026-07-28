import "server-only";
import {
  MAX_LOSS_STREAK_ALLOWED,
  MIN_WINS_15,
  MIN_WINS_LAST_5,
} from "@/lib/analysis/statistics";
import {
  INVEST_3D_CATALOG,
  INVEST_3D_TARGET_IDEAL,
  INVEST_3D_TARGET_MAX,
  INVEST_3D_TARGET_MIN,
  type Invest3DCombo,
  type Invest3DFilter,
} from "./invest3dCatalog";
import {
  fetchWinningMarketStatistics,
  groupMarketStatistics,
  type MarketStatisticRow as StatRow,
} from "./marketStatisticsPagination";

export type Invest3DRecommendationStatus = "UTAMA" | "ROTASI" | "PANAS";

type StatDescriptor = {
  group_key: string;
  mode: string;
  position: string;
  param: number;
  target_pair: string;
  analysis_scope: string;
};

function filterDescriptor(filter: Invest3DFilter): StatDescriptor {
  switch (filter.kind) {
    case "ai_3d":
      return {
        group_key: "ai",
        mode: "ai",
        position: "all",
        param: filter.param,
        target_pair: "belakang",
        analysis_scope: "3d",
      };
    case "ai_3d_parity":
      return {
        group_key: "ai_parity",
        mode: "ai_parity",
        position: "all",
        param: 1,
        target_pair: "belakang",
        analysis_scope: "3d",
      };
    case "ai_3d_size":
      return {
        group_key: "ai_size",
        mode: "ai_size",
        position: "all",
        param: 1,
        target_pair: "belakang",
        analysis_scope: "3d",
      };
    case "ai_pair":
      return {
        group_key: "ai",
        mode: "ai",
        position: "all",
        param: filter.param,
        target_pair: filter.pair,
        analysis_scope: "default",
      };
    case "parity_pair":
      return {
        group_key: "ai_parity",
        mode: "ai_parity",
        position: "all",
        param: 1,
        target_pair: filter.pair,
        analysis_scope: "default",
      };
    case "size_pair":
      return {
        group_key: "ai_size",
        mode: "ai_size",
        position: "all",
        param: 1,
        target_pair: filter.pair,
        analysis_scope: "default",
      };
    case "bbfs_3d":
      return {
        group_key: "bbfs",
        mode: "bbfs",
        position: "all",
        param: filter.param,
        target_pair: "belakang",
        analysis_scope: "3d",
      };
    case "bbfs_pair":
      return {
        group_key: "bbfs",
        mode: "bbfs",
        position: "all",
        param: filter.param,
        target_pair: filter.pair,
        analysis_scope: `2d_${filter.pair}`,
      };
    case "off_position":
      return {
        group_key: "off_digit",
        mode: "mati",
        position: filter.position,
        param: filter.param,
        target_pair: "all",
        analysis_scope: "default",
      };
    default:
      throw new Error(`Filter Invest 3D tidak dikenal: ${(filter as Invest3DFilter).kind}`);
  }
}

function statKey(descriptor: StatDescriptor) {
  return [
    descriptor.group_key,
    descriptor.mode,
    descriptor.position || "all",
    descriptor.param,
    descriptor.target_pair || "all",
    descriptor.analysis_scope || "default",
  ].join("|");
}

function rowKey(row: StatRow) {
  return [
    row.group_key,
    row.mode,
    row.position || "all",
    row.param,
    row.target_pair || "all",
    row.analysis_scope || "default",
  ].join("|");
}

function isWinning(row: StatRow) {
  return (
    row.wins_15 >= MIN_WINS_15 &&
    row.wins_last_5 >= MIN_WINS_LAST_5 &&
    row.max_loss_streak <= MAX_LOSS_STREAK_ALLOWED
  );
}

function buildWinningMap(rows: StatRow[]) {
  const map = new Map<string, StatRow>();
  for (const row of rows) {
    if (!isWinning(row)) continue;
    if (row.group_key === "off_digit" && row.mode !== "mati") continue;
    const key = rowKey(row);
    const previous = map.get(key);
    if (!previous || (row.score ?? 0) > (previous.score ?? 0)) map.set(key, row);
  }
  return map;
}

export interface Invest3DComboResult {
  id: string;
  label: string;
  family: string;
  expectedLines: number;
  cachedLineCount?: number;
  hitRate: number;
  avgWins15: number;
  minWins15: number;
  avgWinsLast5: number;
  maxLossStreak: number;
  avgScore: number;
  recommendationScore: number;
  recommendationStatus: Invest3DRecommendationStatus;
  riskNote: string;
  filters: Invest3DFilter[];
}

export interface Invest3DMarketResult {
  marketId: string;
  marketName: string;
  pair: "3d";
  pairLabel: "3D";
  combos: Invest3DComboResult[];
  hasAny: boolean;
}

const avg = (values: number[]) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
const max = (values: number[]) => (values.length ? Math.max(...values) : 0);
const min = (values: number[]) => (values.length ? Math.min(...values) : 0);
const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;

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
  if (lineCount < INVEST_3D_TARGET_MIN || lineCount > INVEST_3D_TARGET_MAX) return 0;
  return Math.max(0, 15 - Math.abs(lineCount - INVEST_3D_TARGET_IDEAL) / 5);
}

function statusOf(combo: Invest3DComboResult, score: number): Invest3DRecommendationStatus {
  if (combo.avgWins15 >= 15 && combo.avgWinsLast5 >= 5) return "PANAS";
  if (score >= 80) return "UTAMA";
  return "ROTASI";
}

function riskNoteOf(status: Invest3DRecommendationStatus) {
  if (status === "PANAS") return "Kuat, perlu dipantau";
  if (status === "UTAMA") return "Stabil dan realistis";
  return "Kandidat rotasi";
}

function scoreInvest3DCombo(combo: Invest3DComboResult) {
  const quality =
    historyScore(combo.avgWins15) +
    Math.min(20, combo.avgWinsLast5 * 4) +
    lossStreakScore(combo.maxLossStreak) +
    lineScore(combo.expectedLines);
  return round2(Math.max(0, quality));
}

export function rankInvest3DMarkets(markets: Invest3DMarketResult[]): Invest3DMarketResult[] {
  return markets.map((market) => {
    const combos = market.combos
      .map((combo) => {
        const recommendationScore = scoreInvest3DCombo(combo);
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
          b.minWins15 - a.minWins15 ||
          b.avgWins15 - a.avgWins15 ||
          Math.abs(a.expectedLines - INVEST_3D_TARGET_IDEAL) -
            Math.abs(b.expectedLines - INVEST_3D_TARGET_IDEAL) ||
          a.filters.length - b.filters.length,
      );
    return { ...market, combos, hasAny: combos.length > 0 };
  });
}

export function evaluateMarketInvest3D(
  marketId: string,
  marketName: string,
  rows: StatRow[],
  catalog: Invest3DCombo[] = INVEST_3D_CATALOG,
): Invest3DMarketResult {
  const winningMap = buildWinningMap(rows);
  const combos: Invest3DComboResult[] = [];

  for (const combo of catalog) {
    const matches = combo.filters.map((filter) => winningMap.get(statKey(filterDescriptor(filter))));
    if (matches.some((match) => !match)) continue;

    const wins15 = matches.map((match) => match!.wins_15);
    const winsLast5 = matches.map((match) => match!.wins_last_5);
    const lossStreaks = matches.map((match) => match!.max_loss_streak);
    const scores = matches.map((match) => match!.score ?? 0);

    combos.push({
      id: combo.id,
      label: combo.label,
      family: combo.family,
      expectedLines: combo.expectedLines,
      hitRate: combo.hitRate,
      avgWins15: round1(avg(wins15)),
      minWins15: min(wins15),
      avgWinsLast5: round1(avg(winsLast5)),
      maxLossStreak: max(lossStreaks),
      avgScore: round2(avg(scores)),
      recommendationScore: 0,
      recommendationStatus: "ROTASI",
      riskNote: "Kandidat rotasi",
      filters: combo.filters,
    });
  }

  return {
    marketId,
    marketName,
    pair: "3d",
    pairLabel: "3D",
    combos,
    hasAny: combos.length > 0,
  };
}

export async function loadInvest3DOverview(
  catalog: Invest3DCombo[] = INVEST_3D_CATALOG,
): Promise<Invest3DMarketResult[]> {
  const rows = await fetchWinningMarketStatistics();
  const { byMarket, names } = groupMarketStatistics(rows);
  const results: Invest3DMarketResult[] = [];

  for (const [marketId, marketRows] of byMarket) {
    results.push(evaluateMarketInvest3D(marketId, names.get(marketId) || marketId, marketRows, catalog));
  }

  results.sort((a, b) => Number(b.hasAny) - Number(a.hasAny) || a.marketName.localeCompare(b.marketName));
  return results;
}

export async function loadInvest3DForMarket(
  marketId: string,
  catalog: Invest3DCombo[] = INVEST_3D_CATALOG,
): Promise<Invest3DMarketResult> {
  const rows = await fetchWinningMarketStatistics(marketId);
  const name = rows.find((row) => row.market_name)?.market_name || marketId;
  return evaluateMarketInvest3D(marketId, name, rows, catalog);
}

export { INVEST_3D_CATALOG };
