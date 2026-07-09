import { NextResponse } from "next/server";
import { requireActiveAccess } from "@/lib/server/access";
import {
  generateInvestAngkaJadiForMarket,
  sanitizeInvestFilters,
  sanitizeInvestPair,
} from "@/lib/server/engines/investAngkaJadi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: access.status });

  try {
    const body = await request.json().catch(() => ({}));
    const marketId = String(body.marketId || body.market_id || "").trim();
    const pair = sanitizeInvestPair(body.pair);
    const filters = sanitizeInvestFilters(body.filters);

    if (!marketId || !filters.length) {
      return NextResponse.json({ success: false, error: "Request Angka Jadi tidak valid." }, { status: 400 });
    }

    const result = await generateInvestAngkaJadiForMarket(marketId, pair, filters);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal membuat Angka Jadi Invest.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
