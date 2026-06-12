import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyActiveTelegramSession } from "@/lib/server/telegram-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EvaluationMode = "ai" | "ai_parity" | "ai_size" | "bbfs" | "mati" | "jumlah" | "shio";
type AnalysisScope = "default" | "4d" | "3d" | "2d_depan" | "2d_tengah" | "2d_belakang";
type TargetPair = "depan" | "tengah" | "belakang";

const LIMIT = 15;
const VALID_MODES = new Set(["ai", "ai_parity", "ai_size", "bbfs", "mati", "jumlah", "shio"]);
const VALID_SCOPES = new Set(["default", "4d", "3d", "2d_depan", "2d_tengah", "2d_belakang"]);
const VALID_TARGET_PAIRS = new Set(["depan", "tengah", "belakang"]);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

export async function GET(request: NextRequest) {
  const access = await verifyActiveTelegramSession(request.headers);

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Konfigurasi Supabase belum lengkap.");
    }

    const search = request.nextUrl.searchParams;
    const marketId = safeDecode(search.get("marketId") || "").trim();
    const mode = (search.get("mode") || "") as EvaluationMode;
    const param = Number(search.get("param") || 0);
    const position = search.get("position") || "all";
    const targetPair = (search.get("targetPair") || "belakang") as TargetPair;
    const analysisScope = (search.get("analysisScope") || "default") as AnalysisScope;

    if (!marketId) {
      throw new Error("marketId kosong.");
    }

    if (!VALID_MODES.has(mode)) {
      throw new Error("Mode evaluasi tidak valid.");
    }

    if (!Number.isFinite(param) || param <= 0) {
      throw new Error("Param evaluasi tidak valid.");
    }

    if (!VALID_TARGET_PAIRS.has(targetPair)) {
      throw new Error("Target pair tidak valid.");
    }

    if (!VALID_SCOPES.has(analysisScope)) {
      throw new Error("Analysis scope tidak valid.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const ids = new Set(marketCandidates(marketId));

    const { data: markets } = await supabase
      .from("markets")
      .select("id,name")
      .in("id", Array.from(ids));

    for (const market of markets || []) {
      if (market?.id) ids.add(String(market.id));
      if (market?.name) ids.add(String(market.name));
    }

    let query = supabase
      .from("analysis_evaluations")
      .select("id,from_result,new_result,is_hit,status,detail,evaluated_at,position,target_pair,analysis_scope,market_id")
      .in("market_id", Array.from(ids))
      .eq("mode", mode)
      .eq("param", param)
      .order("evaluated_at", { ascending: false })
      .limit(LIMIT);

    if (position && position !== "all") {
      query = query.eq("position", position);
    }

    if (mode !== "mati") {
      query = query.eq("target_pair", targetPair);
    }

    if (shouldUseAi2DScopeFallback(mode, analysisScope)) {
      query = query.in("analysis_scope", ["default", legacyAi2DScope(targetPair)]);
    } else {
      query = query.eq("analysis_scope", analysisScope);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json(data || [], {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal memuat riwayat evaluasi";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
