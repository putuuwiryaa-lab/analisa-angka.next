import { NextResponse } from "next/server";
import { runAnalysis } from "@/lib/server/engines/predictionEngine";
import { requireActiveAccess } from "@/lib/server/access";

export const runtime = "nodejs";

const ANALYZE_WINDOW = 20;

type TargetPair = "depan" | "tengah" | "belakang";
type AnalysisScope = "default" | "4d" | "3d" | "2d_depan" | "2d_tengah" | "2d_belakang";

const BBFS_GGBK_PARAM = 10;

function sanitizeData(data: unknown): string[] | null {
  if (!Array.isArray(data)) return null;

  const cleaned = data
    .map((item) => String(item || "").trim())
    .filter((item) => /^\d{4}$/.test(item));

  if (cleaned.length < 17) return null;

  return cleaned.slice(-ANALYZE_WINDOW);
}

function sanitizeTargetPair(value: unknown): TargetPair {
  return value === "depan" || value === "tengah" || value === "belakang"
    ? value
    : "belakang";
}

function sanitizeAnalysisScope(value: unknown): AnalysisScope {
  return value === "4d" ||
    value === "3d" ||
    value === "2d_depan" ||
    value === "2d_tengah" ||
    value === "2d_belakang"
    ? value
    : "default";
}

function isAi2DScope(scope: AnalysisScope): boolean {
  return scope === "2d_depan" || scope === "2d_tengah" || scope === "2d_belakang";
}

function isBbfsGgbkScope(scope: AnalysisScope): boolean {
  return scope === "3d" || isAi2DScope(scope);
}

function normalizeScopeForType(type: string, scope: AnalysisScope): AnalysisScope {
  if (type === "ai" && isAi2DScope(scope)) return "default";
  return scope;
}

function targetPairFromScope(scope: AnalysisScope, fallback: TargetPair): TargetPair {
  if (scope === "2d_depan") return "depan";
  if (scope === "2d_tengah") return "tengah";
  if (scope === "2d_belakang") return "belakang";
  return fallback;
}

function aiParamIsValid(param: number, scope: AnalysisScope) {
  if (scope === "3d") return [1, 3, 5, 7, 8].includes(param);
  if (scope === "4d") return [1, 2, 4].includes(param);
  return [2, 4, 6, 7, 8].includes(param);
}

function bbfsParamIsValid(param: number, scope: AnalysisScope) {
  if ([7, 8, 9].includes(param)) return true;
  return param === BBFS_GGBK_PARAM && isBbfsGgbkScope(scope);
}

export async function POST(request: Request) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = await request.json().catch(() => ({}));
    const { type, data, param, target_pair, analysis_scope } = body;

    const allowedTypes = new Set(["ai", "bbfs", "mati", "jumlah", "shio", "rekap"]);
    const cleanedData = sanitizeData(data);
    const safeParam = Number(param || 1);
    const rawScope = sanitizeAnalysisScope(analysis_scope);

    const isBBFS = type === "bbfs";
    const isAI = type === "ai";
    const safeScope = normalizeScopeForType(type, rawScope);
    const engineType = isBBFS ? "ai" : type;

    const targetPair =
      isBBFS || isAI
        ? targetPairFromScope(rawScope, sanitizeTargetPair(target_pair))
        : sanitizeTargetPair(target_pair);

    const paramIsValid = isBBFS
      ? bbfsParamIsValid(safeParam, safeScope)
      : isAI
        ? aiParamIsValid(safeParam, safeScope)
        : Number.isInteger(safeParam) && safeParam >= 1 && safeParam <= 8;

    if (
      !allowedTypes.has(type) ||
      !cleanedData ||
      !Number.isInteger(safeParam) ||
      !paramIsValid ||
      (isBBFS && safeScope === "default")
    ) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 },
      );
    }

    const result = runAnalysis(engineType, cleanedData, safeParam, {
      analysisScope: safeScope,
      targetPair,
      forceDigitResult: isBBFS,
    });

    return NextResponse.json({
      ...result,
      target_pair: targetPair,
      analysis_scope: safeScope,
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json(
      { error: "Gagal memproses analisa" },
      { status: 500 },
    );
  }
}
