import { NextResponse } from "next/server";
import {
  loadInvestOverview,
  loadInvestForMarket,
  rankInvestMarkets,
} from "@/lib/server/engines/investEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const marketId = new URL(request.url).searchParams.get("marketId");

    const data = marketId
      ? { market: rankInvestMarkets([await loadInvestForMarket(marketId)])[0] }
      : { markets: rankInvestMarkets(await loadInvestOverview()) };

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
