import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { requireActiveAccess } from "@/lib/server/access";
import { NO_STORE_HEADERS, PRIVATE_MEDIUM_CACHE_HEADERS } from "@/lib/server/cacheHeaders";
import {
  MARKET_STAT_SELECT,
  MAX_LOSS_STREAK_ALLOWED,
  MIN_WINS_LAST_5,
  aiParamGroupKey,
  aiParamStatParam,
  aiScopeMeta,
  bbfsScopeMeta,
  isAiFamilyCategory,
  type AiStatScope,
  type AnalysisScope,
  type MarketStatistic,
  type MatiPosition,
  type RelatedStatsMap,
  type TargetPair,
  type VisibleCategoryKey,
} from "@/lib/analysis/statistics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set(["ai", "ai_parity", "ai_size", "bbfs", "off_digit", "off_jumlah", "off_shio"]);
const VALID_TARGET_PAIRS = new Set(["depan", "tengah", "belakang"]);
const VALID_MATI_POSITIONS = new Set(["as", "kop", "kepala", "ekor"]);
const VALID_AI_SCOPES = new Set(["4d", "3d", "2d_depan", "2d_tengah", "2d_belakang"]);
const VALID_ANALYSIS_SCOPES = new Set(["default", "4d", "3d", "2d_depan", "2d_tengah", "2d_belakang"]);

const STATISTICS_MIN_WINS_15 = 12;
const STATISTICS_SERVER_CACHE_TTL_MS = 60 * 1000;
const STATISTICS_SERVER_CACHE_MAX_ENTRIES = 96;

type StatisticsRequest = {
  category: VisibleCategoryKey;
  targetPair: TargetPair;
  matiPosition: MatiPosition;
  aiScope: AiStatScope;
  bbfsScope: AnalysisScope;
  param: number;
};

type StatisticsPayload = {
  items: MarketStatistic[];
  relatedStats: RelatedStatsMap;
};

type StatisticsCacheEntry = {
  expiresAt: number;
  value: StatisticsPayload;
};

const statisticsCache = new Map<string, StatisticsCacheEntry>();
const statisticsInFlight = new Map<string, Promise<StatisticsPayload>>();

function parseCategory(value: string | null): VisibleCategoryKey {
  return VALID_CATEGORIES.has(value || "") ? (value as VisibleCategoryKey) : "ai";
}

function parseTargetPair(value: string | null): TargetPair {
  return VALID_TARGET_PAIRS.has(value || "") ? (value as TargetPair) : "belakang";
}

function parseMatiPosition(value: string | null): MatiPosition {
  return VALID_MATI_POSITIONS.has(value || "") ? (value as MatiPosition) : "as";
}

function parseAiScope(value: string | null): AiStatScope {
  return VALID_AI_SCOPES.has(value || "") ? (value as AiStatScope) : "2d_depan";
}

function parseAnalysisScope(value: string | null): AnalysisScope {
  return VALID_ANALYSIS_SCOPES.has(value || "") ? (value as AnalysisScope) : "2d_belakang";
}

function normalizeAiParam(category: VisibleCategoryKey, param: number) {
  if (category === "ai_parity") return 7;
  if (category === "ai_size") return 8;
  return param;
}

function readStatisticsRequest(request: NextRequest): StatisticsRequest {
  const search = request.nextUrl.searchParams;
  const category = parseCategory(search.get("category"));
  const rawParam = Number(search.get("param") || 0);
  const param = normalizeAiParam(category, rawParam);
  if (!Number.isFinite(param) || param <= 0) throw new Error("Parameter statistik tidak valid.");

  return {
    category,
    targetPair: parseTargetPair(search.get("targetPair")),
    matiPosition: parseMatiPosition(search.get("matiPosition")),
    aiScope: parseAiScope(search.get("aiScope")),
    bbfsScope: parseAnalysisScope(search.get("bbfsScope")),
    param,
  };
}

function statisticsCacheKey(input: StatisticsRequest) {
  return [input.category, input.targetPair, input.matiPosition, input.aiScope, input.bbfsScope, input.param].join(":");
}

