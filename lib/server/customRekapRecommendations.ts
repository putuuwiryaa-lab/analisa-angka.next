import type { SupabaseClient } from "@supabase/supabase-js";
import { customFocusPairs, customFocusToBBFSScope, type CustomFocus, type TargetPair } from "@/lib/analysis/customDigit";
import type { RecommendationBadge, RecommendedMap } from "@/lib/analysis/recommendations";

const SAMPLE_SIZE = 15;
const MIN_SAMPLE = 10;

const AI_WIN: Record<number, number> = { 1: 9, 2: 9, 3: 11, 4: 11, 5: 12, 6: 13 };
const AI_DERIVED_WIN: Record<number, number> = { 1: 12 };
const BBFS_WIN: Record<number, number> = { 7: 10, 8: 11, 9: 13 };
const MATI_WIN: Record<number, number> = { 1: 14, 2: 13, 3: 12 };
const JUMLAH_WIN: Record<number, number> = { 1: 14, 2: 13, 3: 12 };
const SHIO_WIN: Record<number, number> = { 1: 14, 2: 13, 3: 12 };

const AI_RATE: Record<number, number> = { 1: 9 / 15, 2: 9 / 15, 3: 11 / 15, 4: 11 / 15, 5: 12 / 15, 6: 13 / 15 };
const AI_DERIVED_RATE: Record<number, number> = { 1: 12 / 15 };
const BBFS_RATE: Record<number, number> = { 7: 10 / 15, 8: 11 / 15, 9: 13 / 15 };
const MATI_RATE: Record<number, number> = { 1: 14 / 15, 2: 13 / 15, 3: 12 / 15 };
const JUMLAH_RATE: Record<number, number> = { 1: 14 / 15, 2: 13 / 15, 3: 12 / 15 };
const SHIO_RATE: Record<number, number> = { 1: 14 / 15, 2: 13 / 15, 3: 12 / 15 };

type Group = "ai" | "ai_parity" | "ai_size" | "bbfs" | "mati" | "jumlah" | "shio";
type Score = { param: number; badge: RecommendationBadge };
type MarketRow = { id?: string | null; name?: string | null };

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function marketCandidates(value: string) {
  const decoded = safeDecode(value).trim();
  const encoded = encodeURIComponent(decoded);
  return Array.from(new Set([value, decoded, encoded, decoded.toUpperCase(), decoded.toLowerCase()].filter(Boolean)));
}

function isSuccess(row: any) {
  return row?.status !== "TIDAK MASUK" && row?.status !== "ZONK" && row?.is_hit !== false;
}

function fullThreshold(group: Group, param: number) {
  if (group === "ai") return AI_WIN[param];
  if (group === "ai_parity" || group === "ai_size") return AI_DERIVED_WIN[param];
  if (group === "bbfs") return BBFS_WIN[param];
  if (group === "jumlah") return JUMLAH_WIN[param];
  if (group === "shio") return SHIO_WIN[param];
  return MATI_WIN[param];
}

function partialRate(group: Group, param: number) {
  if (group === "ai") return AI_RATE[param];
  if (group === "ai_parity" || group === "ai_size") return AI_DERIVED_RATE[param];
  if (group === "bbfs") return BBFS_RATE[param];
  if (group === "jumlah") return JUMLAH_RATE[param];
  if (group === "shio") return SHIO_RATE[param];
  return MATI_RATE[param];
}

function scoreParam(rows: any[], param: number, group: Group) {
  const sample = rows.filter((row) => Number(row.param) === param).slice(0, SAMPLE_SIZE);
  if (sample.length < MIN_SAMPLE) return null;

  const wins = sample.filter(isSuccess).length;
  const threshold = fullThreshold(group, param);
  const rate = partialRate(group, param);
  if (!threshold || !rate) return null;

  const ok = sample.length >= SAMPLE_SIZE ? wins >= threshold : wins / sample.length >= rate;
  if (!ok) return null;

  return { param, badge: sample.length >= SAMPLE_SIZE && wins === sample.length ? "fire" as const : "thumb" as const };
}

function scoreParams(rows: any[], params: number[], group: Group) {
  return params.map((param) => scoreParam(rows, param, group)).filter(Boolean) as Score[];
}

function pick(scored: Score[], prefer: "low" | "high") {
  if (!scored.length) return null;
  const param = prefer === "low" ? Math.min(...scored.map((item) => item.param)) : Math.max(...scored.map((item) => item.param));
  return scored.find((item) => item.param === param) || null;
}

function setBadge(map: RecommendedMap, key: string, badge: RecommendationBadge) {
  if (badge === "fire" || map[key] !== "fire") map[key] = badge;
}

function apply(map: RecommendedMap, keyForParam: (param: number) => string, rows: any[], params: number[], prefer: "low" | "high", group: Group) {
  const scored = scoreParams(rows, params, group);
  const selected = pick(scored, prefer);
  if (selected) setBadge(map, keyForParam(selected.param), selected.badge);
  scored.filter((item) => item.badge === "fire").forEach((item) => setBadge(map, keyForParam(item.param), "fire"));
}

