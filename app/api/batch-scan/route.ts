import { NextResponse } from "next/server";
import { runAutoScan } from "@/lib/engine/acke-engine";
import { HistoryDataFormatError, parseStrictHistory } from "@/lib/engine/history";
import { isScanMode, isShioMode, isTarget2D, isTarget3D } from "@/lib/engine/helpers";
import type { Draw, Posisi, ScanMode, Target2D, Target3D } from "@/lib/engine/types";
import { requireActiveAccess } from "@/lib/server/access";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { tokenizeHistory } from "@/lib/shared/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCH_MARKETS = 35;
const TOP_RANKS = [1, 2, 3] as const;

type MarketRow = { id: string; name: string | null; history_data: string | null };
type BatchLine = { id: string; name: string; digits: string };
type ScanRequest = {
  scanMode: ScanMode;
  targetPos: Posisi;
  target2D: Target2D;
  target3D: Target3D;
  digitCount: number;
  topRanks: number[];
  L: number;
  patah: number;
};
type AdaptiveSnapshot = {
  market_id: unknown;
  market_name: unknown;
  latest_draw: unknown;
  pair_probabilities: unknown;
};

type Body = {
  marketIds?: unknown;
  scanMode?: unknown;
  targetPos?: unknown;
  target2D?: unknown;
  target3D?: unknown;
  digitCount?: unknown;
  topRanks?: unknown;
  L?: unknown;
  patah?: unknown;
  secondary?: unknown;
  outputTitle?: unknown;
  lineSeparator?: unknown;
};

function isPosisi(value: unknown): value is Posisi {
  return value === "A" || value === "C" || value === "K" || value === "E";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

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

function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
}

function readRequest(source: Record<string, unknown>, fallback?: ScanRequest): ScanRequest | string {
  const scanMode = (source.scanMode ?? fallback?.scanMode ?? "bbfs_2d_belakang") as unknown;
  if (!isScanMode(scanMode)) return "Jenis scan tidak valid.";

  const targetPos = source.targetPos ?? fallback?.targetPos ?? "K";
  const target2D = source.target2D ?? fallback?.target2D ?? "belakang";
  const target3D = source.target3D ?? fallback?.target3D ?? "belakang";
  if (!isPosisi(targetPos)) return "Target posisi tidak valid.";
  if (!isTarget2D(target2D)) return "Target 2D tidak valid.";
  if (!isTarget3D(target3D)) return "Target 3D tidak valid.";

  const L = clamp(source.L, fallback?.L ?? 14, 1, 100);
  return {
    scanMode,
    targetPos,
    target2D,
    target3D,
    digitCount: clamp(source.digitCount, fallback?.digitCount ?? 7, 1, 12),
    topRanks: normalizeRanks(source.topRanks ?? fallback?.topRanks),
    L,
    patah: clamp(source.patah, fallback?.patah ?? 0, 0, L),
  };
}

function shioLabel(value: number): string {
  return String(value + 1).padStart(2, "0");
}

function groupByFour(value: string): string {
  return value.replace(/(.{4})(?=.)/g, "$1 ");
}

function formatCandidates(values: number[], scanMode: ScanMode, digitCount: number): string {
  if (!values.length) return "-";
  if (isShioMode(scanMode)) return values.map(shioLabel).join("-");
  const raw = values.join("");
  return scanMode === "ai_3d" && digitCount === 8 ? groupByFour(raw) : raw;
}

function selectedDigits(draws: Draw[], request: ScanRequest): string {
  const maxRank = Math.max(...request.topRanks);
  const result = runAutoScan(draws, {
    L: request.L,
    patah: request.patah,
    targetPos: request.targetPos,
    target2D: request.target2D,
    target3D: request.target3D,
    digitCount: request.digitCount,
    stopScan: maxRank,
    scanMode: request.scanMode,
  });

  return request.topRanks
    .map((rank) => formatCandidates(result.items[rank - 1]?.angkaHidup ?? [], request.scanMode, request.digitCount))
    .join(" | ");
}

