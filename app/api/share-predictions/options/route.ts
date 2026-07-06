import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SnapshotOptionRow = {
  market_id: string | null;
  mode: string | null;
  param: number | null;
  target_pair: string | null;
  analysis_scope: string | null;
  updated_at: string | null;
};

type MarketRow = {
  id: string | null;
};

type ShareOption = {
  key: string;
  mode: string;
  param: number;
  targetPair: string;
  analysisScope: string;
  updatedAt: string | null;
};

const VALID_MODES = new Set(["ai", "ai_parity", "ai_size", "bbfs", "mati", "jumlah", "shio"]);
const VALID_SCOPES = new Set(["default", "4d", "3d", "2d_depan", "2d_tengah", "2d_belakang"]);
const VALID_TARGET_PAIRS = new Set(["depan", "tengah", "belakang"]);
const PAGE_SIZE = 1000;
const MAX_ROWS = 30000;

function optionKey(mode: string, param: number, targetPair: string, analysisScope: string) {
  return `${mode}|${param}|${targetPair}|${analysisScope}`;
}

function key(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isAllowedOption(mode: string, param: number, targetPair: string, analysisScope: string) {
  if (mode === "mati") return analysisScope === "default" && targetPair === "belakang" && [1, 2, 3].includes(param);
  if (mode === "jumlah" || mode === "shio") return analysisScope === "default" && [1, 2, 3].includes(param);
  if (mode === "bbfs") return [7, 8, 9, 10].includes(param);
  return true;
}

function normalizeOption(row: SnapshotOptionRow) {
  const mode = String(row.mode || "");
  const param = Number(row.param || 0);
  const targetPair = String(row.target_pair || "belakang");
  const analysisScope = String(row.analysis_scope || "default");

  if (
    !VALID_MODES.has(mode) ||
    !Number.isFinite(param) ||
    param <= 0 ||
    !VALID_TARGET_PAIRS.has(targetPair) ||
    !VALID_SCOPES.has(analysisScope) ||
    !isAllowedOption(mode, param, targetPair, analysisScope)
  ) {
    return null;
  }

  return { mode, param, targetPair, analysisScope };
}

export async function GET() {
  try {
    const supabase = createAdminClient();
    const options = new Map<string, ShareOption>();

    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("analysis_snapshots")
        .select("market_id,mode,param,target_pair,analysis_scope,updated_at")
        .order("updated_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const rows = (data || []) as SnapshotOptionRow[];
      if (!rows.length) break;

      const ids = Array.from(new Set(rows.map((row) => row.market_id).filter(Boolean).map(String)));
      let activeMarketIds = new Set<string>();

      if (ids.length) {
        const { data: markets, error: marketError } = await supabase
          .from("markets")
          .select("id")
          .in("id", ids);

        if (marketError) throw marketError;
        activeMarketIds = new Set(((markets || []) as MarketRow[]).map((market) => key(market.id)).filter(Boolean));
      }

      for (const row of rows) {
        if (!activeMarketIds.has(key(row.market_id))) continue;

        const normalized = normalizeOption(row);
        if (!normalized) continue;

        const { mode, param, targetPair, analysisScope } = normalized;
        const keyValue = optionKey(mode, param, targetPair, analysisScope);

        if (!options.has(keyValue)) {
          options.set(keyValue, {
            key: keyValue,
            mode,
            param,
            targetPair,
            analysisScope,
            updatedAt: row.updated_at,
          });
        }
      }

      if (rows.length < PAGE_SIZE) break;
    }

    return NextResponse.json(Array.from(options.values()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memuat pilihan share prediksi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
