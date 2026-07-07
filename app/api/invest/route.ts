import { NextResponse } from "next/server";
import {
  loadInvestOverview,
  loadInvestForMarket,
  rankInvestMarkets,
} from "@/lib/server/engines/investEngine";
import { MEDIUM_PUBLIC_CACHE_HEADERS, NO_STORE_HEADERS } from "@/lib/server/cacheHeaders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const marketId = new URL(request.url).searchParams.get("marketId");

    const data = marketId
      ? { market: rankInvestMarkets([await loadInvestForMarket(marketId)])[0] }
      : { markets: rankInvestMarkets(await loadInvestOverview()) };

    return NextResponse.json(data, {
      headers: MEDIUM_PUBLIC_CACHE_HEADERS,
    });
  } catch (e) {
    console.error("INVEST_API_ERROR", e);
    return NextResponse.json(
      { error: "Gagal memuat rekomendasi invest" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
