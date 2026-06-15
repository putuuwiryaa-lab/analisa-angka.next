import { deviceAuthHeader } from "@/lib/auth/device";

export const MARKETS_QUERY_KEY = ["markets"] as const;
export const MARKETS_STALE_TIME = 10 * 60 * 1000;
export const MARKETS_GC_TIME = 60 * 60 * 1000;

export type Market = {
  id: string;
  name?: string | null;
  order?: number | null;
  updated_at?: string | null;
  history_data?: string | null;
  historyData?: string | null;
  history?: string | null;
  data?: string | null;
  results?: string | null;
  result?: string | null;
  lastResult?: string;
};

export function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeMarketId(value: string) {
  return safeDecode(value).trim().toLowerCase();
}

export function getLastResult(historyData: string | null | undefined) {
  const tokens = String(historyData || "")
    .trim()
    .split(/[\s\n\r\t,]+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (/^\d{4}$/.test(tokens[i])) return tokens[i];
  }
  return "----";
}

export function formatMarketUpdatedAt(value: string | null) {
  if (!value) return "Belum ada info";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Info tidak valid";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function extractHistoryData(market: Market) {
  return String(
    market.history_data ?? market.historyData ?? market.history ?? market.data ?? market.results ?? market.result ?? "",
  );
}

export function parseHistoryTokens(historyData: string) {
  return historyData
    .split(/[\s\n\r\t,;|]+/)
    .map((token) => token.trim())
    .filter((token) => /^\d{4}$/.test(token));
}

export function findMarketByIdOrName(markets: Market[], marketId: string) {
  const requestedId = normalizeMarketId(marketId);
  return markets.find((market) => {
    const id = market.id ? normalizeMarketId(String(market.id)) : "";
    const name = market.name ? normalizeMarketId(String(market.name)) : "";
    return id === requestedId || name === requestedId;
  });
}

export async function fetchMarkets(token: string): Promise<Market[]> {
  const response = await fetch("/api/markets", {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      ...deviceAuthHeader(),
    },
  });
  const json = await response.json();

  if (!response.ok) {
    throw new Error(json?.error || "Gagal memuat data pasaran.");
  }
  if (!Array.isArray(json)) {
    throw new Error("Format data pasaran dari server tidak valid.");
  }

  return json
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .map((market) => ({ ...market, lastResult: getLastResult(market.history_data) }));
}
