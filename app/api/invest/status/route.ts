import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { requireActiveAccess } from "@/lib/server/access";
import { NO_STORE_HEADERS } from "@/lib/server/cacheHeaders";
import {
  MAX_LOSS_STREAK_ALLOWED,
  MIN_WINS_15,
  MIN_WINS_LAST_5,
} from "@/lib/analysis/statistics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("market_statistics")
      .select("updated_at")
      .eq("is_active", true)
      .gte("wins_15", MIN_WINS_15)
      .gte("wins_last_5", MIN_WINS_LAST_5)
      .lte("max_loss_streak", MAX_LOSS_STREAK_ALLOWED)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) throw error;

    return NextResponse.json(
      { updatedAt: data?.[0]?.updated_at || null },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("INVEST_STATUS_API_ERROR", error);
    return NextResponse.json(
      { error: "Gagal memuat waktu update Invest" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
