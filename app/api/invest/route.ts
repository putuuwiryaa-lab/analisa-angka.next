import { NextResponse } from "next/server";
import {
  loadInvestOverview,
  loadInvestForMarket,
  rankInvestMarkets,
  type InvestComboResult,
  type InvestMarketResult,
} from "@/lib/server/engines/investEngine";
import {
  loadInvest3DOverview,
  rankInvest3DMarkets,
  type Invest3DComboResult,
  type Invest3DMarketResult,
} from "@/lib/server/engines/invest3dEngine";
import { NO_STORE_HEADERS, PRIVATE_MEDIUM_CACHE_HEADERS } from "@/lib/server/cacheHeaders";
import { requireActiveAccess } from "@/lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InvestTopCombo = {
  pair: string;
  pairLabel: string;
  combo: ReturnType<typeof compactCombo> | ReturnType<typeof compact3DCombo>;
};

type InvestOverviewMarket = {
  marketId: string;
  marketName: string;
  hasAny: boolean;
  totalCombos: number;
  bestWins15: number;
  bestScore: number;
  topCombos: InvestTopCombo[];
};

function compactCombo(combo: InvestComboResult) {
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

function compact3DCombo(combo: Invest3DComboResult) {
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

function toInvestOverviewMarket(market: InvestMarketResult): InvestOverviewMarket {
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

function toInvest3DOverviewMarket(market: Invest3DMarketResult): InvestOverviewMarket {
  const combo = market.combos.find((item) => item.avgWins15 >= 15) || market.combos[0];
  return {
    marketId: market.marketId,
    marketName: market.marketName,
    hasAny: Boolean(combo),
    totalCombos: market.combos.length,
    bestWins15: combo?.avgWins15 || 0,
    bestScore: combo?.recommendationScore || combo?.avgScore || 0,
    topCombos: combo
      ? [{ pair: "3d", pairLabel: "3D", combo: compact3DCombo(combo) }]
      : [],
  };
}

function mergeOverviewMarkets(
  twoDimensional: InvestOverviewMarket[],
  threeDimensional: InvestOverviewMarket[],
) {
  const markets = new Map<string, InvestOverviewMarket>();

  for (const market of [...twoDimensional, ...threeDimensional]) {
    const existing = markets.get(market.marketId);
    if (!existing) {
      markets.set(market.marketId, market);
      continue;
    }

    markets.set(market.marketId, {
      marketId: existing.marketId,
      marketName: existing.marketName || market.marketName,
      hasAny: existing.hasAny || market.hasAny,
      totalCombos: existing.totalCombos + market.totalCombos,
      bestWins15: Math.max(existing.bestWins15, market.bestWins15),
      bestScore: Math.max(existing.bestScore, market.bestScore),
      topCombos: [...existing.topCombos, ...market.topCombos],
    });
  }

  return Array.from(markets.values()).sort(
    (a, b) => Number(b.hasAny) - Number(a.hasAny) || a.marketName.localeCompare(b.marketName),
  );
}

export async function GET(request: Request) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const marketId = new URL(request.url).searchParams.get("marketId");

    if (marketId) {
      const market = rankInvestMarkets([await loadInvestForMarket(marketId)])[0];
      return NextResponse.json({ market }, { headers: PRIVATE_MEDIUM_CACHE_HEADERS });
    }

    const [twoDimensional, threeDimensional] = await Promise.all([
      loadInvestOverview().then(rankInvestMarkets),
      loadInvest3DOverview().then(rankInvest3DMarkets),
    ]);

    const markets = mergeOverviewMarkets(
      twoDimensional.filter((market) => market.hasAny).map(toInvestOverviewMarket),
      threeDimensional.filter((market) => market.hasAny).map(toInvest3DOverviewMarket),
    );

    return NextResponse.json(
      { markets },
      { headers: PRIVATE_MEDIUM_CACHE_HEADERS },
    );
  } catch (error) {
    console.error("INVEST_API_ERROR", error);
    return NextResponse.json(
      { error: "Gagal memuat rekomendasi invest" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