function storeStatisticsCache(key: string, value: StatisticsPayload) {
  if (statisticsCache.size >= STATISTICS_SERVER_CACHE_MAX_ENTRIES && !statisticsCache.has(key)) {
    const oldest = statisticsCache.keys().next().value;
    if (typeof oldest === "string") statisticsCache.delete(oldest);
  }
  statisticsCache.delete(key);
  statisticsCache.set(key, { value, expiresAt: Date.now() + STATISTICS_SERVER_CACHE_TTL_MS });
}

async function loadStatistics(input: StatisticsRequest): Promise<StatisticsPayload> {
  const key = statisticsCacheKey(input);
  const now = Date.now();
  const cached = statisticsCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;
  if (cached) statisticsCache.delete(key);

  const pending = statisticsInFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
    const supabase = createAdminClient();
    const isPositionCategory = input.category === "off_digit";
    const isBBFSCategory = input.category === "bbfs";
    const isAiCategory = isAiFamilyCategory(input.category);
    const isPairCategory = input.category === "off_jumlah" || input.category === "off_shio";

    const selectedBBFS = bbfsScopeMeta(input.bbfsScope);
    const selectedAI = aiScopeMeta(input.aiScope);
    const queryGroupKey = input.category === "ai" ? aiParamGroupKey(input.param) : input.category;
    const queryParam = isAiCategory ? aiParamStatParam(input.param) : input.param;

    let query = supabase
      .from("market_statistics")
      .select(MARKET_STAT_SELECT)
      .eq("is_active", true)
      .eq("group_key", queryGroupKey)
      .gte("wins_15", STATISTICS_MIN_WINS_15)
      .gte("wins_last_5", MIN_WINS_LAST_5)
      .lte("max_loss_streak", MAX_LOSS_STREAK_ALLOWED)
      .order("score", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(200);

    if (isPositionCategory) {
      query = query
        .eq("mode", "mati")
        .eq("param", queryParam)
        .eq("position", input.matiPosition)
        .eq("target_pair", "all")
        .eq("analysis_scope", "default");
    } else if (isBBFSCategory) {
      query = query
        .eq("mode", "bbfs")
        .eq("param", queryParam)
        .eq("target_pair", selectedBBFS.targetPair)
        .eq("analysis_scope", input.bbfsScope);
    } else if (isAiCategory) {
      query = query
        .eq("param", queryParam)
        .eq("target_pair", selectedAI.targetPair)
        .eq("analysis_scope", selectedAI.analysisScope);
    } else {
      query = query.eq("param", queryParam).eq("analysis_scope", "default");
    }

    if (isPairCategory) query = query.eq("target_pair", input.targetPair);

    const { data, error } = await query;
    if (error) throw error;

    const rankingRows = (data || []) as MarketStatistic[];
    const marketIds = Array.from(new Set(rankingRows.map((item) => item.market_id).filter(Boolean)));

    if (!marketIds.length) {
      const value = { items: rankingRows, relatedStats: {} } satisfies StatisticsPayload;
      storeStatisticsCache(key, value);
      return value;
    }

    const { data: relatedData, error: relatedError } = await supabase
      .from("market_statistics")
      .select(MARKET_STAT_SELECT)
      .eq("is_active", true)
      .in("market_id", marketIds)
      .gte("wins_15", STATISTICS_MIN_WINS_15)
      .gte("wins_last_5", MIN_WINS_LAST_5)
      .lte("max_loss_streak", MAX_LOSS_STREAK_ALLOWED)
      .order("score", { ascending: false })
      .limit(1000);

    if (relatedError) throw relatedError;

    const relatedStats = ((relatedData || []) as MarketStatistic[])
      .filter((row) => row.group_key !== "off_digit" || row.mode === "mati")
      .reduce<RelatedStatsMap>((acc, row) => {
        (acc[row.market_id] ||= []).push(row);
        return acc;
      }, {});

    const value = { items: rankingRows, relatedStats } satisfies StatisticsPayload;
    storeStatisticsCache(key, value);
    return value;
  })();

  statisticsInFlight.set(key, request);
  try {
    return await request;
  } finally {
    statisticsInFlight.delete(key);
  }
}

export async function GET(request: NextRequest) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const input = readStatisticsRequest(request);
    return NextResponse.json(await loadStatistics(input), {
      headers: PRIVATE_MEDIUM_CACHE_HEADERS,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal memuat statistik pasaran";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
