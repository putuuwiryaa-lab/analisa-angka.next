import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { CustomFocus } from "@/lib/analysis/customDigit";
import { buildCustomRekapRecommendations, resolveCustomRekapMarketIds } from "@/lib/server/customRekapRecommendations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_FOCUS = new Set(["depan", "tengah", "belakang", "3d", "4d"]);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseKey) throw new Error("Konfigurasi Supabase belum lengkap.");

    const marketId = safeDecode(request.nextUrl.searchParams.get("marketId") || "").trim();
    const customFocus = request.nextUrl.searchParams.get("customFocus") as CustomFocus;

    if (!marketId) throw new Error("marketId kosong.");
    if (!VALID_FOCUS.has(customFocus || "")) throw new Error("Focus custom digit tidak valid.");

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const marketIds = await resolveCustomRekapMarketIds(supabase, marketId);
    const badges = await buildCustomRekapRecommendations(supabase, marketIds, customFocus);

    return NextResponse.json(badges, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("RECOMMENDATIONS_API_ERROR", e);
    return NextResponse.json({ error: "Gagal memuat rekomendasi" }, { status: 500 });
  }
}
