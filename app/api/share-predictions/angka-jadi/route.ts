import { NextResponse } from "next/server";
import { requireActiveAccess } from "@/lib/server/access";
import { NO_STORE_HEADERS } from "@/lib/server/cacheHeaders";
import {
  generateShareAngkaJadiBatch,
  sanitizeShareAngkaJadiConfig,
  sanitizeShareAngkaJadiFocus,
  sanitizeShareAngkaJadiMarketIds,
  shareAngkaJadiMethodCount,
} from "@/lib/server/engines/shareAngkaJadi";
import { attachShareMethodDetails } from "@/lib/server/engines/shareMethodDetails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: access.status, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const focus = sanitizeShareAngkaJadiFocus(body.focus);
    const config = sanitizeShareAngkaJadiConfig(body.config, focus);
    const marketIds = sanitizeShareAngkaJadiMarketIds(body.marketIds || body.market_ids);

    if (!marketIds.length) {
      return NextResponse.json(
        { success: false, error: "Pilih minimal satu pasaran." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (shareAngkaJadiMethodCount(config) < 1) {
      return NextResponse.json(
        { success: false, error: "Pilih minimal satu metode." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const result = await generateShareAngkaJadiBatch(focus, config, marketIds);
    const rows = await attachShareMethodDetails(result.rows, focus, config);
    return NextResponse.json({ success: true, ...result, rows }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat rekap angka jadi.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
