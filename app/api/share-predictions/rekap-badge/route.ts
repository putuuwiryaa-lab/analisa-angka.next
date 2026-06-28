import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { verifyActiveTelegramSession } from "@/lib/server/telegram-session";
import { requireSuperShareAccess } from "@/lib/server/share-predictions-access";
import { runAnalysis } from "@/lib/server/engines/predictionEngine";
import { buildCustomDigitLines, type TargetPair } from "@/lib/analysis/customDigit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const SAMPLE_SIZE = 15;
const MIN_SAMPLE = 10;

const PAIRS: TargetPair[] = ["depan", "tengah", "belakang"];
const PAIR_LABEL: Record<TargetPair, string> = { depan: "2D Depan", tengah: "2D Tengah", belakang: "2D Belakang" };
const PAIR_POSITIONS: Record<TargetPair, Array<"AS" | "KOP" | "KEPALA" | "EKOR">> = {
  depan: ["AS", "KOP"],
  tengah: ["KOP", "KEPALA"],
  belakang: ["KEPALA", "EKOR"],
};
const POSITION_KEY: Record<"AS" | "KOP" | "KEPALA" | "EKOR", "as" | "kop" | "kepala" | "ekor"> = { AS: "as", KOP: "kop", KEPALA: "kepala", EKOR: "ekor" };
const POSITION_PROP: Record<"AS" | "KOP" | "KEPALA" | "EKOR", "offAs" | "offKop" | "offKepala" | "offEkor"> = { AS: "offAs", KOP: "offKop", KEPALA: "offKepala", EKOR: "offEkor" };

const THRESHOLDS: Record<string, Record<number, number>> = {
  ai: { 2: 9, 4: 11, 6: 13 },
  ai_parity: { 1: 12 },
  ai_size: { 1: 12 },
  bbfs: { 7: 10, 8: 11, 9: 13, 10: 11 },
  mati: { 1: 14, 2: 13, 3: 12 },
  jumlah: { 1: 14, 2: 13, 3: 12 },
  shio: { 1: 14, 2: 13, 3: 12 },
};
const PARTIAL_RATES: Record<string, Record<number, number>> = {
  ai: { 2: 9 / 15, 4: 11 / 15, 6: 13 / 15 },
  ai_parity: { 1: 12 / 15 },
  ai_size: { 1: 12 / 15 },
  bbfs: { 7: 10 / 15, 8: 11 / 15, 9: 13 / 15, 10: 11 / 15 },
  mati: { 1: 14 / 15, 2: 13 / 15, 3: 12 / 15 },
  jumlah: { 1: 14 / 15, 2: 13 / 15, 3: 12 / 15 },
  shio: { 1: 14 / 15, 2: 13 / 15, 3: 12 / 15 },
};

type Badge = "fire" | "thumb";
type MarketRow = Record<string, unknown>;
type EvalRow = { mode?: string | null; param?: number | null; position?: string | null; target_pair?: string | null; analysis_scope?: string | null; is_hit?: boolean | null; status?: string | null; evaluated_at?: string | null };
type Scored = { param: number; badge: Badge };
type FilterState = { aiByPair: Partial<Record<TargetPair, number[]>>; aiParityByPair: Partial<Record<TargetPair, string>>; aiSizeByPair: Partial<Record<TargetPair, string>>; bbfsByPair: Partial<Record<TargetPair, number[]>>; offAs: number[]; offKop: number[]; offKepala: number[]; offEkor: number[]; jumlahByPair: Partial<Record<TargetPair, number[]>>; shioByPair: Partial<Record<TargetPair, number[]>> };

function normalizeMarket(market: MarketRow) {
  const historyData = String(market.history_data ?? market.historyData ?? market.history ?? market.data ?? market.results ?? market.result ?? "");
  return {
    id: String(market.id ?? market.slug ?? market.code ?? market.name ?? ""),
    name: String(market.name ?? market.title ?? market.id ?? "Pasaran"),
    order: Number(market.order ?? market.sort_order ?? market.sort ?? 99),
    updatedAt: String(market.updated_at ?? "") || null,
    data: historyData.split(/[\s\n\r\t,;|]+/).map((item) => item.trim()).filter((item) => /^\d{4}$/.test(item)).slice(-200),
  };
}

