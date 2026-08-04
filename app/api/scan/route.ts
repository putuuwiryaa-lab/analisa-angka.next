import { NextResponse } from "next/server";
import { runAdaptiveFoundation } from "@/lib/adaptive/engine";
import { persistAdaptivePrediction } from "@/lib/adaptive/persistence";
import { isAdaptiveMethod, isAdaptiveTarget } from "@/lib/adaptive/types";
import { runAutoScan } from "@/lib/engine/acke-engine";
import { HistoryDataFormatError, parseStrictHistory } from "@/lib/engine/history";
import { isScanMode, isTarget2D, isTarget3D } from "@/lib/engine/helpers";
import type { Posisi, ScanMode, Target2D, Target3D } from "@/lib/engine/types";
import { requireActiveAccess } from "@/lib/server/access";
import { createAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DIGIT_COUNT = 4;
const DEFAULT_SCAN_MODE: ScanMode = "ai_2d_belakang";
const DEFAULT_STOP_SCAN = 1;
const MAX_STOP_SCAN = 200;

function isPosisi(value: unknown): value is Posisi {
  return value === "A" || value === "C" || value === "K" || value === "E";
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export async function POST(req: Request) {
  const access = await requireActiveAccess(req.headers);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  let requestAction: "scan" | "adaptive" = "scan";

  try {
    const body = await req.json().catch(() => ({}));
    requestAction = body?.action === "adaptive" ? "adaptive" : "scan";
    const marketId = String(body?.marketId || "").trim();

    if (!marketId) {
      return NextResponse.json({ error: "Pilih pasaran dulu." }, { status: 400 });
    }

    if (requestAction === "adaptive") {
      if (!isAdaptiveMethod(body?.method)) {
        return NextResponse.json({ error: "Metode Adaptive tidak valid." }, { status: 400 });
      }
      if (!isAdaptiveTarget(body?.target2D)) {
        return NextResponse.json({ error: "Target 2D Adaptive tidak valid." }, { status: 400 });
      }

      const digitCount = Number(body?.digitCount);
      if (!Number.isInteger(digitCount) || digitCount < 1 || digitCount > 9) {
        return NextResponse.json({ error: "Jumlah digit harus antara 1 dan 9." }, { status: 400 });
      }

      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("markets")
        .select("id, history_data, name")
        .eq("id", marketId)
        .single();

      if (error) {
        console.error("[api/scan:adaptive] Supabase error", error);
        return NextResponse.json({ error: "Gagal mengambil data pasaran." }, { status: 500 });
      }
      if (!data?.history_data) {
        return NextResponse.json({ error: "Pasaran ini belum punya data keluaran." }, { status: 404 });
      }

      const draws = parseStrictHistory(data.history_data);
      const prediction = runAdaptiveFoundation(draws, body.target2D, body.method, digitCount);
      const persistence = await persistAdaptivePrediction(String(data.id), String(data.name), prediction);

      return NextResponse.json({
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
          persistence,
        },
      });
    }

    if (body?.scanMode !== undefined && !isScanMode(body.scanMode)) {
      return NextResponse.json({ error: "Jenis scan tidak valid." }, { status: 400 });
    }

    if (body?.targetPos !== undefined && !isPosisi(body.targetPos)) {
      return NextResponse.json({ error: "Target posisi tidak valid." }, { status: 400 });
    }

    if (body?.target2D !== undefined && !isTarget2D(body.target2D)) {
      return NextResponse.json({ error: "Target 2D tidak valid." }, { status: 400 });
    }

    if (body?.target3D !== undefined && !isTarget3D(body.target3D)) {
      return NextResponse.json({ error: "Target 3D tidak valid." }, { status: 400 });
    }

    const scanMode = (body?.scanMode ?? DEFAULT_SCAN_MODE) as ScanMode;
    const L = clamp(body?.L, 14, 1, 100);
    const config = {
      L,
      patah: clamp(body?.patah, 0, 0, L),
      targetPos: body?.targetPos as Posisi | undefined,
      target2D: body?.target2D as Target2D | undefined,
      target3D: body?.target3D as Target3D | undefined,
      digitCount: clamp(body?.digitCount ?? body?.minHidup, DEFAULT_DIGIT_COUNT, 1, 12),
      stopScan: clamp(body?.stopScan, DEFAULT_STOP_SCAN, 1, MAX_STOP_SCAN),
      scanMode,
    };

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("markets")
      .select("history_data, name")
      .eq("id", marketId)
      .single();

    if (error) {
      console.error("[api/scan] Supabase error", error);
      return NextResponse.json({ error: "Gagal mengambil data pasaran." }, { status: 500 });
    }
    if (!data?.history_data) {
      return NextResponse.json({ error: "Pasaran ini belum punya data keluaran." }, { status: 404 });
    }

    const draws = parseStrictHistory(data.history_data);
    const result = runAutoScan(draws, config);
    return NextResponse.json({ market: data.name, result });
  } catch (error) {
    if (error instanceof HistoryDataFormatError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    console.error(`[api/scan:${requestAction}] Request error`, error);
    if (requestAction === "adaptive") {
      const message = error instanceof Error ? error.message : "Adaptive gagal.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ error: "Scan gagal." }, { status: 400 });
  }
}
