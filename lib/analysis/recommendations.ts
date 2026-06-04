import { supabase } from "../supabase/client";
import { customFocusPairs, customFocusToBBFSScope, type CustomFocus, type TargetPair } from "./customDigit";

/** Badge rekomendasi. Didefinisikan di sini; komponen mengimpor dari modul ini. */
export type RecommendationBadge = "thumb" | "fire";

const RECOMMENDATION_SAMPLE_SIZE = 15;
const RECOMMENDATION_MIN_SAMPLE = 10;

const AI_WIN_THRESHOLDS: Record<number, number> = { 1: 9, 2: 9, 3: 11, 4: 11, 5: 13, 6: 13 };
const AI_DERIVED_WIN_THRESHOLDS: Record<number, number> = { 1: 9 };
const BBFS_WIN_THRESHOLDS: Record<number, number> = { 7: 8, 8: 10, 9: 12 };
const MATI_WIN_THRESHOLDS: Record<number, number> = { 1: 14, 2: 13, 3: 11 };
const JUMLAH_WIN_THRESHOLDS: Record<number, number> = { 1: 14, 2: 12, 3: 11 };
const SHIO_WIN_THRESHOLDS: Record<number, number> = { 1: 14, 2: 13, 3: 12 };

const AI_PARTIAL_WIN_RATES: Record<number, number> = { 1: 9 / 15, 2: 9 / 15, 3: 11 / 15, 4: 11 / 15, 5: 13 / 15, 6: 13 / 15 };
const AI_DERIVED_PARTIAL_WIN_RATES: Record<number, number> = { 1: 9 / 15 };
const BBFS_PARTIAL_WIN_RATES: Record<number, number> = { 7: 8 / 15, 8: 10 / 15, 9: 12 / 15 };
const MATI_PARTIAL_WIN_RATES: Record<number, number> = { 1: 14 / 15, 2: 13 / 15, 3: 11 / 15 };
const JUMLAH_PARTIAL_WIN_RATES: Record<number, number> = { 1: 14 / 15, 2: 12 / 15, 3: 11 / 15 };
const SHIO_PARTIAL_WIN_RATES: Record<number, number> = { 1: 14 / 15, 2: 13 / 15, 3: 12 / 15 };

type RecommendationGroup = "ai" | "ai_parity" | "ai_size" | "bbfs" | "mati" | "jumlah" | "shio";
export type RecommendedMap = Record<string, RecommendationBadge>;
type ScoredRecommendation = { param: number; badge: RecommendationBadge };

function isSuccessStatus(row: any) {
  return row?.status !== "TIDAK MASUK" && row?.status !== "ZONK" && row?.is_hit !== false;
}

function getFullThreshold(group: RecommendationGroup, param: number) {
  if (group === "ai") return AI_WIN_THRESHOLDS[param];
  if (group === "ai_parity" || group === "ai_size") return AI_DERIVED_WIN_THRESHOLDS[param];
  if (group === "bbfs") return BBFS_WIN_THRESHOLDS[param];
  if (group === "jumlah") return JUMLAH_WIN_THRESHOLDS[param];
  if (group === "shio") return SHIO_WIN_THRESHOLDS[param];
  return MATI_WIN_THRESHOLDS[param];
}

function getPartialWinRate(group: RecommendationGroup, param: number) {
  if (group === "ai") return AI_PARTIAL_WIN_RATES[param];
  if (group === "ai_parity" || group === "ai_size") return AI_DERIVED_PARTIAL_WIN_RATES[param];
  if (group === "bbfs") return BBFS_PARTIAL_WIN_RATES[param];
  if (group === "jumlah") return JUMLAH_PARTIAL_WIN_RATES[param];
  if (group === "shio") return SHIO_PARTIAL_WIN_RATES[param];
  return MATI_PARTIAL_WIN_RATES[param];
}

function scoreParam(rows: any[], param: number, group: RecommendationGroup) {
  const sample = rows.filter((row) => Number(row.param) === param).slice(0, RECOMMENDATION_SAMPLE_SIZE);
  if (sample.length < RECOMMENDATION_MIN_SAMPLE) return null;

  const wins = sample.filter(isSuccessStatus).length;
  const isPerfect = sample.length >= RECOMMENDATION_SAMPLE_SIZE && wins === RECOMMENDATION_SAMPLE_SIZE;
  const fullThreshold = getFullThreshold(group, param);
  const partialWinRate = getPartialWinRate(group, param);

  if (!fullThreshold || !partialWinRate) return null;

  const isRecommended = sample.length >= RECOMMENDATION_SAMPLE_SIZE ? wins >= fullThreshold : wins / sample.length >= partialWinRate;
  if (!isRecommended) return null;
  return { param, badge: isPerfect ? "fire" as const : "thumb" as const };
}

function scoreParams(rows: any[], params: number[], group: RecommendationGroup) {
  return params.map((param) => scoreParam(rows, param, group)).filter(Boolean) as ScoredRecommendation[];
}

function pickRecommendationFromScores(scored: ScoredRecommendation[], prefer: "low" | "high") {
  if (!scored.length) return null;
  const selectedParam = prefer === "low" ? Math.min(...scored.map((item) => item.param)) : Math.max(...scored.map((item) => item.param));
  return scored.find((item) => item.param === selectedParam) || null;
}

