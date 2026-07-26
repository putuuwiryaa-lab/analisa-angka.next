import "server-only";
import { buildCustomDigitLines, type TargetPair } from "@/lib/analysis/customDigit";
import { toNumberList } from "@/lib/analysis/utils";
import { runAnalysis } from "@/lib/server/engines/predictionEngine";
import { loadInvestMarketData } from "./investAngkaJadi";
import type {
  Invest3DFilter,
  Invest3DPair,
  Invest3DPosition,
} from "./invest3dCatalog";

export const INVEST_3D_ANGKA_JADI_FORMULA_VERSION = "invest-3d-angka-jadi-v1";

type AnalysisScope = "default" | "3d" | "2d_tengah" | "2d_belakang";

type MatiResult = {
  KOP?: { result?: unknown };
  KEPALA?: { result?: unknown };
  EKOR?: { result?: unknown };
};

function runEngine(
  type: "ai" | "ai_parity" | "ai_size" | "bbfs" | "mati",
  data: string[],
  param: number,
  targetPair: TargetPair = "belakang",
  analysisScope: AnalysisScope = "default",
) {
  const isBBFS = type === "bbfs";
  const result = runAnalysis(isBBFS ? "ai" : type, data, param, {
    analysisScope,
    targetPair,
    forceDigitResult: isBBFS,
  }) as any;
  return result?.data || result;
}

function pairScope(pair: Invest3DPair): AnalysisScope {
  return pair === "tengah" ? "2d_tengah" : "2d_belakang";
}

function dominantValue(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw || "").trim().toUpperCase();
}

function isPair(value: unknown): value is Invest3DPair {
  return value === "tengah" || value === "belakang";
}

function isPosition(value: unknown): value is Invest3DPosition {
  return value === "kop" || value === "kepala" || value === "ekor";
}

export function sanitizeInvest3DFilters(value: unknown): Invest3DFilter[] {
  if (!Array.isArray(value)) return [];

  const filters: Invest3DFilter[] = [];
  for (const item of value) {
    const kind = String((item as any)?.kind || "");
    const param = Number((item as any)?.param || 0);
    const pair = (item as any)?.pair;
    const position = (item as any)?.position;

    if (kind === "ai_3d" && param === 5) {
      filters.push({ kind, param: 5 });
      continue;
    }
    if (kind === "ai_3d_parity" && param === 1) {
      filters.push({ kind, param: 1 });
      continue;
    }
    if (kind === "ai_3d_size" && param === 1) {
      filters.push({ kind, param: 1 });
      continue;
    }
    if (kind === "ai_pair" && isPair(pair) && (param === 4 || param === 6)) {
      filters.push({ kind, pair, param });
      continue;
    }
    if (kind === "parity_pair" && isPair(pair) && param === 1) {
      filters.push({ kind, pair, param: 1 });
      continue;
    }
    if (kind === "size_pair" && isPair(pair) && param === 1) {
      filters.push({ kind, pair, param: 1 });
      continue;
    }
    if (kind === "bbfs_3d" && (param === 8 || param === 10)) {
      filters.push({ kind, param });
      continue;
    }
    if (kind === "bbfs_pair" && isPair(pair) && (param === 8 || param === 9 || param === 10)) {
      filters.push({ kind, pair, param });
      continue;
    }
    if (kind === "off_position" && isPosition(position) && (param === 1 || param === 2 || param === 3)) {
      filters.push({ kind, position, param });
    }
  }

  return filters.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

export async function generateInvest3DAngkaJadi(data: string[], filters: Invest3DFilter[]) {
  const aiByPair: Partial<Record<Invest3DPair, number[]>> = {};
  const aiParityByPair: Partial<Record<Invest3DPair, string>> = {};
  const aiSizeByPair: Partial<Record<Invest3DPair, string>> = {};
  const bbfsByPair: Partial<Record<Invest3DPair, number[]>> = {};
  const offCounts: Partial<Record<Invest3DPosition, 1 | 2 | 3>> = {};

  let ai3d: number[] = [];
  let ai3dParity = "";
  let ai3dSize = "";
  let bbfsGlobal: number[] = [];

  for (const filter of filters) {
    switch (filter.kind) {
      case "ai_3d":
        ai3d = toNumberList(runEngine("ai", data, filter.param, "belakang", "3d")?.result);
        break;
      case "ai_3d_parity":
        ai3dParity = dominantValue(runEngine("ai_parity", data, 1, "belakang", "3d")?.result);
        break;
      case "ai_3d_size":
        ai3dSize = dominantValue(runEngine("ai_size", data, 1, "belakang", "3d")?.result);
        break;
      case "ai_pair":
        aiByPair[filter.pair] = toNumberList(
          runEngine("ai", data, filter.param, filter.pair, "default")?.result,
        );
        break;
      case "parity_pair":
        aiParityByPair[filter.pair] = dominantValue(
          runEngine("ai_parity", data, 1, filter.pair, "default")?.result,
        );
        break;
      case "size_pair":
        aiSizeByPair[filter.pair] = dominantValue(
          runEngine("ai_size", data, 1, filter.pair, "default")?.result,
        );
        break;
      case "bbfs_3d":
        bbfsGlobal = toNumberList(runEngine("bbfs", data, filter.param, "belakang", "3d")?.result);
        break;
      case "bbfs_pair":
        bbfsByPair[filter.pair] = toNumberList(
          runEngine("bbfs", data, filter.param, filter.pair, pairScope(filter.pair))?.result,
        );
        break;
      case "off_position":
        offCounts[filter.position] = filter.param;
        break;
    }
  }

  const matiCache: Partial<Record<1 | 2 | 3, MatiResult>> = {};
  const getMati = (count: 1 | 2 | 3 | undefined) => {
    if (!count) return null;
    if (!matiCache[count]) matiCache[count] = runEngine("mati", data, count) as MatiResult;
    return matiCache[count] || null;
  };

  const offKop = offCounts.kop ? toNumberList(getMati(offCounts.kop)?.KOP?.result) : [];
  const offKepala = offCounts.kepala
    ? toNumberList(getMati(offCounts.kepala)?.KEPALA?.result)
    : [];
  const offEkor = offCounts.ekor ? toNumberList(getMati(offCounts.ekor)?.EKOR?.result) : [];

  const lines = buildCustomDigitLines({
    focus: "3d",
    aiByPair,
    aiParityByPair,
    aiSizeByPair,
    ai3d,
    ai3dParity,
    ai3dSize,
    bbfsByPair,
    bbfsGlobal,
    offKop,
    offKepala,
    offEkor,
  });

  return {
    lines,
    focus: "3d" as const,
    filters,
    formula_version: INVEST_3D_ANGKA_JADI_FORMULA_VERSION,
  };
}

export async function generateInvest3DAngkaJadiForMarket(
  marketId: string,
  filters: Invest3DFilter[],
) {
  const { market, history, latestResult } = await loadInvestMarketData(marketId);
  const result = await generateInvest3DAngkaJadi(history, filters);
  return {
    ...result,
    market_id: marketId,
    market_name: String(market.name || marketId),
    latest_result: latestResult,
  };
}
