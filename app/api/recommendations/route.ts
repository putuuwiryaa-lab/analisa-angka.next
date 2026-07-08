import { NextRequest, NextResponse } from "next/server";
import type { CustomFocus } from "@/lib/analysis/customDigit";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { buildCustomRekapRecommendations, resolveCustomRekapMarketIds } from "@/lib/server/customRekapRecommendations";
import { NO_STORE_HEADERS } from "@/lib/server/cacheHeaders";
import { requireActiveAccess } from "@/lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_FOCUS = new Set(["depan", "tengah", "belakang", "3d", "4d"]);

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function GET(request: NextRequest) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers: NO_STORE_HEADERS });

  try {
    const marketId = safeDecode(request.nextUrl.searchParams.get("marketId") || "").trim();
    const customFocus = request.nextUrl.searchParams.get("customFocus") as CustomFocus;

    if (!marketId) throw new Error("marketId kosong.");
    if (!VALID_FOCUS.has(customFocus || "")) throw new Error("Focus custom digit tidak valid.");

    const supabase = createAdminClient();
    const marketIds = await resolveCustomRekapMarketIds(supabase, marketId);
    const badges = await buildCustomRekapRecommendations(supabase, marketIds, customFocus);

    return NextResponse.json(badges, { headers: NO_STORE_HEADERS });
  } catch (e) {
    console.error("RECOMMENDATIONS_API_ERROR", e);
    return NextResponse.json({ error: "Gagal memuat rekomendasi" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
