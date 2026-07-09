import { NextResponse } from "next/server";
import { requireActiveAccess } from "@/lib/server/access";
import { NO_STORE_HEADERS, PRIVATE_MEDIUM_CACHE_HEADERS } from "@/lib/server/cacheHeaders";
import {
  loadInvestOverview,
  rankInvestMarkets,
  type InvestComboResult,
  type InvestPair,
  type InvestMarketResult,
} from "@/lib/server/engines/investEngine";
import { generateInvestAngkaJadiForMarket } from "@/lib/server/engines/investAngkaJadi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 80;
const MAX_LIMIT = 120;

type InvestAngkaJadiListRow = {
  marketId: string;
  marketName: string;
  pair: InvestPair;
  pairLabel: string;
  comboId: string;
  comboLabel: string;
  avgWins15: number;
  avgWinsLast5: number;
  expectedLines: number;
  actualLines: number;
  avgScore: number;
  recommendationScore: number;
  recommendationStatus: string;
  riskNote: string;
  latestResult: string;
  lines: string[];
  error?: string;
};

function parsePair(value: string | null): InvestPair {
  if (value === "depan" || value === "tengah" || value === "belakang") return value;
  return "belakang";
}

function parseLimit(value: string | null) {
  const raw = Number(value || DEFAULT_LIMIT);
  if (!Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(raw)));
}

function textIncludes(value: string, q: string) {
  return value.toLowerCase().includes(q);
}

function pairResultOf(market: InvestMarketResult, pair: InvestPair) {
  return market.pairs.find((item) => item.pair === pair) || null;
}

function bestComboForPair(market: InvestMarketResult, pair: InvestPair): InvestComboResult | null {
  const pairResult = pairResultOf(market, pair);
  return pairResult?.combos?.[0] || null;
}

function pairLabelOf(pair: InvestPair) {
  if (pair === "depan") return "2D DEPAN";
  if (pair === "tengah") return "2D TENGAH";
  return "2D BELAKANG";
}

export async function GET(request: Request) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: access.status, headers: NO_STORE_HEADERS });

  try {
    const search = new URL(request.url).searchParams;
    const pair = parsePair(search.get("pair"));
    const q = String(search.get("q") || "").trim().toLowerCase();
    const limit = parseLimit(search.get("limit"));
    const pairLabel = pairLabelOf(pair);

    const markets = rankInvestMarkets(await loadInvestOverview())
      .filter((market) => market.hasAny)
      .filter((market) => Boolean(bestComboForPair(market, pair)))
      .filter((market) => {
        if (!q) return true;
        return textIncludes(market.marketId, q) || textIncludes(market.marketName, q);
      })
      .sort((a, b) => {
        const comboA = bestComboForPair(a, pair);
        const comboB = bestComboForPair(b, pair);
        return (
          (comboB?.avgWins15 || 0) - (comboA?.avgWins15 || 0) ||
          (comboB?.recommendationScore || 0) - (comboA?.recommendationScore || 0) ||
          (comboB?.avgScore || 0) - (comboA?.avgScore || 0) ||
          a.marketName.localeCompare(b.marketName)
        );
      })
      .slice(0, limit);

    const rows: InvestAngkaJadiListRow[] = [];

    for (const market of markets) {
      const pairResult = pairResultOf(market, pair);
      const combo = bestComboForPair(market, pair);
      if (!pairResult || !combo) continue;

      try {
        const result = await generateInvestAngkaJadiForMarket(market.marketId, pair, combo.filters);
        rows.push({
          marketId: market.marketId,
          marketName: market.marketName,
          pair,
          pairLabel: pairResult.pairLabel || pairLabel,
          comboId: combo.id,
          comboLabel: combo.label,
          avgWins15: combo.avgWins15,
          avgWinsLast5: combo.avgWinsLast5,
          expectedLines: combo.expectedLines,
          actualLines: result.lines.length,
          avgScore: combo.avgScore,
          recommendationScore: combo.recommendationScore,
          recommendationStatus: combo.recommendationStatus,
          riskNote: combo.riskNote,
          latestResult: result.latest_result,
          lines: result.lines,
        });
      } catch (e) {
        rows.push({
          marketId: market.marketId,
          marketName: market.marketName,
          pair,
          pairLabel: pairResult.pairLabel || pairLabel,
          comboId: combo.id,
          comboLabel: combo.label,
          avgWins15: combo.avgWins15,
          avgWinsLast5: combo.avgWinsLast5,
          expectedLines: combo.expectedLines,
          actualLines: 0,
          avgScore: combo.avgScore,
          recommendationScore: combo.recommendationScore,
          recommendationStatus: combo.recommendationStatus,
          riskNote: combo.riskNote,
          latestResult: "----",
          lines: [],
          error: e instanceof Error ? e.message : "Gagal membuat Angka Jadi.",
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        pair,
        pairLabel,
        rows,
        count: rows.length,
        generatedAt: new Date().toISOString(),
      },
      { headers: PRIVATE_MEDIUM_CACHE_HEADERS },
    );
  } catch (e) {
    console.error("INVEST_ANGKA_JADI_LIST_ERROR", e);
    return NextResponse.json(
      { success: false, error: "Gagal memuat list Angka Jadi Invest." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
