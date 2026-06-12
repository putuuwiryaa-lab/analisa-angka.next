import { NextResponse } from "next/server";
import { loadInvestOverview, loadInvestForMarket } from "@/lib/server/engines/investEngine";
import { verifyActiveTelegramSession } from "@/lib/server/telegram-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await verifyActiveTelegramSession(request.headers);

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const marketId = new URL(request.url).searchParams.get("marketId");

    const data = marketId
      ? { market: await loadInvestForMarket(marketId) }
      : { markets: await loadInvestOverview() };

    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal memuat rekomendasi invest";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