export async function resolveCustomRekapMarketIds(supabase: SupabaseClient, marketId: string) {
  const ids = new Set(marketCandidates(marketId));
  const { data } = await supabase.from("markets").select("id,name").in("id", Array.from(ids));

  for (const market of ((data || []) as MarketRow[])) {
    if (market.id) ids.add(String(market.id));
    if (market.name) ids.add(String(market.name));
  }

  return Array.from(ids);
}

async function loadRows(supabase: SupabaseClient, marketIds: string[], mode: string, position: string, params: number[], targetPair: TargetPair = "belakang", analysisScope = "default") {
  const { data, error } = await supabase
    .from("analysis_evaluations")
    .select("param,is_hit,status,evaluated_at,target_pair,analysis_scope,market_id")
    .in("market_id", marketIds)
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

function pairScope(pair: TargetPair) {
  return `2d_${pair}`;
}

function globalBbfsParams() {
  return [7, 8, 9];
}

export async function buildCustomRekapRecommendations(supabase: SupabaseClient, marketIds: string[], customFocus: CustomFocus): Promise<RecommendedMap> {
  const pairs = customFocusPairs(customFocus);
  const bbfsScope = customFocusToBBFSScope(customFocus);
  const next: RecommendedMap = {};

  await Promise.all(pairs.map(async (pair) => {
    const [aiRows, parityRows, sizeRows, bbfsRows, jumlahRows, shioRows] = await Promise.all([
      loadRows(supabase, marketIds, "ai", "all", [2, 4, 6], pair),
      loadRows(supabase, marketIds, "ai_parity", "all", [1], pair),
      loadRows(supabase, marketIds, "ai_size", "all", [1], pair),
      loadRows(supabase, marketIds, "bbfs", "all", [7, 8, 9], pair, pairScope(pair)),
      loadRows(supabase, marketIds, "jumlah", "all", [1, 2, 3], pair),
      loadRows(supabase, marketIds, "shio", "all", [1, 2, 3], pair),
    ]);

    apply(next, (param) => `ai-${pair}-${param}`, aiRows, [2, 4, 6], "low", "ai");
    apply(next, () => `ai-${pair}-7`, parityRows, [1], "low", "ai_parity");
    apply(next, () => `ai-${pair}-8`, sizeRows, [1], "low", "ai_size");
    apply(next, (param) => `bbfs-${pair}-${param}`, bbfsRows, [7, 8, 9], "low", "bbfs");
    apply(next, (param) => `jumlah-${pair}-${param}`, jumlahRows, [1, 2, 3], "high", "jumlah");
    apply(next, (param) => `shio-${pair}-${param}`, shioRows, [1, 2, 3], "high", "shio");
  }));

  if (customFocus === "3d" || customFocus === "4d") {
    const [ai3dRows, parity3dRows, size3dRows] = await Promise.all([
      loadRows(supabase, marketIds, "ai", "all", [1, 3, 5], "belakang", "3d"),
      loadRows(supabase, marketIds, "ai_parity", "all", [1], "belakang", "3d"),
      loadRows(supabase, marketIds, "ai_size", "all", [1], "belakang", "3d"),
    ]);
    apply(next, (param) => `ai3d-${param}`, ai3dRows, [1, 3, 5], "low", "ai");
    apply(next, () => "ai3d-7", parity3dRows, [1], "low", "ai_parity");
    apply(next, () => "ai3d-8", size3dRows, [1], "low", "ai_size");
  }

  if (customFocus === "4d") {
    const ai4dRows = await loadRows(supabase, marketIds, "ai", "all", [1, 2, 4], "belakang", "4d");
    apply(next, (param) => `ai4d-${param}`, ai4dRows, [1, 2, 4], "low", "ai");
  }

  const bbfsTargetPair = bbfsScope === "2d_depan" ? "depan" : bbfsScope === "2d_tengah" ? "tengah" : "belakang";
  const bbfsParams = globalBbfsParams();
  const bbfsRows = await loadRows(supabase, marketIds, "bbfs", "all", bbfsParams, bbfsTargetPair, bbfsScope);
  apply(next, (param) => `bbfs-${param}`, bbfsRows, bbfsParams, "low", "bbfs");

  const [asRows, kopRows, kepalaRows, ekorRows] = await Promise.all([
    loadRows(supabase, marketIds, "mati", "as", [1, 2, 3]),
    loadRows(supabase, marketIds, "mati", "kop", [1, 2, 3]),
    loadRows(supabase, marketIds, "mati", "kepala", [1, 2, 3]),
    loadRows(supabase, marketIds, "mati", "ekor", [1, 2, 3]),
  ]);

  apply(next, (param) => `as-${param}`, asRows, [1, 2, 3], "high", "mati");
  apply(next, (param) => `kop-${param}`, kopRows, [1, 2, 3], "high", "mati");
  apply(next, (param) => `kepala-${param}`, kepalaRows, [1, 2, 3], "high", "mati");
  apply(next, (param) => `ekor-${param}`, ekorRows, [1, 2, 3], "high", "mati");

  return next;
}
