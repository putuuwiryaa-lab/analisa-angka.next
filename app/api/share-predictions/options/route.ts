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

function optionKey(mode: string, param: number, targetPair: string, analysisScope: string) {
  return `${mode}|${param}|${targetPair}|${analysisScope}`;
}

function isValidOption(row: SnapshotOptionRow): row is Required<SnapshotOptionRow> {
  const mode = String(row.mode || "");
  const param = Number(row.param || 0);
  const targetPair = String(row.target_pair || "belakang");
  const analysisScope = String(row.analysis_scope || "default");

  return (
    VALID_MODES.has(mode) &&
    Number.isFinite(param) &&
    param > 0 &&
    VALID_TARGET_PAIRS.has(targetPair) &&
    VALID_SCOPES.has(analysisScope)
  );
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
    const { data, error } = await supabase
      .from("analysis_snapshots")
      .select("mode,param,target_pair,analysis_scope,updated_at")
      .order("updated_at", { ascending: false })
      .limit(5000);

    if (error) throw error;

    const options = new Map<string, ShareOption>();

    for (const row of (data || []) as SnapshotOptionRow[]) {
      if (!isValidOption(row)) continue;

      const mode = row.mode;
      const param = Number(row.param);
      const targetPair = row.target_pair || "belakang";
      const analysisScope = row.analysis_scope || "default";
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

    return NextResponse.json(Array.from(options.values()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memuat pilihan share prediksi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
