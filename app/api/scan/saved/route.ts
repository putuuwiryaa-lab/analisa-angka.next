import { NextResponse } from "next/server";
import { replaySavedScan } from "@/lib/engine/saved-scan";
import { parseStrictHistory } from "@/lib/engine/history";
import { isTarget2D, isTarget3D } from "@/lib/engine/helpers";
import { KOLOM, SHIO_KOLOM, type Draw } from "@/lib/engine/types";
import { isScanMode, isShioMode } from "@/lib/shared/scan-mode";
import {
  savedScanRevision,
  type SavedScanFormula,
  type SavedScanRefreshResult,
} from "@/lib/shared/saved-scan";
import { requireActiveAccess } from "@/lib/server/access";
import { createAdminClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validFormula(value: unknown): value is SavedScanFormula {
  if (!value || typeof value !== "object") return false;
  const item = value as SavedScanFormula;
  if (
    typeof item.id !== "string" ||
    !item.id ||
    item.id.length > 500 ||
    typeof item.marketId !== "string" ||
    !item.marketId ||
    item.marketId.length > 200 ||
    typeof item.formula !== "string" ||
    item.formula.length > 100 ||
    !isScanMode(item.scanMode) ||
    !["A", "C", "K", "E"].includes(item.targetPos) ||
    !isTarget2D(item.target2D) ||
    !isTarget3D(item.target3D)
  )
    return false;
  const columns: readonly string[] = isShioMode(item.scanMode) ? SHIO_KOLOM : KOLOM;
  return (
    Array.isArray(item.kolomHidup) &&
    item.kolomHidup.length > 0 &&
    item.kolomHidup.length <= columns.length &&
    new Set(item.kolomHidup).size === item.kolomHidup.length &&
    item.kolomHidup.every((column) => columns.includes(column)) &&
    Array.isArray(item.historyTail) &&
    item.historyTail.length > 0 &&
    item.historyTail.length <= 10 &&
    item.historyTail.every((draw) => typeof draw === "string" && /^\d{4}$/.test(draw)) &&
    (item.historyLength === undefined ||
      (Number.isSafeInteger(item.historyLength) && item.historyLength >= item.historyTail.length))
  );
}

export async function POST(req: Request) {
  const access = await requireActiveAccess(req.headers);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const body = await req.json();
    if (!Array.isArray(body?.treks) || body.treks.length > 50 || !body.treks.every(validFormula)) {
      return NextResponse.json(
        { error: "Rumus tersimpan tidak valid. Maksimal 50 trek." },
        { status: 400 },
      );
    }
    const treks: SavedScanFormula[] = body.treks;
    if (!treks.length) return NextResponse.json({ results: [] });
    const marketIds = [...new Set(treks.map((trek) => trek.marketId))];
    const { data, error } = await createAdminClient()
      .from("markets")
      .select("id, history_data")
      .in("id", marketIds);
    if (error) {
      console.error("[api/scan/saved] Supabase error", error);
      return NextResponse.json(
        { error: "Gagal memuat result terbaru. Trek sebelumnya tetap disimpan." },
        { status: 500 },
      );
    }
    const histories = new Map<string, Draw[] | Error>();
    for (const market of data ?? []) {
      try {
        const draws = parseStrictHistory(String(market.history_data ?? ""));
        if (!draws.length) throw new Error("Data pasaran belum tersedia.");
        histories.set(String(market.id), draws);
      } catch (reason) {
        histories.set(
          String(market.id),
          reason instanceof Error ? reason : new Error("Data pasaran tidak valid."),
        );
      }
    }
    const results: SavedScanRefreshResult[] = treks.map((trek) => {
      const revision = savedScanRevision(trek);
      try {
        const draws = histories.get(trek.marketId);
        if (!draws) throw new Error("Data pasaran belum tersedia.");
        if (draws instanceof Error) throw draws;
        return { id: trek.id, revision, update: replaySavedScan(draws, trek) };
      } catch (reason) {
        return {
          id: trek.id,
          revision,
          error: reason instanceof Error ? reason.message : "Gagal memperbarui trek.",
        };
      }
    });
    return NextResponse.json({ results });
  } catch (reason) {
    if (reason instanceof SyntaxError)
      return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
    console.error("[api/scan/saved] Request error", reason);
    return NextResponse.json(
      { error: "Gagal memperbarui trek. Trek sebelumnya tetap disimpan." },
      { status: 500 },
    );
  }
}
