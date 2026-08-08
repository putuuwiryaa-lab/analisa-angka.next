import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { requireActiveAccess } from "@/lib/server/access";
import { NO_STORE_HEADERS } from "@/lib/server/cacheHeaders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SnapshotRow = {
  market_id: string | null;
  market_name: string | null;
  base_result: string | null;
  result: unknown;
  updated_at: string | null;
};

type MarketRow = {
  id: string | null;
  name: string | null;
  order: number | null;
};

const VALID_MODES = new Set(["ai", "ai_parity", "ai_size", "bbfs", "mati", "jumlah", "shio"]);
const VALID_SCOPES = new Set(["default", "4d", "3d", "2d_depan", "2d_tengah", "2d_belakang"]);
const VALID_TARGET_PAIRS = new Set(["depan", "tengah", "belakang"]);

function key(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isAllowedOption(mode: string, param: number, targetPair: string, analysisScope: string) {
  if (mode === "mati") return analysisScope === "default" && targetPair === "belakang" && [1, 2, 3].includes(param);
  if (mode === "jumlah" || mode === "shio") return analysisScope === "default" && [1, 2, 3].includes(param);
  if (mode === "bbfs") return [7, 8, 9, 10].includes(param);
  return true;
}

function readParams(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const mode = search.get("mode") || "";
  const param = Number(search.get("param") || 0);
  const targetPair = search.get("targetPair") || "belakang";
  const analysisScope = search.get("analysisScope") || "default";

  if (!VALID_MODES.has(mode)) throw new Error("Mode tidak valid.");
  if (!Number.isFinite(param) || param <= 0) throw new Error("Param tidak valid.");
  if (!VALID_TARGET_PAIRS.has(targetPair)) throw new Error("Target tidak valid.");
  if (!VALID_SCOPES.has(analysisScope)) throw new Error("Scope tidak valid.");
  if (!isAllowedOption(mode, param, targetPair, analysisScope)) throw new Error("Pilihan prediksi tidak aktif.");

  return { mode, param, targetPair, analysisScope };
}

export async function GET(request: NextRequest) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status, headers: NO_STORE_HEADERS });
  }

  try {
    const { mode, param, targetPair, analysisScope } = readParams(request);
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("analysis_snapshots")
      .select("market_id,market_name,base_result,result,updated_at")
      .eq("mode", mode)
      .eq("param", param)
      .eq("target_pair", targetPair)
      .eq("analysis_scope", analysisScope)
      .order("updated_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    const snapshots = ((data || []) as SnapshotRow[]).filter((row) => row.market_id);
    const ids = Array.from(new Set(snapshots.map((row) => String(row.market_id))));

    let markets: MarketRow[] = [];
    if (ids.length) {
      const { data: marketRows, error: marketError } = await supabase
        .from("markets")
        .select("id,name,order")
        .in("id", ids);

      if (marketError) throw marketError;
      markets = (marketRows || []) as MarketRow[];
    }

    const marketMap = new Map<string, MarketRow>();
    markets.forEach((market) => marketMap.set(key(market.id), market));

    const rows = snapshots
      .sort((a, b) => {
        const aMarket = marketMap.get(key(a.market_id));
        const bMarket = marketMap.get(key(b.market_id));
        const aOrder = aMarket?.order ?? 9999;
        const bOrder = bMarket?.order ?? 9999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return String(aMarket?.name || a.market_name || a.market_id || "").localeCompare(
          String(bMarket?.name || b.market_name || b.market_id || ""),
          "id",
        );
      })
      .map((row) => {
        const market = marketMap.get(key(row.market_id));
        return {
          marketId: row.market_id,
          marketName: market?.name || row.market_name || row.market_id,
          baseResult: row.base_result,
          result: row.result,
          updatedAt: row.updated_at,
          order: market?.order ?? null,
        };
      });

    return NextResponse.json(
      { mode, param, targetPair, analysisScope, rows },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memuat data.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