function isSuccess(row: EvalRow) { return row.status !== "TIDAK MASUK" && row.status !== "ZONK" && row.is_hit !== false; }
function scoreParam(rows: EvalRow[], mode: string, param: number): Scored | null {
  const sample = rows.filter((row) => Number(row.param) === param).slice(0, SAMPLE_SIZE);
  if (sample.length < MIN_SAMPLE) return null;
  const wins = sample.filter(isSuccess).length;
  const threshold = THRESHOLDS[mode]?.[param];
  const partialRate = PARTIAL_RATES[mode]?.[param];
  if (!threshold || !partialRate) return null;
  const recommended = sample.length >= SAMPLE_SIZE ? wins >= threshold : wins / sample.length >= partialRate;
  if (!recommended) return null;
  return { param, badge: sample.length >= SAMPLE_SIZE && wins === sample.length ? "fire" : "thumb" };
}
function chooseParam(rows: EvalRow[], mode: string, params: number[], prefer: "low" | "high") {
  const scored = params.map((param) => scoreParam(rows, mode, param)).filter(Boolean) as Scored[];
  if (!scored.length) return null;
  const pool = scored.some((item) => item.badge === "fire") ? scored.filter((item) => item.badge === "fire") : scored;
  const selected = prefer === "low" ? Math.min(...pool.map((item) => item.param)) : Math.max(...pool.map((item) => item.param));
  return pool.find((item) => item.param === selected) || null;
}
function rowsFor(rows: EvalRow[], { mode, pair = "belakang", scope = "default", position = "all" }: { mode: string; pair?: TargetPair; scope?: string; position?: string }) {
  return rows.filter((row) => row.mode === mode && String(row.target_pair || "belakang") === pair && String(row.analysis_scope || "default") === scope && String(row.position || "all").toLowerCase() === position);
}
function resultList(value: unknown) {
  const raw = (value as any)?.data?.result ?? (value as any)?.result ?? value;
  return Array.isArray(raw) ? raw.map((item) => Number(item)).filter((item) => Number.isFinite(item)) : [];
}
function firstText(value: unknown) {
  const raw = (value as any)?.data?.result ?? (value as any)?.result ?? value;
  const first = Array.isArray(raw) ? raw[0] : raw;
  return String(first || "").trim().toUpperCase();
}
function intersectDigitLists(lists: number[][]) {
  if (!lists.length) return [];
  return lists.reduce((acc, list) => acc.filter((digit) => list.includes(digit))).sort((a, b) => a - b);
}
function runAi(data: string[], pair: TargetPair, param: number) { return runAnalysis("ai", data, param, { targetPair: pair, analysisScope: "default" }); }
function runBbfs(data: string[], pair: TargetPair, param: number) { return runAnalysis("ai", data, param, { targetPair: pair, analysisScope: `2d_${pair}` as any, forceDigitResult: true }); }
function runMatiCached(cache: Map<number, any>, data: string[], param: number) { if (!cache.has(param)) cache.set(param, runAnalysis("mati", data, param)); return cache.get(param); }
function addPositionOff(state: FilterState, position: "AS" | "KOP" | "KEPALA" | "EKOR", value: number[]) { state[POSITION_PROP[position]] = value; }

async function loadEvaluations(supabase: ReturnType<typeof createAdminClient>, marketId: string) {
  const { data, error } = await supabase.from("analysis_evaluations").select("mode,param,position,target_pair,analysis_scope,is_hit,status,evaluated_at").eq("market_id", marketId).in("mode", ["ai", "ai_parity", "ai_size", "bbfs", "mati", "jumlah", "shio"]).order("evaluated_at", { ascending: false }).limit(2000);
  if (error) throw error;
  return (data || []) as EvalRow[];
}

