import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { verifyActiveTelegramSession } from "@/lib/server/telegram-session";
import { runBbfs7WalkForward, type TargetPair } from "@/lib/analysis/bbfs7Trial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const MIN_HISTORY = 15;
const VALID_TARGET_PAIRS = new Set(["depan", "tengah", "belakang"]);

type MarketRow = Record<string, unknown>;

function normalizeMarket(market: MarketRow) {
  const historyData = String(
    market.history_data ??
      market.historyData ??
      market.history ??
      market.data ??
      market.results ??
      market.result ??
      "",
  );

  return {
    id: String(market.id ?? market.slug ?? market.code ?? market.name ?? ""),
    name: String(market.name ?? market.title ?? market.id ?? "Pasaran"),
    order: Number(market.order ?? market.sort_order ?? market.sort ?? 99),
    updatedAt: String(market.updated_at ?? "") || null,
    data: historyData
      .split(/[\s\n\r\t,;|]+/)
      .map((item) => item.trim())
      .filter((item) => /^\d{4}$/.test(item)),
  };
}

function parseMarketIds(value: string | null) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  const access = await verifyActiveTelegramSession(request.headers);

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const search = request.nextUrl.searchParams;
    const targetPair = String(search.get("targetPair") || "belakang") as TargetPair;

    if (!VALID_TARGET_PAIRS.has(targetPair)) {
      return NextResponse.json(
        { error: "Target tidak valid." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const rawLimit = Math.max(1, Number(search.get("limit") || DEFAULT_LIMIT) || DEFAULT_LIMIT);
    const limit = Math.min(rawLimit, MAX_LIMIT);
    const requestedIds = parseMarketIds(search.get("marketIds")).slice(0, limit);

    if (!requestedIds.length) {
      return NextResponse.json(
        { error: "Pilih minimal satu pasaran." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.from("markets").select("*").in("id", requestedIds);

    if (error) throw error;

    const requestedOrder = new Map(requestedIds.map((id, index) => [id.toLowerCase(), index]));
    const markets = ((data || []) as MarketRow[])
      .map(normalizeMarket)
      .filter((market) => market.id && market.data.length >= MIN_HISTORY)
      .sort((a, b) => {
        const aOrder = requestedOrder.get(a.id.toLowerCase()) ?? a.order;
        const bOrder = requestedOrder.get(b.id.toLowerCase()) ?? b.order;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name, "id");
      });

    const rows = markets.map((market) => {
      const result = runBbfs7WalkForward(market.data, targetPair, {
        startWindow: 14,
        step: 7,
        maxWindow: 140,
      });

      return {
        marketId: market.id,
        marketName: market.name,
        result: result.nextBbfsDigits || "-",
        updatedAt: market.updatedAt,
        order: market.order,
      };
    });

    return NextResponse.json(
      { rows, limit, targetPair },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal generate BBFS 7D.";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