function setBadge(next: RecommendedMap, key: string, badge: RecommendationBadge) {
  if (badge === "fire" || next[key] !== "fire") next[key] = badge;
}

function applyRecommendationBadges(next: RecommendedMap, keyForParam: (param: number) => string, rows: any[], params: number[], prefer: "low" | "high", group: RecommendationGroup) {
  const scored = scoreParams(rows, params, group);
  const pick = pickRecommendationFromScores(scored, prefer);
  if (pick) setBadge(next, keyForParam(pick.param), pick.badge);
  scored.filter((item) => item.badge === "fire").forEach((item) => setBadge(next, keyForParam(item.param), "fire"));
}

async function loadRows(marketId: string, mode: string, position: string, params: number[], targetPair: TargetPair = "belakang", analysisScope = "default") {
  const { data, error } = await supabase
    .from("analysis_evaluations")
    .select("param,is_hit,status,evaluated_at,target_pair,analysis_scope")
    .eq("market_id", marketId)
    .eq("mode", mode)
    .eq("position", position)
    .eq("target_pair", targetPair)
    .eq("analysis_scope", analysisScope)
    .in("param", params)
    .order("evaluated_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  return data || [];
}

export async function loadCustomDigitRecommendations(marketId: string, customFocus: CustomFocus): Promise<RecommendedMap> {
  const pairs = customFocusPairs(customFocus);
  const bbfsScope = customFocusToBBFSScope(customFocus);
  const next: RecommendedMap = {};

  await Promise.all(pairs.map(async (pair) => {
    const [aiRows, aiParityRows, aiSizeRows, jumlahRows, shioRows] = await Promise.all([
      loadRows(marketId, "ai", "all", [2, 4, 6], pair),
      loadRows(marketId, "ai_parity", "all", [1], pair),
      loadRows(marketId, "ai_size", "all", [1], pair),
      loadRows(marketId, "jumlah", "all", [1, 2, 3], pair),
      loadRows(marketId, "shio", "all", [1, 2, 3], pair),
    ]);
    applyRecommendationBadges(next, (param) => `ai-${pair}-${param}`, aiRows, [2, 4, 6], "low", "ai");
    applyRecommendationBadges(next, () => `ai-${pair}-7`, aiParityRows, [1], "low", "ai_parity");
    applyRecommendationBadges(next, () => `ai-${pair}-8`, aiSizeRows, [1], "low", "ai_size");
    applyRecommendationBadges(next, (param) => `jumlah-${pair}-${param}`, jumlahRows, [1, 2, 3], "high", "jumlah");
    applyRecommendationBadges(next, (param) => `shio-${pair}-${param}`, shioRows, [1, 2, 3], "high", "shio");
  }));

  if (customFocus === "3d" || customFocus === "4d") {
    const [ai3dRows, ai3dParityRows, ai3dSizeRows] = await Promise.all([
      loadRows(marketId, "ai", "all", [1, 3, 5], "belakang", "3d"),
      loadRows(marketId, "ai_parity", "all", [1], "belakang", "3d"),
      loadRows(marketId, "ai_size", "all", [1], "belakang", "3d"),
    ]);
    applyRecommendationBadges(next, (param) => `ai3d-${param}`, ai3dRows, [1, 3, 5], "low", "ai");
    applyRecommendationBadges(next, () => "ai3d-7", ai3dParityRows, [1], "low", "ai_parity");
    applyRecommendationBadges(next, () => "ai3d-8", ai3dSizeRows, [1], "low", "ai_size");
  }

  if (customFocus === "4d") {
    const ai4dRows = await loadRows(marketId, "ai", "all", [1, 2, 4], "belakang", "4d");
    applyRecommendationBadges(next, (param) => `ai4d-${param}`, ai4dRows, [1, 2, 4], "low", "ai");
  }

  const bbfsTargetPair = bbfsScope.includes("2d_") ? bbfsScope === "2d_depan" ? "depan" : bbfsScope === "2d_tengah" ? "tengah" : "belakang" : "belakang";
  const bbfsRows = await loadRows(marketId, "bbfs", "all", [7, 8, 9], bbfsTargetPair, bbfsScope);
  applyRecommendationBadges(next, (param) => `bbfs-${param}`, bbfsRows, [7, 8, 9], "low", "bbfs");

  const [asRows, kopRows, kepalaRows, ekorRows] = await Promise.all([
    loadRows(marketId, "mati", "as", [1, 2, 3]),
    loadRows(marketId, "mati", "kop", [1, 2, 3]),
    loadRows(marketId, "mati", "kepala", [1, 2, 3]),
    loadRows(marketId, "mati", "ekor", [1, 2, 3]),
  ]);
  applyRecommendationBadges(next, (param) => `as-${param}`, asRows, [1, 2, 3], "high", "mati");
  applyRecommendationBadges(next, (param) => `kop-${param}`, kopRows, [1, 2, 3], "high", "mati");
  applyRecommendationBadges(next, (param) => `kepala-${param}`, kepalaRows, [1, 2, 3], "high", "mati");
  applyRecommendationBadges(next, (param) => `ekor-${param}`, ekorRows, [1, 2, 3], "high", "mati");

  return next;
}
