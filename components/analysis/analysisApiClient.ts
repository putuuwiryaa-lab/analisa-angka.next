import type { TargetPair } from "@/lib/analysis/customDigit";
import type { AnalysisScope } from "./ScopeSelectors";

export async function postAnalyzeRequest({
  type,
  data,
  param,
  targetPair = "belakang",
  scope = "default",
}: {
  token?: string | null | undefined;
  type: string;
  data: string[];
  param: number;
  targetPair?: TargetPair;
  scope?: AnalysisScope;
}) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type,
      data,
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
