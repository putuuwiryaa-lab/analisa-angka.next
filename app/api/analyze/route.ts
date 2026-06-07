import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/server/env";
import { getBearerToken } from "@/lib/server/jwt";
import { verifyActiveVipSession } from "@/lib/server/vip-session";
import { runAnalysis } from "@/lib/server/engines/predictionEngine";
import { canUseParam, type LockableMode, type LockableScope } from "@/lib/access/freeAccess";

export const runtime = "nodejs";

const VIP_LOCK_MESSAGE =
  "Fitur ini dibatasi untuk pengguna Free agar performa server tetap stabil dan akses analisa tetap lancar. Login VIP untuk membuka fitur ini.";

type TargetPair = "depan" | "tengah" | "belakang";
type AnalysisScope = "default" | "4d" | "3d" | "2d_depan" | "2d_tengah" | "2d_belakang";

function sanitizeData(data: unknown): string[] | null {
  if (!Array.isArray(data)) return null;

  const cleaned = data
    .map((item) => String(item || "").trim())
    .filter((item) => /^\d{4}$/.test(item));

  if (cleaned.length < 17) return null;

  return cleaned.slice(-200);
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

type AccessResult =
  | { ok: true; role: string }
  | { ok: false; status: number; error: string };

async function validateAccess(headers: Headers): Promise<AccessResult> {
  const token = getBearerToken(headers);
  if (!token || token === "null" || token === "undefined") {
    return { ok: true, role: "FREE" };
  }

  const access = await verifyActiveVipSession(headers);
  if (!access.ok) return access;

  return { ok: true, role: access.role };
}

function canRoleAnalyze({
  role,
  type,
  param,
  rawScope,
  targetPair,
}: {
  role: string;
  type: string;
  param: number;
  rawScope: AnalysisScope;
  targetPair: TargetPair;
}) {
  if (!["ai", "bbfs", "mati", "jumlah", "shio", "rekap"].includes(type)) {
    return false;
  }

  if (type === "rekap") {
    return role === "PRO" || role === "MASTER";
  }

  const accessScope =
    type === "ai" && rawScope === "default" && targetPair === "belakang"
      ? "2d_belakang"
      : rawScope;

  return canUseParam(
    role,
    type as LockableMode,
    param,
    accessScope as LockableScope,
    targetPair,
  );
}

export async function POST(request: Request) {
  try {
    requireEnv("JWT_SECRET");
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);

    return NextResponse.json(
      { error: "Kesalahan konfigurasi server" },
      { status: 500 },
    );
  }

  const expectedInternalSecret = process.env.INTERNAL_API_SECRET;
  const submittedInternalSecret =
    request.headers.get("x-internal-secret") ||
    request.headers.get("x-internal-api-secret") ||
    "";

  const isInternalRequest = Boolean(
    expectedInternalSecret &&
      submittedInternalSecret &&
      submittedInternalSecret === expectedInternalSecret,
  );

  let role = "FREE";

  if (!isInternalRequest) {
    const access = await validateAccess(request.headers);

    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    role = access.role;
  }

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
      ? [7, 8, 9].includes(safeParam)
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

    if (
      !isInternalRequest &&
      !canRoleAnalyze({
        role,
        type,
        param: safeParam,
        rawScope,
        targetPair,
      })
    ) {
      return NextResponse.json(
        { error: VIP_LOCK_MESSAGE },
        { status: 403 },
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
