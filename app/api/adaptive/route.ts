import { NextResponse } from "next/server";
import { runAdaptiveFoundation } from "@/lib/adaptive/engine";
import { isAdaptiveMethod, isAdaptiveTarget } from "@/lib/adaptive/types";
import { HistoryDataFormatError, parseStrictHistory } from "@/lib/engine/history";
import { requireActiveAccess } from "@/lib/server/access";
import { NO_STORE_HEADERS } from "@/lib/server/cacheHeaders";
import { createAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status, headers: NO_STORE_HEADERS });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const marketId = String(body?.marketId ?? "").trim();
    const method = body?.method;
    const target2D = body?.target2D;
    const digitCount = Number(body?.digitCount);

    if (!marketId) return NextResponse.json({ error: "Pilih pasaran dulu." }, { status: 400, headers: NO_STORE_HEADERS });
    if (!isAdaptiveMethod(method)) return NextResponse.json({ error: "Metode Adaptive tidak valid." }, { status: 400, headers: NO_STORE_HEADERS });
    if (!isAdaptiveTarget(target2D)) return NextResponse.json({ error: "Target 2D Adaptive tidak valid." }, { status: 400, headers: NO_STORE_HEADERS });
    if (!Number.isInteger(digitCount) || digitCount < 1 || digitCount > 9) {
      return NextResponse.json({ error: "Jumlah digit harus antara 1 dan 9." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("markets")
      .select("id,name,history_data")
      .eq("id", marketId)
      .single();

    if (error) throw error;
    if (!data?.history_data) {
      return NextResponse.json({ error: "Pasaran ini belum punya data keluaran." }, { status: 404, headers: NO_STORE_HEADERS });
    }

    const draws = parseStrictHistory(data.history_data);
    const prediction = runAdaptiveFoundation(draws, target2D, method, digitCount);

    return NextResponse.json(
      {
        market: String(data.name),
        result: {
          engineVersion: prediction.engineVersion,
          configVersion: prediction.configVersion,
          target2D: prediction.target2D,
          historyLength: prediction.historyLength,
          latestDraw: prediction.latestDraw,
          digits: prediction.selection.digits,
          method: prediction.selection.method,
          digitCount: prediction.selection.digitCount,
          estimatedSuccess: prediction.selection.estimatedSuccess,
          baselineSuccess: prediction.selection.baselineSuccess,
          lift: prediction.selection.lift,
          selectionMargin: prediction.selection.selectionMargin,
          signalStrength: prediction.signalStrength,
          persistence: { status: "not_configured" as const },
        },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof HistoryDataFormatError) {
      return NextResponse.json({ error: error.message }, { status: 422, headers: NO_STORE_HEADERS });
    }

    console.error("[api/adaptive] Request error", error);
    const message = error instanceof Error ? error.message : "Adaptive gagal.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
