import { NextResponse } from "next/server";
import {
  loadInvestOverview,
  loadInvestForMarket,
  rankInvestMarkets,
  type InvestComboResult,
  type InvestMarketResult,
} from "@/lib/server/engines/investEngine";
import { NO_STORE_HEADERS, PRIVATE_MEDIUM_CACHE_HEADERS } from "@/lib/server/cacheHeaders";
import { requireActiveAccess } from "@/lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InvestTopCombo = {
  pair: string;
  pairLabel: string;
  combo: InvestComboResult;
};

function compactCombo(combo: InvestComboResult): InvestComboResult {
  return {
    id: combo.id,
    label: combo.label,
    expectedLines: combo.expectedLines,
    cachedLineCount: combo.cachedLineCount,
    hitRate: combo.hitRate,
    avgWins15: combo.avgWins15,
    avgWinsLast5: combo.avgWinsLast5,
    maxLossStreak: combo.maxLossStreak,
    avgScore: combo.avgScore,
    recommendationScore: combo.recommendationScore,
    recommendationStatus: combo.recommendationStatus,
    riskNote: combo.riskNote,
    filters: combo.filters,
  };
}

function toInvestOverviewMarket(market: InvestMarketResult) {
  const allCombos = market.pairs.flatMap((pair) => pair.combos.map((combo) => ({ pair, combo })));
  const best = [...allCombos].sort(
    (a, b) =>
      b.combo.avgWins15 - a.combo.avgWins15 ||
      b.combo.recommendationScore - a.combo.recommendationScore ||
      b.combo.avgScore - a.combo.avgScore,
  )[0];

  const topCombos: InvestTopCombo[] = market.pairs
    .map((pair) => {
      const combo = pair.combos.find((item) => item.avgWins15 >= 15) || pair.combos[0];
      if (!combo) return null;
      return {
        pair: pair.pair,
        pairLabel: pair.pairLabel,
        combo: compactCombo(combo),
      };
    })
    .filter(Boolean) as InvestTopCombo[];

  return {
    marketId: market.marketId,
    marketName: market.marketName,
    hasAny: market.hasAny,
    totalCombos: allCombos.length,
    bestWins15: best?.combo.avgWins15 || 0,
    bestScore: best?.combo.recommendationScore || best?.combo.avgScore || 0,
    topCombos,
  };
}

export async function GET(request: Request) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers: NO_STORE_HEADERS });

  try {
    const marketId = new URL(request.url).searchParams.get("marketId");

    if (marketId) {
      const market = rankInvestMarkets([await loadInvestForMarket(marketId)])[0];
      return NextResponse.json({ market }, { headers: PRIVATE_MEDIUM_CACHE_HEADERS });
    }

    const markets = rankInvestMarkets(await loadInvestOverview())
      .filter((market) => market.hasAny)
      .map(toInvestOverviewMarket);

    return NextResponse.json({ markets }, {
      headers: PRIVATE_MEDIUM_CACHE_HEADERS,
    });
  } catch (e) {
    console.error("INVEST_API_ERROR", e);
    return NextResponse.json(
      { error: "Gagal memuat rekomendasi invest" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