function buildPairSection(pair: TargetPair, data: string[], evalRows: EvalRow[]) {
  const state: FilterState = { aiByPair: {}, aiParityByPair: {}, aiSizeByPair: {}, bbfsByPair: {}, offAs: [], offKop: [], offKepala: [], offEkor: [], jumlahByPair: {}, shioByPair: {} };
  let activeFilters = 0;
  const matiCache = new Map<number, any>();

  const aiPick = chooseParam(rowsFor(evalRows, { mode: "ai", pair }), "ai", [2, 4, 6], "low");
  if (aiPick) { state.aiByPair[pair] = resultList(runAi(data, pair, aiPick.param)); activeFilters += 1; }
  const parityPick = chooseParam(rowsFor(evalRows, { mode: "ai_parity", pair }), "ai_parity", [1], "low");
  if (parityPick) { state.aiParityByPair[pair] = firstText(runAi(data, pair, 7)); activeFilters += 1; }
  const sizePick = chooseParam(rowsFor(evalRows, { mode: "ai_size", pair }), "ai_size", [1], "low");
  if (sizePick) { state.aiSizeByPair[pair] = firstText(runAi(data, pair, 8)); activeFilters += 1; }

  const bbfsFilters: number[][] = [];
  const bbfsPick = chooseParam(rowsFor(evalRows, { mode: "bbfs", pair, scope: `2d_${pair}` }), "bbfs", [7, 8, 9], "low");
  if (bbfsPick) { bbfsFilters.push(resultList(runBbfs(data, pair, bbfsPick.param))); activeFilters += 1; }
  const bbfsGgbkPick = chooseParam(rowsFor(evalRows, { mode: "bbfs", pair, scope: `2d_${pair}` }), "bbfs", [10], "low");
  if (bbfsGgbkPick) { bbfsFilters.push(resultList(runBbfs(data, pair, 10))); activeFilters += 1; }
  if (bbfsFilters.length) state.bbfsByPair[pair] = intersectDigitLists(bbfsFilters);

  for (const position of PAIR_POSITIONS[pair]) {
    const pick = chooseParam(rowsFor(evalRows, { mode: "mati", position: POSITION_KEY[position] }), "mati", [1, 2, 3], "high");
    if (!pick) continue;
    const result = runMatiCached(matiCache, data, pick.param);
    addPositionOff(state, position, resultList((result as any)?.data?.[position] || (result as any)?.[position]));
    activeFilters += 1;
  }
  const jumlahPick = chooseParam(rowsFor(evalRows, { mode: "jumlah", pair }), "jumlah", [1, 2, 3], "high");
  if (jumlahPick) { state.jumlahByPair[pair] = resultList(runAnalysis("jumlah", data, jumlahPick.param, { targetPair: pair })); activeFilters += 1; }
  const shioPick = chooseParam(rowsFor(evalRows, { mode: "shio", pair }), "shio", [1, 2, 3], "high");
  if (shioPick) { state.shioByPair[pair] = resultList(runAnalysis("shio", data, shioPick.param, { targetPair: pair })); activeFilters += 1; }

  if (!activeFilters) return null;
  const lines = buildCustomDigitLines({ focus: pair, ...state });
  if (!lines.length) return null;
  return { label: PAIR_LABEL[pair], lines };
}

export async function GET(request: NextRequest) {
  const access = await verifyActiveTelegramSession(request.headers);
  const denied = requireSuperShareAccess(access);
  if (denied) return denied;

  try {
    const search = request.nextUrl.searchParams;
    const cursor = Math.max(0, Number(search.get("cursor") || 0) || 0);
    const rawLimit = Math.max(1, Number(search.get("limit") || DEFAULT_LIMIT) || DEFAULT_LIMIT);
    const limit = Math.min(rawLimit, MAX_LIMIT);
    const requestedIds = String(search.get("marketIds") || "").split(",").map((item) => item.trim()).filter(Boolean);
    const supabase = createAdminClient();
    let query = supabase.from("markets").select("*").order("order", { ascending: true }).range(cursor, cursor + limit - 1);
    if (requestedIds.length) query = query.in("id", requestedIds.slice(0, limit));
    const { data, error } = await query;
    if (error) throw error;
    const markets = ((data || []) as MarketRow[]).map(normalizeMarket).filter((market) => market.id && market.data.length >= 17);
    const rows = [];
    for (const market of markets) {
      const evalRows = await loadEvaluations(supabase, market.id);
      const sections = PAIRS.map((pair) => buildPairSection(pair, market.data, evalRows)).filter(Boolean);
      if (!sections.length) continue;
      rows.push({ marketId: market.id, marketName: market.name, order: market.order, updatedAt: market.updatedAt, sections });
    }
    const nextCursor = requestedIds.length || markets.length < limit ? null : cursor + limit;
    return NextResponse.json({ rows, nextCursor, limit }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat rekap badge.";
    return NextResponse.json({ error: message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
