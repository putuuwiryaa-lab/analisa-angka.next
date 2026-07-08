import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { runAnalysis } from "@/lib/server/engines/predictionEngine";
import { buildCustomDigitLines, type TargetPair } from "@/lib/analysis/customDigit";
import type { RecommendedMap } from "@/lib/analysis/recommendations";
import { buildCustomRekapRecommendations, resolveCustomRekapMarketIds } from "@/lib/server/customRekapRecommendations";
import { requireActiveAccess } from "@/lib/server/access";
import { NO_STORE_HEADERS } from "@/lib/server/cacheHeaders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

const PAIRS: TargetPair[] = ["depan", "tengah", "belakang"];
const PAIR_LABEL: Record<TargetPair, string> = { depan: "2D Depan", tengah: "2D Tengah", belakang: "2D Belakang" };
const PAIR_POSITIONS: Record<TargetPair, Array<"AS" | "KOP" | "KEPALA" | "EKOR">> = {
  depan: ["AS", "KOP"],
  tengah: ["KOP", "KEPALA"],
  belakang: ["KEPALA", "EKOR"],
};
const POSITION_KEY: Record<"AS" | "KOP" | "KEPALA" | "EKOR", "as" | "kop" | "kepala" | "ekor"> = { AS: "as", KOP: "kop", KEPALA: "kepala", EKOR: "ekor" };
const POSITION_PROP: Record<"AS" | "KOP" | "KEPALA" | "EKOR", "offAs" | "offKop" | "offKepala" | "offEkor"> = { AS: "offAs", KOP: "offKop", KEPALA: "offKepala", EKOR: "offEkor" };

type MarketRow = Record<string, unknown>;
type FilterState = {
  aiByPair: Partial<Record<TargetPair, number[]>>;
  aiParityByPair: Partial<Record<TargetPair, string>>;
  aiSizeByPair: Partial<Record<TargetPair, string>>;
  bbfsByPair: Partial<Record<TargetPair, number[]>>;
  offAs: number[];
  offKop: number[];
  offKepala: number[];
  offEkor: number[];
  jumlahByPair: Partial<Record<TargetPair, number[]>>;
  shioByPair: Partial<Record<TargetPair, number[]>>;
};

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

function hasBadge(badges: RecommendedMap, key: string) {
  return badges[key] === "fire" || badges[key] === "thumb";
}

function chooseBadgeParam(badges: RecommendedMap, keyForParam: (param: number) => string, params: number[], prefer: "low" | "high") {
  const fire = params.filter((param) => badges[keyForParam(param)] === "fire");
  const thumb = params.filter((param) => badges[keyForParam(param)] === "thumb");
  const pool = fire.length ? fire : thumb;
  if (!pool.length) return null;
  return prefer === "low" ? Math.min(...pool) : Math.max(...pool);
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

function runAi(data: string[], pair: TargetPair, param: number) {
  return runAnalysis("ai", data, param, { targetPair: pair, analysisScope: "default" });
}

function runBbfs(data: string[], pair: TargetPair, param: number) {
  return runAnalysis("ai", data, param, { targetPair: pair, analysisScope: `2d_${pair}` as any, forceDigitResult: true });
}

function runMatiCached(cache: Map<number, any>, data: string[], param: number) {
  if (!cache.has(param)) cache.set(param, runAnalysis("mati", data, param));
  return cache.get(param);
}

function addPositionOff(state: FilterState, position: "AS" | "KOP" | "KEPALA" | "EKOR", value: number[]) {
  state[POSITION_PROP[position]] = value;
}

function buildPairSection(pair: TargetPair, data: string[], badges: RecommendedMap) {
  const state: FilterState = {
    aiByPair: {},
    aiParityByPair: {},
    aiSizeByPair: {},
    bbfsByPair: {},
    offAs: [],
    offKop: [],
    offKepala: [],
    offEkor: [],
    jumlahByPair: {},
    shioByPair: {},
  };
  let activeFilters = 0;
  const matiCache = new Map<number, any>();

  const aiParam = chooseBadgeParam(badges, (param) => `ai-${pair}-${param}`, [2, 4, 6], "low");
  if (aiParam) {
    state.aiByPair[pair] = resultList(runAi(data, pair, aiParam));
    activeFilters += 1;
  }

  if (hasBadge(badges, `ai-${pair}-7`)) {
    state.aiParityByPair[pair] = firstText(runAi(data, pair, 7));
    activeFilters += 1;
  }

  if (hasBadge(badges, `ai-${pair}-8`)) {
    state.aiSizeByPair[pair] = firstText(runAi(data, pair, 8));
    activeFilters += 1;
  }

  const bbfsFilters: number[][] = [];
  const bbfsParam = chooseBadgeParam(badges, (param) => `bbfs-${pair}-${param}`, [7, 8, 9], "low");
  if (bbfsParam) {
    bbfsFilters.push(resultList(runBbfs(data, pair, bbfsParam)));
    activeFilters += 1;
  }

  if (hasBadge(badges, `bbfs-${pair}-10`)) {
    bbfsFilters.push(resultList(runBbfs(data, pair, 10)));
    activeFilters += 1;
  }

  if (bbfsFilters.length) state.bbfsByPair[pair] = intersectDigitLists(bbfsFilters);

  for (const position of PAIR_POSITIONS[pair]) {
    const positionKey = POSITION_KEY[position];
    const param = chooseBadgeParam(badges, (item) => `${positionKey}-${item}`, [1, 2, 3], "high");
    if (!param) continue;
    const result = runMatiCached(matiCache, data, param);
    addPositionOff(state, position, resultList((result as any)?.data?.[position] || (result as any)?.[position]));
    activeFilters += 1;
  }

  const jumlahParam = chooseBadgeParam(badges, (param) => `jumlah-${pair}-${param}`, [1, 2, 3], "high");
  if (jumlahParam) {
    state.jumlahByPair[pair] = resultList(runAnalysis("jumlah", data, jumlahParam, { targetPair: pair }));
    activeFilters += 1;
  }

  const shioParam = chooseBadgeParam(badges, (param) => `shio-${pair}-${param}`, [1, 2, 3], "high");
  if (shioParam) {
    state.shioByPair[pair] = resultList(runAnalysis("shio", data, shioParam, { targetPair: pair }));
    activeFilters += 1;
  }

  if (!activeFilters) return null;
  const lines = buildCustomDigitLines({ focus: pair, ...state });
  if (!lines.length) return null;
  return { label: PAIR_LABEL[pair], lines };
}

export async function GET(request: NextRequest) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status, headers: NO_STORE_HEADERS });
  }

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
      const marketIds = await resolveCustomRekapMarketIds(supabase, market.id);
      const sections = [];

      for (const pair of PAIRS) {
        const badges = await buildCustomRekapRecommendations(supabase, marketIds, pair);
        const section = buildPairSection(pair, market.data, badges);
        if (section) sections.push(section);
      }

      if (!sections.length) continue;
      rows.push({ marketId: market.id, marketName: market.name, order: market.order, updatedAt: market.updatedAt, sections });
    }

    const nextCursor = requestedIds.length || markets.length < limit ? null : cursor + limit;
    return NextResponse.json({ rows, nextCursor, limit }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat rekap badge.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
