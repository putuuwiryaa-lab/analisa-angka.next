import type { ShareOption, ShareRow } from "./types";
import { marketLabel } from "./utils";

export const INVEST_SHARE_MODE = "invest";

export type InvestSharePair = "depan" | "tengah" | "belakang" | "3d";

export type InvestShareFilter = {
  kind: string;
  param: number;
  pair?: "tengah" | "belakang";
  position?: "kop" | "kepala" | "ekor";
};

export type InvestShareCombo = {
  id: string;
  label: string;
  expectedLines: number;
  cachedLineCount?: number;
  avgWins15: number;
  filters: InvestShareFilter[];
};

export type InvestShareTopCombo = {
  pair: InvestSharePair;
  pairLabel: string;
  combo: InvestShareCombo;
};

export type InvestShareMarket = {
  marketId: string;
  marketName: string;
  topCombos: InvestShareTopCombo[];
};

export type InvestShareOverviewResponse = {
  markets: InvestShareMarket[];
  error?: string;
};

export type InvestShareResult = {
  pair: InvestSharePair;
  pairLabel: string;
  comboLabel: string;
  lineCount: number;
  lines: string[];
  latestResult?: string;
  wins15?: number;
};

export type InvestShareRow = ShareRow & {
  invest?: InvestShareResult;
};

export const INVEST_SHARE_OPTIONS: ShareOption[] = [
  {
    key: "invest|0|depan|default",
    mode: INVEST_SHARE_MODE,
    param: 0,
    targetPair: "depan",
    analysisScope: "default",
    updatedAt: null,
  },
  {
    key: "invest|0|tengah|default",
    mode: INVEST_SHARE_MODE,
    param: 0,
    targetPair: "tengah",
    analysisScope: "default",
    updatedAt: null,
  },
  {
    key: "invest|0|belakang|default",
    mode: INVEST_SHARE_MODE,
    param: 0,
    targetPair: "belakang",
    analysisScope: "default",
    updatedAt: null,
  },
  {
    key: "invest|0|belakang|3d",
    mode: INVEST_SHARE_MODE,
    param: 0,
    targetPair: "belakang",
    analysisScope: "3d",
    updatedAt: null,
  },
];

export function isInvestShareOption(option: ShareOption | null) {
  return option?.mode === INVEST_SHARE_MODE;
}

export function investSharePair(option: ShareOption | null): InvestSharePair {
  if (option?.analysisScope === "3d") return "3d";
  if (option?.targetPair === "depan" || option?.targetPair === "tengah") return option.targetPair;
  return "belakang";
}

export function investShareTargetLabel(option: ShareOption | null) {
  const pair = investSharePair(option);
  if (pair === "3d") return "3D";
  if (pair === "depan") return "2D Depan";
  if (pair === "tengah") return "2D Tengah";
  return "2D Belakang";
}

export function investShareTargetKey(option: ShareOption | null) {
  return `invest|${investSharePair(option)}`;
}

export function findInvestShareMarket(
  overview: InvestShareOverviewResponse | null,
  marketId: string,
) {
  const key = marketId.trim().toLowerCase();
  return (overview?.markets || []).find((market) => market.marketId.trim().toLowerCase() === key) || null;
}

export function findInvestShareCombo(
  market: InvestShareMarket | null,
  pair: InvestSharePair,
) {
  return market?.topCombos.find((item) => item.pair === pair) || null;
}

export function availableInvestShareMarketIds(
  overview: InvestShareOverviewResponse | null,
  pair: InvestSharePair,
) {
  return new Set(
    (overview?.markets || [])
      .filter((market) => market.topCombos.some((item) => item.pair === pair))
      .map((market) => market.marketId.trim().toLowerCase()),
  );
}

function buildInvestShareBlock(row: ShareRow) {
  const invest = (row as InvestShareRow).invest;
  if (!invest?.lines?.length) return "";
  return `*${marketLabel(row)}* — ${invest.lineCount} line`;
}

export function buildInvestShareText(rows: ShareRow[]) {
  return rows.map(buildInvestShareBlock).filter(Boolean).join("\n");
}

export function buildInvestPreviewText(rows: ShareRow[]) {
  return buildInvestShareText(rows);
}
