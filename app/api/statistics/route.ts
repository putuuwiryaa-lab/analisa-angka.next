import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  MARKET_STAT_SELECT,
  MAX_LOSS_STREAK_ALLOWED,
  MIN_WINS_15,
  MIN_WINS_LAST_5,
  aiParamGroupKey,
  aiParamStatParam,
  aiScopeMeta,
  bbfsScopeMeta,
  type AiStatScope,
  type AnalysisScope,
  type MarketStatistic,
  type RelatedStatsMap,
  type TargetPair,
  type VisibleCategoryKey,
} from "@/lib/analysis/statistics";
import { verifyActiveTelegramSession } from "@/lib/server/telegram-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set(["ai", "bbfs", "off_digit", "off_jumlah", "off_shio"]);
const VALID_TARGET_PAIRS = new Set(["depan", "tengah", "belakang"]);
const VALID_AI_SCOPES = new Set(["4d", "3d", "2d_depan", "2d_tengah", "2d_belakang"]);
const VALID_ANALYSIS_SCOPES = new Set(["default", "4d", "3d", "2d_depan", "2d_tengah", "2d_belakang"]);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function parseCategory(value: string | null): VisibleCategoryKey {
  return VALID_CATEGORIES.has(value || "") ? (value as VisibleCategoryKey) : "ai";
}

function parseTargetPair(value: string | null): TargetPair {
  return VALID_TARGET_PAIRS.has(value || "") ? (value as TargetPair) : "belakang";
}

function parseAiScope(value: string | null): AiStatScope {
  return VALID_AI_SCOPES.has(value || "") ? (value as AiStatScope) : "2d_depan";
}

function parseAnalysisScope(value: string | null): AnalysisScope {
  return VALID_ANALYSIS_SCOPES.has(value || "") ? (value as AnalysisScope) : "2d_belakang";
}

export async function GET(request: NextRequest) {
  try {
    const access = await verifyActiveTelegramSession(request.headers);

    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!supabaseUrl || !supabaseKey) throw new Error("Konfigurasi Supabase belum lengkap.");

    const search = request.nextUrl.searchParams;
    const category = parseCategory(search.get("category"));
    const targetPair = parseTargetPair(search.get("targetPair"));
    const aiScope = parseAiScope(search.get("aiScope"));
    const bbfsScope = parseAnalysisScope(search.get("bbfsScope"));
    const param = Number(search.get("param") || 0);

    if (!Number.isFinite(param) || param <= 0) throw new Error("Parameter statistik tidak valid.");

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const isPositionCategory = category === "off_digit";
    const isBBFSCategory = category === "bbfs";
    const isAICategory = category === "ai";
    const isPairCategory = category === "off_digit" || category === "off_jumlah" || category === "off_shio";

    const selectedBBFS = bbfsScopeMeta(bbfsScope);
    const selectedAI = aiScopeMeta(aiScope);
    const queryGroupKey = isAICategory ? aiParamGroupKey(param) : category;
    const queryParam = isAICategory ? aiParamStatParam(param) : param;

    let query = supabase
      .from("market_statistics")
      .select(MARKET_STAT_SELECT)
      .eq("is_active", true)
      .eq("group_key", queryGroupKey)
      .gte("wins_15", MIN_WINS_15)
      .gte("wins_last_5", MIN_WINS_LAST_5)
      .lte("max_loss_streak", MAX_LOSS_STREAK_ALLOWED)
      .order("score", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(200);

    if (isPositionCategory) {
      query = query.eq("mode", "mati_2d").eq("param", queryParam).eq("target_pair", targetPair).eq("analysis_scope", "default");
    } else if (isBBFSCategory) {
      query = query.eq("mode", "bbfs").eq("param", queryParam).eq("target_pair", selectedBBFS.targetPair).eq("analysis_scope", bbfsScope);
    } else if (isAICategory) {
      query = query.eq("param", queryParam).eq("target_pair", selectedAI.targetPair).eq("analysis_scope", selectedAI.analysisScope);
    } else {
      query = query.eq("param", queryParam).eq("analysis_scope", "default");
    }

    if (isPairCategory) query = query.eq("target_pair", targetPair);

    const { data, error } = await query;
    if (error) throw error;

    const rankingRows = (data || []) as MarketStatistic[];
    const marketIds = Array.from(new Set(rankingRows.map((item) => item.market_id).filter(Boolean)));

    if (!marketIds.length) {
      return NextResponse.json({ items: rankingRows, relatedStats: {} }, { headers: { "Cache-Control": "no-store" } });
    }

    const { data: relatedData, error: relatedError } = await supabase
      .from("market_statistics")
      .select(MARKET_STAT_SELECT)
      .eq("is_active", true)
      .in("market_id", marketIds)
      .gte("wins_15", MIN_WINS_15)
      .gte("wins_last_5", MIN_WINS_LAST_5)
      .lte("max_loss_streak", MAX_LOSS_STREAK_ALLOWED)
      .order("score", { ascending: false })
      .limit(1000);

    if (relatedError) throw relatedError;

    const relatedStats = ((relatedData || []) as MarketStatistic[])
      .filter((row) => row.group_key !== "off_digit" || row.mode === "mati_2d")
      .reduce<RelatedStatsMap>((acc, row) => {
        (acc[row.market_id] ||= []).push(row);
        return acc;
      }, {});

    return NextResponse.json(
      { items: rankingRows, relatedStats },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal memuat statistik pasaran";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
