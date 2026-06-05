"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

type EvaluationMode = "ai" | "ai_parity" | "ai_size" | "bbfs" | "mati" | "jumlah" | "shio";
type EvaluationPosition = "all" | "as" | "kop" | "kepala" | "ekor";
type TargetPair = "depan" | "tengah" | "belakang";
type AnalysisScope = "default" | "4d" | "3d" | "2d_depan" | "2d_tengah" | "2d_belakang";

const EVALUATION_HISTORY_LIMIT = 15;

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeMarketId(value: string) {
  return safeDecode(value).trim();
}

function marketIdCandidates(value: string) {
  const decoded = normalizeMarketId(value);
  const encoded = encodeURIComponent(decoded);
  return Array.from(new Set([value, decoded, encoded, decoded.toUpperCase(), decoded.toLowerCase()].filter(Boolean)));
}

function labelFromMatiDetail(detail: any) {
  if (detail?.position) return detail?.safe ? "MASUK" : "ZONK";
  const asSafe = Boolean(detail?.AS?.safe);
  const kopSafe = Boolean(detail?.KOP?.safe);
  const kepalaSafe = Boolean(detail?.KEPALA?.safe);
  const ekorSafe = Boolean(detail?.EKOR?.safe);
  if (asSafe && kopSafe && kepalaSafe && ekorSafe) return "4D";
  if (kopSafe && kepalaSafe && ekorSafe) return "3D";
  if (kepalaSafe && ekorSafe) return "2D";
  return "ZONK";
}

function displayLabel(row: any, mode: EvaluationMode) {
  if (mode === "mati") {
    const normalized = row.status === "TIDAK MASUK" ? "ZONK" : row.status;
    if (["4D", "3D", "2D", "MASUK", "ZONK"].includes(normalized)) return normalized;
    return labelFromMatiDetail(row.detail);
  }
  const rawLabel = row.status || (row.is_hit ? "MASUK" : "ZONK");
  return rawLabel === "TIDAK MASUK" ? "ZONK" : rawLabel;
}

function legacyAi2DScope(targetPair: TargetPair): AnalysisScope {
  return `2d_${targetPair}` as AnalysisScope;
}

function shouldUseAi2DScopeFallback(mode: EvaluationMode, analysisScope: AnalysisScope) {
  return mode === "ai" && analysisScope !== "3d" && analysisScope !== "4d";
}

async function resolveMarketIds(marketId: string) {
  const candidates = marketIdCandidates(marketId);
  const { data } = await supabase.from("markets").select("id,name").in("id", candidates);

  const ids = new Set(candidates);
  for (const market of data || []) {
    if (market?.id) ids.add(String(market.id));
    if (market?.name) ids.add(String(market.name));
  }

  return Array.from(ids);
}

async function fetchEvaluations(
  marketId: string,
  mode: EvaluationMode,
  param: number,
  position: EvaluationPosition,
  targetPair: TargetPair,
  analysisScope: AnalysisScope,
) {
  const resolvedMarketIds = await resolveMarketIds(marketId);

  let query = supabase
    .from("analysis_evaluations")
    .select(
      "id,from_result,new_result,is_hit,status,detail,evaluated_at,position,target_pair,analysis_scope,market_id",
    )
    .in("market_id", resolvedMarketIds)
    .eq("mode", mode)
    .eq("param", param)
    .order("evaluated_at", { ascending: false })
    .limit(EVALUATION_HISTORY_LIMIT);

  if (position && position !== "all") query = query.eq("position", position);
  if (mode !== "mati") query = query.eq("target_pair", targetPair);

  if (shouldUseAi2DScopeFallback(mode, analysisScope)) {
    query = query.in("analysis_scope", ["default", legacyAi2DScope(targetPair)]);
  } else {
    query = query.eq("analysis_scope", analysisScope);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).slice(0, EVALUATION_HISTORY_LIMIT);
}

export function EvaluationHistory({
  marketId,
  mode,
  param,
  position = "all",
  targetPair = "belakang",
  analysisScope = "default",
  title = "Riwayat Evaluasi",
}: {
  marketId: string;
  mode: EvaluationMode;
  param: number;
  position?: EvaluationPosition;
  targetPair?: TargetPair;
  analysisScope?: AnalysisScope;
  title?: string;
}) {
  const normalizedMarketId = normalizeMarketId(marketId);
  const showAi2DigitNote = mode === "ai" && param === 2;

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["evaluations", normalizedMarketId, mode, param, position, targetPair, analysisScope],
    queryFn: () => fetchEvaluations(normalizedMarketId, mode, param, position, targetPair, analysisScope),
    enabled: Boolean(normalizedMarketId && mode && param),
  });

  const emptyBox = (text: string) => (
    <div className="rounded-2xl border border-border-soft bg-surface-2 p-4 text-center text-[11px] font-black uppercase tracking-wide text-text-muted">
      {text}
    </div>
  );

  if (isLoading) return emptyBox("Memuat riwayat…");
  if (error) return emptyBox(error instanceof Error ? error.message : "Gagal memuat riwayat evaluasi");
  if (!rows.length) return emptyBox("Riwayat evaluasi belum ada");

  return (
    <div className="animate-rise space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="display text-xs text-text">{title}</span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-text-soft">15 Terbaru</span>
      </div>

      {showAi2DigitNote && (
        <div className="rounded-xl border border-mode-ai/20 bg-mode-ai/[0.08] px-3 py-2 text-[11px] font-bold leading-relaxed text-mode-ai">
          Catatan: jika AI 2 digit terlalu sering ZONK, lebih bijak jadikan hasilnya sebagai OFF 2 digit.
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {rows.map((row: any) => {
          const label = displayLabel(row, mode);
          const isSuccess = label !== "ZONK";
          return (
            <div
              key={row.id}
              className="rounded-2xl border border-border-soft bg-surface-2 p-2 text-center"
            >
              <div className="num text-[11px] font-black text-text">
                {row.from_result} → {row.new_result}
              </div>
              <div
                className={`mt-2 rounded-full px-1.5 py-1 text-[9px] font-black uppercase tracking-wide ${
                  isSuccess ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                }`}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
