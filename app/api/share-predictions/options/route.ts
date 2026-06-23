import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { verifyActiveTelegramSession } from "@/lib/server/telegram-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SnapshotOptionRow = {
  mode: string | null;
  param: number | null;
  target_pair: string | null;
  analysis_scope: string | null;
  updated_at: string | null;
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

export async function GET(request: Request) {
  const access = await verifyActiveTelegramSession(request.headers);

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const supabase = createAdminClient();
    const options = new Map<string, ShareOption>();

    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("analysis_snapshots")
        .select("mode,param,target_pair,analysis_scope,updated_at")
        .order("updated_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const rows = (data || []) as SnapshotOptionRow[];
      if (!rows.length) break;

      for (const row of rows) {
        const normalized = normalizeOption(row);
        if (!normalized) continue;

        const { mode, param, targetPair, analysisScope } = normalized;
        const key = optionKey(mode, param, targetPair, analysisScope);

        if (!options.has(key)) {
          options.set(key, {
            key,
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
