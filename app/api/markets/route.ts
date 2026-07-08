import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { NO_STORE_HEADERS, PRIVATE_SHORT_CACHE_HEADERS } from "@/lib/server/cacheHeaders";
import { requireActiveAccess } from "@/lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RawMarket = Record<string, unknown>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MARKET_COLUMNS = "id,slug,code,name,title,sort_order,sort,updated_at,last_result";

function normalizeHistoryData(market: RawMarket) {
  return String(
    market.history_data ??
      market.historyData ??
      market.history ??
      market.data ??
      market.results ??
      market.result ??
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

function normalizeLastResult(market: RawMarket) {
  const direct = market.last_result ?? market.lastResult;
  if (typeof direct === "string" && /^\d{4}$/.test(direct.trim())) return direct.trim();
  return getLastResult(normalizeHistoryData(market));
}

function normalizeMarket(market: RawMarket) {
  return {
    id: String(market.id ?? market.slug ?? market.code ?? market.name ?? ""),
    name: market.name ?? market.title ?? market.id ?? "Pasaran",
    order: Number(market.sort_order ?? market.sort ?? 99),
    updated_at: market.updated_at ?? market.updatedAt ?? null,
    lastResult: normalizeLastResult(market),
  };
}

export async function GET(request: Request) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status, headers: NO_STORE_HEADERS });
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Konfigurasi Supabase belum lengkap.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const response = await supabase.from("markets").select(MARKET_COLUMNS);

    if (response.error) throw response.error;

    const markets = (response.data || [])
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
