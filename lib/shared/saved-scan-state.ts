import type { BacktestRow, Draw } from "../engine/types";
import {
  savedScanRevision,
  type SavedScanFormula,
  type SavedScanRefreshResult,
} from "./saved-scan";

export type TrackedSavedScan = Omit<SavedScanFormula, "historyTail"> & {
  historyTail?: Draw[];
  snapshotRows: BacktestRow[];
  savedLatestDraw: Draw;
  predictionValues: number[];
  trackingError?: string;
};

export function savedScanRequest(saved: TrackedSavedScan): SavedScanFormula | null {
  if (!saved.kolomHidup.length || !saved.snapshotRows.length) return null;
  const historyTail = saved.historyTail?.length
    ? saved.historyTail
    : [saved.snapshotRows[0].displayDraw, ...saved.snapshotRows.map((row) => row.targetDraw)].slice(
        -10,
      );
  if (!historyTail.every((draw) => /^\d{4}$/.test(draw))) return null;
  return {
    id: saved.id,
    marketId: saved.marketId,
    formula: saved.formula,
    scanMode: saved.scanMode,
    targetPos: saved.targetPos,
    target2D: saved.target2D,
    target3D: saved.target3D,
    kolomHidup: saved.kolomHidup,
    historyTail,
    historyLength: saved.historyLength,
  };
}

export function mergeSavedScanUpdates<T extends TrackedSavedScan>(
  current: T[],
  results: SavedScanRefreshResult[],
): T[] {
  const byId = new Map(results.map((result) => [result.id, result]));
  let changed = false;
  const next = current.map((saved) => {
    const result = byId.get(saved.id);
    const request = savedScanRequest(saved);
    // A stale response must not replace a resaved or already updated trek.
    if (!result || !request || result.revision !== savedScanRevision(request)) return saved;
    if (result.error) {
      if (saved.trackingError === result.error) return saved;
      changed = true;
      return { ...saved, trackingError: result.error };
    }
    const update = result.update;
    if (!update || update.revision !== result.revision) return saved;
    if (
      !update.rows.length &&
      saved.savedLatestDraw === update.latestDraw &&
      saved.historyLength === update.historyLength &&
      !saved.trackingError &&
      JSON.stringify(saved.historyTail) === JSON.stringify(update.historyTail) &&
      JSON.stringify(saved.predictionValues) === JSON.stringify(update.predictionValues)
    )
      return saved;
    changed = true;
    return {
      ...saved,
      snapshotRows: [...saved.snapshotRows, ...update.rows],
      savedLatestDraw: update.latestDraw,
      predictionValues: update.predictionValues,
      historyTail: update.historyTail,
      historyLength: update.historyLength,
      trackingError: undefined,
    };
  });
  return changed ? next : current;
}