function combinations(size: number): number[][] {
  const output: number[][] = [];
  function visit(start: number, current: number[]) {
    if (current.length === size) {
      output.push([...current]);
      return;
    }
    const remaining = size - current.length;
    for (let digit = start; digit <= 10 - remaining; digit++) {
      current.push(digit);
      visit(digit + 1, current);
      current.pop();
    }
  }
  visit(0, []);
  return output;
}

function probabilityMatrix(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length !== 100) return null;
  const matrix = value.map(Number);
  if (!matrix.every((item) => Number.isFinite(item) && item >= 0)) return null;
  const total = matrix.reduce((sum, item) => sum + item, 0);
  return total > 0 ? matrix.map((item) => item / total) : null;
}

function subsetScore(matrix: readonly number[], digits: readonly number[]): number {
  const selected = new Set(digits);
  let score = 0;
  for (let left = 0; left < 10; left++) {
    for (let right = 0; right < 10; right++) {
      if (selected.has(left) && selected.has(right)) score += matrix[left * 10 + right];
    }
  }
  return score;
}

function orderedDigits(matrix: readonly number[], digits: readonly number[]): number[] {
  const fullScore = subsetScore(matrix, digits);
  return [...digits].sort((left, right) => {
    const leftContribution = fullScore - subsetScore(matrix, digits.filter((digit) => digit !== left));
    const rightContribution = fullScore - subsetScore(matrix, digits.filter((digit) => digit !== right));
    return Math.abs(rightContribution - leftContribution) > 1e-12
      ? rightContribution - leftContribution
      : left - right;
  });
}

function adaptiveDigits(matrix: readonly number[], digitCount: number, topRanks: readonly number[]): string {
  const ranked = combinations(digitCount)
    .map((digits) => ({ digits, score: subsetScore(matrix, digits) }))
    .sort((left, right) => {
      if (Math.abs(right.score - left.score) > 1e-12) return right.score - left.score;
      return left.digits.join("").localeCompare(right.digits.join(""));
    });

  return topRanks
    .map((rank) => ranked[rank - 1])
    .filter(Boolean)
    .map((entry) => orderedDigits(matrix, entry.digits).join(""))
    .join(" | ");
}

function latestResult(historyData: string | null | undefined): string | null {
  const tokens = tokenizeHistory(String(historyData ?? ""));
  for (let index = tokens.length - 1; index >= 0; index--) {
    if (/^\d{4}$/.test(tokens[index])) return tokens[index];
  }
  return null;
}

async function loadAdaptiveSnapshots(marketIds: string[], target2D: Target2D): Promise<AdaptiveSnapshot[]> {
  const serviceUrl = process.env.ADAPTIVE_SERVICE_URL?.trim().replace(/\/$/, "");
  const serviceSecret = process.env.ADAPTIVE_SERVICE_SECRET?.trim();
  if (!serviceUrl || !serviceSecret) throw new Error("Adaptive service belum dikonfigurasi.");

  const response = await fetch(`${serviceUrl}/snapshots/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceSecret}`,
    },
    body: JSON.stringify({ marketIds, target2D }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Gagal membaca snapshot Adaptive.");
  }
  return Array.isArray(payload.snapshots) ? payload.snapshots as AdaptiveSnapshot[] : [];
}

