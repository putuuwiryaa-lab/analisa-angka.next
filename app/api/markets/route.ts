import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { NO_STORE_HEADERS, PRIVATE_SHORT_CACHE_HEADERS } from "@/lib/server/cacheHeaders";
import { requireActiveAccess } from "@/lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RawMarket = Record<string, unknown>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MARKET_COLUMN_CANDIDATES = [
  "id,name,updated_at,last_result,history_data,sort_order,sort",
  "id,title,updated_at,last_result,history_data,sort_order,sort",
  "id,slug,updated_at,last_result,history_data,sort_order,sort",
  "id,code,updated_at,last_result,history_data,sort_order,sort",
  "id,name,updated_at,history_data",
  "id,title,updated_at,history_data",
  "id,slug,updated_at,history_data",
  "id,code,updated_at,history_data",
  "id,name",
  "id,title",
  "id,slug",
  "id,code",
  "id",
];

function createSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Konfigurasi Supabase belum lengkap.");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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
  const id = String(market.id ?? market.slug ?? market.code ?? market.name ?? market.title ?? "");
  const name = String(market.name ?? market.title ?? market.slug ?? market.code ?? market.id ?? "Pasaran");

  return {
    id,
    name,
    order: Number(market.sort_order ?? market.sort ?? 99),
    updated_at: market.updated_at ?? market.updatedAt ?? null,
    lastResult: normalizeLastResult(market),
  };
}

async function fetchMarketRows() {
  const supabase = createSupabaseClient();
  const errors: string[] = [];

  for (const columns of MARKET_COLUMN_CANDIDATES) {
    const { data, error } = await supabase.from("markets").select(columns);
    if (!error) return (data || []) as RawMarket[];
    errors.push(`${columns}: ${error.message}`);
  }

  throw new Error(errors[0] || "Gagal memuat markets");
}

export async function GET(request: Request) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status, headers: NO_STORE_HEADERS });
  }

  try {
    const markets = (await fetchMarketRows())
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
