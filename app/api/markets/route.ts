import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RawMarket = Record<string, unknown>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

function normalizeMarket(market: RawMarket) {
  return {
    ...market,
    id: String(market.id ?? market.slug ?? market.code ?? market.name ?? ""),
    name: market.name ?? market.title ?? market.id ?? "Pasaran",
    order: Number(market.order ?? market.sort_order ?? market.sort ?? 99),
    history_data: normalizeHistoryData(market),
  };
}

export async function GET() {
  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Konfigurasi Supabase belum lengkap.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.from("markets").select("*");
    if (error) throw error;

    const markets = (data || [])
      .map(normalizeMarket)
      .filter((market) => market.id)
      .sort((a, b) => Number(a.order ?? 99) - Number(b.order ?? 99));

    return NextResponse.json(markets, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal memuat markets";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
