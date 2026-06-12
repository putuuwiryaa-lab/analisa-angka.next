import { NextResponse } from "next/server";
import { loadInvestOverview, loadInvestForMarket } from "@/lib/server/engines/investEngine";
import { verifyActiveTelegramSession } from "@/lib/server/telegram-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const access = await verifyActiveTelegramSession(request.headers);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const marketId = new URL(request.url).searchParams.get("marketId");

    const data = marketId
      ? { market: await loadInvestForMarket(marketId) }
      : { markets: await loadInvestOverview() };

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
