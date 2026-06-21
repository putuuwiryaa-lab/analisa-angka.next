import { NextResponse } from "next/server";
import {
  loadInvestOverview,
  loadInvestForMarket,
  rankInvestMarkets,
  type InvestMarketResult,
} from "@/lib/server/engines/investEngine";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { verifyActiveTelegramSession } from "@/lib/server/telegram-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MarketRow = Record<string, unknown>;

function normalizeMarketId(value: string) {
  try {
    return decodeURIComponent(value).trim().toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

function marketIdOf(market: MarketRow) {
  return String(market.id ?? market.slug ?? market.code ?? market.name ?? "");
}

function marketNameOf(market: MarketRow) {
  return String(market.name ?? market.title ?? market.id ?? market.slug ?? "Pasaran");
}

function extractHistoryData(market: MarketRow) {
  return String(
    market.history_data ??
      market.historyData ??
      market.history ??
      market.data ??
      market.results ??
      market.result ??
      "",
  );
}

function parseHistoryTokens(historyData: string) {
  return historyData
    .split(/[\s\n\r\t,;|]+/)
    .map((token) => token.trim())
    .filter((token) => /^\d{4}$/.test(token));
}

function collectMarketIds(markets: InvestMarketResult[]) {
  return Array.from(new Set(markets.map((market) => market.marketId).filter(Boolean)));
}

async function loadLatestResultByMarket(markets: InvestMarketResult[]) {
  const result: Record<string, string> = {};
  const marketIds = collectMarketIds(markets);
  if (!marketIds.length) return result;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("markets").select("*");
    if (error) return result;

    const rows = (data || []) as MarketRow[];
    for (const marketId of marketIds) {
      const requested = normalizeMarketId(marketId);
      const row = rows.find((item) => {
        const id = normalizeMarketId(marketIdOf(item));
        const name = normalizeMarketId(marketNameOf(item));
        return id === requested || name === requested;
      });

      if (!row) continue;

      const history = parseHistoryTokens(extractHistoryData(row));
      const latestResult = history[history.length - 1] || "";
      if (latestResult) result[marketId] = latestResult;
    }
  } catch {
    return result;
  }

  return result;
}

async function rankFreshInvestMarkets(markets: InvestMarketResult[]) {
  const latestResultByMarket = await loadLatestResultByMarket(markets);
  return rankInvestMarkets(markets, latestResultByMarket);
}

export async function GET(request: Request) {
  try {
    const access = await verifyActiveTelegramSession(request.headers);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const marketId = new URL(request.url).searchParams.get("marketId");

    const data = marketId
      ? { market: (await rankFreshInvestMarkets([await loadInvestForMarket(marketId)]))[0] }
      : { markets: await rankFreshInvestMarkets(await loadInvestOverview()) };

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("INVEST_API_ERROR", e);
    return NextResponse.json({ error: "Gagal memuat rekomendasi invest" }, { status: 500 });
  }
}
