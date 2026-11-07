import type { TrackedSavedScan } from "./saved-scan-state";
import { savedScanRequest } from "./saved-scan-state";

export type SavedScanSyncStatus =
  | "syncing"
  | "synced"
  | "unchecked"
  | "failed"
  | "legacy";

export type SavedScanSyncInfo = {
  refreshing: boolean;
  refreshError: string;
  statusById: Record<string, "synced" | "failed">;
  checkedAt: string | null;
};

/**
 * A trek is "synced" only after its latest refresh request succeeds.
 * Having saved digits locally does not prove that new results were checked.
 */
export function savedTrekSyncStatus(
  saved: TrackedSavedScan,
  sync: SavedScanSyncInfo,
): SavedScanSyncStatus {
  if (!savedScanRequest(saved)) return "legacy";
  if (sync.refreshing) return "syncing";
  if (sync.refreshError || saved.trackingError || sync.statusById[saved.id] === "failed")
    return "failed";
  return sync.statusById[saved.id] === "synced" ? "synced" : "unchecked";
}

/** An overall green status requires every visible trek to be verified. */
export function overallSavedScanSyncStatus(
  treks: readonly TrackedSavedScan[],
  sync: SavedScanSyncInfo,
): SavedScanSyncStatus {
  if (!treks.length) return "unchecked";
  const statuses = treks.map((saved) => savedTrekSyncStatus(saved, sync));
  if (statuses.includes("syncing")) return "syncing";
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("legacy")) return "legacy";
  if (statuses.includes("unchecked")) return "unchecked";
  return "synced";
}
