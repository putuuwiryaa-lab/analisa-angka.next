import type { TargetPair } from "@/lib/analysis/customDigit";
import type { AnalysisScope } from "./ScopeSelectors";

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function inferMarketIdFromPath() {
  if (typeof window === "undefined") return "";

  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] !== "analyze" || !parts[1]) return "";
  return safeDecode(parts[1]).trim();
}

export async function postAnalyzeRequest({
  type,
  data: _data,
  marketId,
  param,
  targetPair = "belakang",
  scope = "default",
}: {
  token?: string | null | undefined;
  type: string;
  /**
   * Deprecated: histori tidak lagi dikirim ke /api/analyze.
   * Server mengambil data asli berdasarkan marketId.
   */
  data?: string[];
  marketId?: string;
  param: number;
  targetPair?: TargetPair;
  scope?: AnalysisScope;
}) {
  const resolvedMarketId = (marketId || inferMarketIdFromPath()).trim();
  if (!resolvedMarketId) throw new Error("Market tidak valid untuk analisa.");

  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      marketId: resolvedMarketId,
      type,
      param,
      target_pair: targetPair,
      analysis_scope: scope,
    }),
  });

  const json = await response.json();
  if (json.success || json.data) {
    return { ...(json.data || json), target_pair: json.target_pair, analysis_scope: json.analysis_scope };
  }

  throw new Error(json.error || "Gagal memproses analisa");
}
