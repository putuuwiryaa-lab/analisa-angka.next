import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { NO_STORE_HEADERS, PRIVATE_MEDIUM_CACHE_HEADERS } from "@/lib/server/cacheHeaders";
import { requireActiveAccess } from "@/lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EvaluationMode = "ai" | "ai_parity" | "ai_size" | "bbfs" | "mati" | "jumlah" | "shio";
type AnalysisScope = "default" | "4d" | "3d" | "2d_depan" | "2d_tengah" | "2d_belakang";
type TargetPair = "depan" | "tengah" | "belakang";
type MarketRow = { id?: string | null; name?: string | null };

const LIMIT = 15;
const VALID_MODES = new Set(["ai", "ai_parity", "ai_size", "bbfs", "mati", "jumlah", "shio"]);
const VALID_SCOPES = new Set(["default", "4d", "3d", "2d_depan", "2d_tengah", "2d_belakang"]);
const VALID_TARGET_PAIRS = new Set(["depan", "tengah", "belakang"]);

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeKey(value: string) {
  return safeDecode(value).trim().toLowerCase();
}

function marketCandidates(value: string) {
  const decoded = safeDecode(value).trim();
  const encoded = encodeURIComponent(decoded);

  return Array.from(
    new Set([value, decoded, encoded, decoded.toUpperCase(), decoded.toLowerCase()].filter(Boolean)),
  );
}

function legacyAi2DScope(targetPair: TargetPair): AnalysisScope {
  return `2d_${targetPair}` as AnalysisScope;
}

function shouldUseAi2DScopeFallback(mode: EvaluationMode, analysisScope: AnalysisScope) {
  return mode === "ai" && analysisScope !== "3d" && analysisScope !== "4d";
}

async function resolveMarketIds(supabase: ReturnType<typeof createAdminClient>, marketId: string) {
  const ids = new Set(marketCandidates(marketId));
  const normalizedIds = new Set(Array.from(ids).map(normalizeKey));

  const { data, error } = await supabase.from("markets").select("id,name");
  if (error) throw error;

  for (const market of ((data || []) as MarketRow[])) {
    const id = String(market.id || "").trim();
    const name = String(market.name || "").trim();
    if (!id && !name) continue;

    if (normalizedIds.has(normalizeKey(id)) || normalizedIds.has(normalizeKey(name))) {
      if (id) ids.add(id);
      if (name) ids.add(name);
    }
  }

  return Array.from(ids).filter(Boolean);
}

export async function GET(request: NextRequest) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers: NO_STORE_HEADERS });

  try {
    const search = request.nextUrl.searchParams;
    const marketId = safeDecode(search.get("marketId") || "").trim();
    const mode = (search.get("mode") || "") as EvaluationMode;
    const param = Number(search.get("param") || 0);
    const position = search.get("position") || "all";
    const targetPair = (search.get("targetPair") || "belakang") as TargetPair;
    const analysisScope = (search.get("analysisScope") || "default") as AnalysisScope;

    if (!marketId) throw new Error("marketId kosong.");
    if (!VALID_MODES.has(mode)) throw new Error("Mode evaluasi tidak valid.");
    if (!Number.isFinite(param) || param <= 0) throw new Error("Param evaluasi tidak valid.");
    if (!VALID_TARGET_PAIRS.has(targetPair)) throw new Error("Target pair tidak valid.");
    if (!VALID_SCOPES.has(analysisScope)) throw new Error("Analysis scope tidak valid.");

    const supabase = createAdminClient();
    const marketIds = await resolveMarketIds(supabase, marketId);

    let query = supabase
      .from("analysis_evaluations")
      .select("id,from_result,new_result,is_hit,status,detail,evaluated_at,position,target_pair,analysis_scope,market_id")
      .in("market_id", marketIds)
      .eq("mode", mode)
      .eq("param", param)
      .order("evaluated_at", { ascending: false })
      .limit(LIMIT);

    if (position && position !== "all") query = query.eq("position", position);
    if (mode !== "mati") query = query.eq("target_pair", targetPair);

    if (shouldUseAi2DScopeFallback(mode, analysisScope)) {
      query = query.in("analysis_scope", ["default", legacyAi2DScope(targetPair)]);
    } else {
      query = query.eq("analysis_scope", analysisScope);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || [], {
      headers: PRIVATE_MEDIUM_CACHE_HEADERS,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal memuat riwayat evaluasi";

    return NextResponse.json(
      { error: message },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