export async function POST(req: Request) {
  const access = await requireActiveAccess(req.headers);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const marketIds = normalizeMarketIds(body.marketIds);
    if (!marketIds.length) return NextResponse.json({ error: "Pilih minimal 1 pasaran." }, { status: 400 });
    if (marketIds.length > MAX_BATCH_MARKETS) {
      return NextResponse.json({ error: `Maksimal ${MAX_BATCH_MARKETS} pasaran.` }, { status: 413 });
    }

    const separator = normalizeSeparator(body.lineSeparator);
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("markets")
      .select("id, name, history_data")
      .in("id", marketIds);

    if (error) {
      console.error("[api/batch-scan] Supabase error", error);
      return NextResponse.json({ error: "Gagal mengambil data pasaran." }, { status: 500 });
    }

    const rows = (data ?? []) as MarketRow[];
    const byId = new Map<string, MarketRow>(rows.map((row): [string, MarketRow] => [row.id, row]));

    if (body.scanMode === "adaptive") {
      if (!isTarget2D(body.target2D)) {
        return NextResponse.json({ error: "Target Adaptive tidak valid." }, { status: 400 });
      }
      const digitCount = clamp(body.digitCount, 7, 1, 9);
      const topRanks = normalizeRanks(body.topRanks);
      const snapshots = await loadAdaptiveSnapshots(marketIds, body.target2D);
      const snapshotById = new Map(snapshots.map((snapshot) => [String(snapshot.market_id), snapshot]));
      const results: BatchLine[] = marketIds.map((id) => {
        const market = byId.get(id);
        const snapshot = snapshotById.get(id);
        const name = titleCase(market?.name ?? String(snapshot?.market_name ?? id));
        if (!snapshot) return { id, name, digits: "SNAPSHOT BELUM TERSEDIA" };

        const latest = latestResult(market?.history_data);
        const snapshotDraw = String(snapshot.latest_draw ?? "");
        if (latest && snapshotDraw !== latest) {
          return { id, name, digits: "SNAPSHOT BELUM TERBARU" };
        }

        const matrix = probabilityMatrix(snapshot.pair_probabilities);
        return {
          id,
          name,
          digits: matrix ? adaptiveDigits(matrix, digitCount, topRanks) : "SNAPSHOT BELUM TERSEDIA",
        };
      });
      const title = typeof body.outputTitle === "string" && body.outputTitle.trim()
        ? body.outputTitle.trim().slice(0, 80)
        : `Batch Adaptive ${digitCount} Digit`;
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
    }

    const primarySource = asRecord(body) ?? {};
    const primary = readRequest(primarySource);
    if (typeof primary === "string") return NextResponse.json({ error: primary }, { status: 400 });

    const secondarySource = asRecord(body.secondary);
    const secondary = secondarySource ? readRequest(secondarySource, primary) : null;
    if (typeof secondary === "string") return NextResponse.json({ error: secondary }, { status: 400 });

    const title = typeof body.outputTitle === "string" && body.outputTitle.trim()
      ? body.outputTitle.trim().slice(0, 80)
      : `Batch Scan ${primary.digitCount} Digit`;
    const results: BatchLine[] = [];

    for (const id of marketIds) {
      const market = byId.get(id);
      const name = titleCase(market?.name ?? id);
      if (!market?.history_data) {
        results.push({ id, name, digits: "DATA BELUM TERSEDIA" });
        continue;
      }

      try {
        const draws = parseStrictHistory(market.history_data);
        const first = selectedDigits(draws, primary);
        const second = secondary ? selectedDigits(draws, secondary) : "";
        results.push({ id, name, digits: second ? `${first} · ${second}` : first });
      } catch (error) {
        if (error instanceof HistoryDataFormatError) {
          return NextResponse.json({ error: `Data ${name} salah. ${error.message}` }, { status: 422 });
        }
        throw error;
      }
    }

    const lines = results.map((row) => `${row.name} ${separator} ${row.digits}`);
    return NextResponse.json({
      title,
      results,
      lines,
      copyText: [title, "", ...lines].join("\n"),
      lineSeparator: separator,
      limit: MAX_BATCH_MARKETS,
      topRanks: primary.topRanks,
      secondary: Boolean(secondary),
      adaptive: false,
    });
  } catch (error) {
    console.error("[api/batch-scan] Request error", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Batch scan gagal.",
    }, { status: 400 });
  }
}
