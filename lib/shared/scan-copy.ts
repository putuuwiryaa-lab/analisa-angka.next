import { isJalurMode, isShioMode, type ScanMode } from "./scan-mode";

/** Copy the displayed Scan values, without formula names or market metadata. */
export function formatScanCopyValues(values: readonly number[], mode: ScanMode): string {
  if (isShioMode(mode)) return values.map((value) => String(value + 1).padStart(2, "0")).join("-");
  if (isJalurMode(mode)) return values.join(" ");
  return values.join("");
}

export function formatScanCopyAll(
  items: readonly { angkaHidup: readonly number[]; scanMode: ScanMode }[],
): string {
  // Preserve the visible ranking, including rows that happen to contain equal values.
  return items.map((item) => formatScanCopyValues(item.angkaHidup, item.scanMode)).join("\n");
}

/** Copy only Treks shown in the current saved-Trek groups, in screen order. */
export function formatSavedTrekCopyAll(
  groups: readonly {
    items: readonly { predictionValues: readonly number[]; scanMode: ScanMode }[];
  }[],
): string {
  return groups
    .flatMap((group) => group.items.map((item) => formatScanCopyValues(item.predictionValues, item.scanMode)))
    .filter((line) => line.length > 0)
    .join("\n");
}
