import { NextResponse } from "next/server";
import { requireActiveAccess } from "@/lib/server/access";
import {
  INVEST_3D_TARGET_MAX,
  INVEST_3D_TARGET_MIN,
} from "@/lib/server/engines/invest3dCatalog";
import {
  generateInvest3DAngkaJadiForMarket,
  sanitizeInvest3DFilters,
} from "@/lib/server/engines/invest3dAngkaJadi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: access.status },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const marketId = String(body.marketId || body.market_id || "").trim();
    const filters = sanitizeInvest3DFilters(body.filters);

    if (!marketId || !filters.length) {
      return NextResponse.json(
        { success: false, error: "Request Angka Jadi 3D tidak valid." },
        { status: 400 },
      );
    }

    const result = await generateInvest3DAngkaJadiForMarket(marketId, filters);
    const actualLines = result.lines.length;
    if (actualLines < INVEST_3D_TARGET_MIN || actualLines > INVEST_3D_TARGET_MAX) {
      return NextResponse.json(
        {
          success: false,
          error: `Kombinasi menghasilkan ${actualLines} line, di luar target 500-600.`,
          actual_lines: actualLines,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ success: true, actual_lines: actualLines, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat Angka Jadi Invest 3D.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
