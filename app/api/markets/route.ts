import { NextResponse } from "next/server";
import { NO_STORE_HEADERS, PRIVATE_SHORT_CACHE_HEADERS } from "@/lib/server/cacheHeaders";
import { requireActiveAccess } from "@/lib/server/access";
import { createAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MARKET_COLUMNS = "id,name,history_data,market_order:order,updated_at,last_result";

function readMarketField(market: unknown, field: string) {
  if (!market || typeof market !== "object") return undefined;
  return Reflect.get(market, field);
}

function normalizeHistoryData(market: unknown) {
  return String(
    readMarketField(market, "history_data") ??
      readMarketField(market, "historyData") ??
      readMarketField(market, "history") ??
      readMarketField(market, "data") ??
      readMarketField(market, "results") ??
      readMarketField(market, "result") ??
      "",
  );
}

function getLastResult(historyData: string) {
  const tokens = historyData
    .trim()
    .split(/[\s\n\r\t,;|]+/);

  for (let i = tokens.length - 1; i >= 0; i--) {
    if (/^\d{4}$/.test(tokens[i])) return tokens[i];
  }

  return "----";
}

function normalizeLastResult(market: unknown) {
  const direct = readMarketField(market, "last_result") ?? readMarketField(market, "lastResult");
  if (typeof direct === "string" && /^\d{4}$/.test(direct.trim())) return direct.trim();
  return getLastResult(normalizeHistoryData(market));
}

function normalizeMarket(market: unknown) {
  const id = readMarketField(market, "id");
  const name = readMarketField(market, "name");
  const order = readMarketField(market, "market_order") ?? readMarketField(market, "order");

  return {
    id: String(id ?? ""),
    name: String(name ?? id ?? "Pasaran"),
    order: Number(order ?? 99),
    updated_at: readMarketField(market, "updated_at") ?? readMarketField(market, "updatedAt") ?? null,
    lastResult: normalizeLastResult(market),
  };
}

export async function GET(request: Request) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status, headers: NO_STORE_HEADERS });
  }

  try {
    const supabase = createAdminClient();
    const response = await supabase.from("markets").select(MARKET_COLUMNS).order("order", { ascending: true });

    if (response.error) throw response.error;

    const rows: unknown[] = response.data || [];
    const markets = rows
      .map(normalizeMarket)
      .filter((market) => market.id)
      .sort((a, b) => Number(a.order ?? 99) - Number(b.order ?? 99));

    return NextResponse.json(markets, {
      headers: PRIVATE_SHORT_CACHE_HEADERS,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal memuat markets";
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
