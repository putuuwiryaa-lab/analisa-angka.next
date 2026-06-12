import { NextResponse } from "next/server";
import { loadInvestOverview, loadInvestForMarket } from "@/lib/server/engines/investEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const marketId = new URL(request.url).searchParams.get("marketId");

    const data = marketId
      ? { market: await loadInvestForMarket(marketId) }
      : { markets: await loadInvestOverview() };

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal memuat rekomendasi invest";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
