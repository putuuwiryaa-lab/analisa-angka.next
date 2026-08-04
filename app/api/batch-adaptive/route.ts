import { NextResponse } from "next/server";
import { isTarget2D } from "@/lib/engine/helpers";
import type { Target2D } from "@/lib/engine/types";
import { requireActiveAccess } from "@/lib/server/access";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { tokenizeHistory } from "@/lib/shared/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCH_MARKETS = 35;
const TOP_RANKS = [1, 2, 3] as const;

type MarketRow = {
  id: string;
  name: string | null;
  history_data: string | null;
  last_result: string | null;
};

type SnapshotSelection = {
  rank: number;
  digits: number[];
};

type SnapshotResult = {
  marketId: string;
  marketName: string;
  status: "fresh" | "stale" | "missing";
  selections: SnapshotSelection[];
};

type Body = {
  marketIds?: unknown;
  target2D?: unknown;
  digitCount?: unknown;
  topRanks?: unknown;
  outputTitle?: unknown;
  lineSeparator?: unknown;
};

function normalizeMarketIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function normalizeRanks(value: unknown): number[] {
  if (!Array.isArray(value)) return [1];
  const selected = TOP_RANKS.filter((rank) => value.map(Number).includes(rank));
  return selected.length ? [...selected] : [1];
}

function normalizeSeparator(value: unknown): string {
  const separator = String(value ?? "➜").replace(/[\r\n\t]+/g, " ").trim().slice(0, 16);
  return separator || "➜";
}

function clampDigitCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 7;
  return Math.max(1, Math.min(9, Math.trunc(parsed)));
}

function titleCase(value: string): string {
  return value.toLowerCase().replace(
    /(^|[\s-])([a-z])/g,
    (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`,
  );
}

function latestResult(market: MarketRow | undefined): string | null {
  const direct = String(market?.last_result ?? "").trim();
  if (/^\d{4}$/.test(direct)) return direct;

  const tokens = tokenizeHistory(String(market?.history_data ?? ""));
  for (let index = tokens.length - 1; index >= 0; index--) {
    if (/^\d{4}$/.test(tokens[index])) return tokens[index];
  }
  return null;
}

async function loadSnapshots(options: {
  marketIds: string[];
  target2D: Target2D;
  digitCount: number;
  topRanks: number[];
  latestResults: Record<string, string>;
}): Promise<SnapshotResult[]> {
  const serviceUrl = process.env.ADAPTIVE_SERVICE_URL?.trim().replace(/\/$/, "");
  const serviceSecret = process.env.ADAPTIVE_SERVICE_SECRET?.trim();
  if (!serviceUrl) throw new Error("Adaptive service belum dikonfigurasi.");
  if (!serviceSecret) throw new Error("ADAPTIVE_SERVICE_SECRET belum dikonfigurasi.");

  const response = await fetch(`${serviceUrl}/snapshots/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceSecret}`,
    },
    body: JSON.stringify(options),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : `Adaptive service gagal (${response.status}).`,
    );
  }
  if (!Array.isArray(payload.results)) {
    throw new Error("Adaptive service tidak mengembalikan snapshot batch.");
  }
  return payload.results as SnapshotResult[];
}

export async function POST(request: Request) {
  const access = await requireActiveAccess(request.headers);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const marketIds = normalizeMarketIds(body.marketIds);
    if (!marketIds.length) {
      return NextResponse.json({ error: "Pilih minimal 1 pasaran." }, { status: 400 });
    }
    if (marketIds.length > MAX_BATCH_MARKETS) {
      return NextResponse.json(
        { error: `Maksimal ${MAX_BATCH_MARKETS} pasaran.` },
        { status: 413 },
      );
    }

    if (!isTarget2D(body.target2D)) {
      return NextResponse.json({ error: "Target Adaptive tidak valid." }, { status: 400 });
    }
    const target2D = body.target2D as Target2D;
    const digitCount = clampDigitCount(body.digitCount);
    const topRanks = normalizeRanks(body.topRanks);
    const separator = normalizeSeparator(body.lineSeparator);
    const title = typeof body.outputTitle === "string" && body.outputTitle.trim()
      ? body.outputTitle.trim().slice(0, 80)
      : `Batch Adaptive ${digitCount} Digit`;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("markets")
      .select("id, name, history_data, last_result")
      .in("id", marketIds);

    if (error) {
      console.error("[api/batch-adaptive] Supabase error", error);
      return NextResponse.json(
        { error: "Gagal mengambil data pasaran." },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as MarketRow[];
    const byId = new Map(rows.map((row): [string, MarketRow] => [row.id, row]));
    const latestResults: Record<string, string> = {};
    for (const marketId of marketIds) {
      const result = latestResult(byId.get(marketId));
      if (result) latestResults[marketId] = result;
    }

    const snapshots = await loadSnapshots({
      marketIds,
      target2D,
      digitCount,
      topRanks,
      latestResults,
    });
    const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.marketId, snapshot]));
    const results = marketIds.map((id) => {
      const market = byId.get(id);
      const snapshot = snapshotById.get(id);
      const name = titleCase(market?.name ?? snapshot?.marketName ?? id);

      if (!snapshot || snapshot.status === "missing") {
        return { id, name, digits: "SNAPSHOT BELUM TERSEDIA" };
      }
      if (snapshot.status === "stale") {
        return { id, name, digits: "SNAPSHOT BELUM TERBARU" };
      }

      const digits = snapshot.selections
        .map((selection) => selection.digits.join(""))
        .join(" | ");
      return {
        id,
        name,
        digits: digits || "SNAPSHOT BELUM TERSEDIA",
      };
    });

    const lines = results.map((row) => `${row.name} ${separator} ${row.digits}`);
    return NextResponse.json({
      title,
      results,
      lines,
      copyText: [title, "", ...lines].join("\n"),
      lineSeparator: separator,
      limit: MAX_BATCH_MARKETS,
      topRanks,
      secondary: false,
      adaptive: true,
    });
  } catch (error) {
    console.error("[api/batch-adaptive] Request error", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Batch Adaptive gagal.",
    }, { status: 400 });
  }
}
