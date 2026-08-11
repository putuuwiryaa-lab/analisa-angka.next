import { KOLOM, SHIO_KOLOM } from "@/lib/engine/types";
import { formatMarketName } from "@/lib/markets/format";
import type {
  AutoScanItem,
  AutoScanResult,
  BacktestRow,
  Kolom,
  Posisi,
  ScanMode,
  Target2D,
  Target3D,
} from "@/lib/engine/types";
import {
  is3DMode,
  isJumlah2DMode,
  isOffMode,
  isPositionMode,
  isShioMode,
} from "@/lib/shared/scan-mode";

export type Market = {
  id: string;
  name: string;
  lastResult?: string;
  updated_at?: string | null;
};

export type SavedTrek = {
  version: 2;
  id: string;
  savedAt: string;
  marketId: string;
  marketName: string;
  scanMode: ScanMode;
  targetPos: Posisi;
  target2D: Target2D;
  target3D: Target3D;
  digitCount: number;
  L: number;
  patah: number;
  formula: string;
  code: string;
  kolomHidup: Kolom[];
  activeColumns: string;
  predictionValues: number[];
  snapshotRows: BacktestRow[];
  savedLatestDraw: string;
  legacy?: boolean;
};

export type SavedGroup = {
  key: string;
  marketName: string;
  scanMode: ScanMode;
  targetPos: Posisi;
  target2D: Target2D;
  target3D: Target3D;
  digitCount: number;
  L: number;
  patah: number;
  items: SavedTrek[];
};

export type DetailRow = {
  draw: string;
  values: { label: string; hit: boolean }[];
  status: string;
};

export type DetailData = {
  title: string;
  description: string;
  rows: DetailRow[];
  pendingDraw: string;
  pendingValues: string[];
};

export const STORAGE_KEY = "analisa_scan_saved_treks_v2";
export const LEGACY_STORAGE_KEY = "analisa_scan_saved_treks_v1";

export const POSITION_LABEL: Record<Posisi, string> = {
  A: "AS",
  C: "COP",
  K: "KPL",
  E: "EKR",
};

export const MODE_OPTIONS: { value: ScanMode; label: string; digits: number }[] = [
  { value: "posisi", label: "Posisi", digits: 7 },
  { value: "ai_2d_belakang", label: "AI 2D", digits: 4 },
  { value: "bbfs_2d_belakang", label: "BBFS 2D", digits: 7 },
  { value: "jumlah_2d_belakang", label: "Jumlah 2D", digits: 4 },
  { value: "ai_3d", label: "AI 3D", digits: 8 },
  { value: "bbfs_3d", label: "BBFS 3D", digits: 8 },
  { value: "off_posisi", label: "OFF Posisi", digits: 3 },
  { value: "off_2d_belakang", label: "OFF 2D", digits: 3 },
  { value: "off_jumlah_2d_belakang", label: "OFF Jumlah 2D", digits: 3 },
  { value: "off_3d", label: "OFF 3D", digits: 3 },
  { value: "shio", label: "Shio", digits: 6 },
  { value: "off_shio", label: "OFF Shio", digits: 6 },
];

const MODE_VALUES = new Set<ScanMode>(MODE_OPTIONS.map((option) => option.value));

export function marketLabel(market: Market) {
  return formatMarketName(market.name, market.id);
}

export function modeLabel(mode: ScanMode) {
  return MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}

function capitalized(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function analysisTitle(mode: ScanMode, targetPos: Posisi, target2D: Target2D, target3D: Target3D) {
  const label = modeLabel(mode);
  if (isShioMode(mode)) return label;
  if (isPositionMode(mode)) return `${label} ${POSITION_LABEL[targetPos]}`;
  if (is3DMode(mode)) return `${label} ${capitalized(target3D)}`;
  return `${label} ${capitalized(target2D)}`;
}

export function scanDescription(item: AutoScanItem, count: number) {
  const unit = isShioMode(item.scanMode) ? "shio" : "digit";
  return `${analysisTitle(item.scanMode, item.targetPos, item.target2D, item.target3D)} ${count} ${unit}`;
}

export function savedDescription(saved: SavedTrek) {
  const unit = isShioMode(saved.scanMode) ? "shio" : "digit";
  return `${analysisTitle(saved.scanMode, saved.targetPos, saved.target2D, saved.target3D)} ${saved.digitCount} ${unit} · ${saved.L} data · patah ${saved.patah}`;
}

export function labelValue(value: number, mode: ScanMode) {
  return isShioMode(mode) ? String(value + 1).padStart(2, "0") : String(value);
}

export function labelsFromValues(values: number[], mode: ScanMode) {
  return values.map((value) => labelValue(value, mode));
}

export function displayDigits(values: number[], mode: ScanMode) {
  return labelsFromValues(values, mode).join(isShioMode(mode) ? "-" : "");
}

export function pickColumns(columns: Kolom[], deret: number[]) {
  const source: readonly string[] = deret.length === 12 ? SHIO_KOLOM : KOLOM;
  return columns
    .map((column) => deret[source.indexOf(column)])
    .filter((digit): digit is number => Number.isFinite(digit));
}

function targetDigits(row: BacktestRow) {
  return row.targetDigits?.length ? row.targetDigits : [row.targetDigit];
}

function valuesForColumns(columns: Kolom[], row: BacktestRow) {
  const targets = targetDigits(row);
  return pickColumns(columns, row.deret).map((digit) => ({ digit, hit: targets.includes(digit) }));
}

function statusFor(mode: ScanMode, targets: number[], values: number[]) {
  const hitCount = targets.filter((digit) => values.includes(digit)).length;
  if (isOffMode(mode)) return values.some((digit) => targets.includes(digit)) ? "❌" : "✅";
  if (mode === "bbfs_2d_belakang" || mode === "bbfs_3d") {
    return targets.every((digit) => values.includes(digit)) ? "✅" : "❌";
  }
  if (mode === "ai_3d") return hitCount >= Math.min(2, targets.length) ? "✅" : "❌";
  return values.some((digit) => targets.includes(digit)) ? "✅" : "❌";
}

export function predictionValues(item: AutoScanItem) {
  const values = pickColumns(item.kolomHidup, item.result.deretLive);
  return isJumlah2DMode(item.scanMode) ? values.filter((digit) => digit !== 0) : values;
}

export function buildFrequencyRows(result: AutoScanResult) {
  const maximum = isShioMode(result.config.scanMode) ? 12 : 10;
  const counts = Array.from({ length: maximum }, () => 0);
  for (const item of result.items) {
    for (const value of item.angkaHidup) {
      if (Number.isInteger(value) && value >= 0 && value < counts.length) counts[value] += 1;
    }
  }
  return counts
    .map((count, value) => ({ value, label: labelValue(value, result.config.scanMode), count }))
    .sort((left, right) => right.count - left.count || left.value - right.value);
}

export function buildSavedGroups(savedTreks: SavedTrek[]) {
  const groups: SavedGroup[] = [];
  for (const item of savedTreks) {
    const key = [item.marketName, item.scanMode, item.targetPos, item.target2D, item.target3D, item.digitCount, item.L, item.patah].join(":");
    const current = groups.find((group) => group.key === key);
    if (current) current.items.push(item);
    else groups.push({
      key,
      marketName: item.marketName,
      scanMode: item.scanMode,
      targetPos: item.targetPos,
      target2D: item.target2D,
      target3D: item.target3D,
      digitCount: item.digitCount,
      L: item.L,
      patah: item.patah,
      items: [item],
    });
  }
  return groups;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numberArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item))
    : [];
}

export function normalizeStoredTrek(value: unknown): SavedTrek | null {
  if (!isRecord(value)) return null;
  const rawMode = value.scanMode ?? value.mode;
  if (typeof rawMode !== "string" || !MODE_VALUES.has(rawMode as ScanMode)) return null;
  const scanMode = rawMode as ScanMode;
  const id = typeof value.id === "string" ? value.id : `${Date.now()}-${Math.random()}`;
  const marketId = typeof value.marketId === "string" ? value.marketId : "";
  const marketName = typeof value.marketName === "string" ? value.marketName : marketId || "Pasaran";
  const prediction = numberArray(value.predictionValues ?? value.digits);
  const rows = Array.isArray(value.snapshotRows) ? value.snapshotRows as BacktestRow[] : [];
  const columns = Array.isArray(value.kolomHidup) ? value.kolomHidup as Kolom[] : [];

  return {
    version: 2,
    id,
    savedAt: typeof value.savedAt === "string" ? value.savedAt : typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    marketId,
    marketName,
    scanMode,
    targetPos: value.targetPos === "A" || value.targetPos === "C" || value.targetPos === "E" ? value.targetPos : "K",
    target2D: value.target2D === "depan" || value.target2D === "tengah" ? value.target2D : "belakang",
    target3D: value.target3D === "depan" ? "depan" : "belakang",
    digitCount: typeof value.digitCount === "number" ? value.digitCount : prediction.length,
    L: typeof value.L === "number" ? value.L : 0,
    patah: typeof value.patah === "number" ? value.patah : 0,
    formula: typeof value.formula === "string" ? value.formula : "Trek",
    code: typeof value.code === "string" ? value.code : id,
    kolomHidup: columns,
    activeColumns: typeof value.activeColumns === "string" ? value.activeColumns : columns.join(""),
    predictionValues: prediction,
    snapshotRows: rows,
    savedLatestDraw: typeof value.savedLatestDraw === "string" ? value.savedLatestDraw : "----",
    legacy: columns.length === 0 || rows.length === 0,
  };
}

export function readStoredTreks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY) ?? "[]";
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeStoredTrek).filter((item): item is SavedTrek => Boolean(item)).slice(0, 50);
  } catch {
    return [];
  }
}

export function liveDetail(item: AutoScanItem, marketName: string, digitCount: number): DetailData {
  return {
    title: marketName.toUpperCase(),
    description: scanDescription(item, digitCount),
    rows: item.result.rows.map((row) => {
      const values = valuesForColumns(item.kolomHidup, row);
      return {
        draw: row.displayDraw,
        values: values.map(({ digit, hit }) => ({ label: labelValue(digit, item.scanMode), hit })),
        status: statusFor(item.scanMode, targetDigits(row), values.map(({ digit }) => digit)),
      };
    }),
    pendingDraw: item.result.latestDraw,
    pendingValues: labelsFromValues(predictionValues(item), item.scanMode),
  };
}

export function savedDetail(saved: SavedTrek): DetailData {
  return {
    title: saved.marketName.toUpperCase(),
    description: savedDescription(saved),
    rows: saved.snapshotRows.map((row) => {
      const values = valuesForColumns(saved.kolomHidup, row);
      return {
        draw: row.displayDraw,
        values: values.map(({ digit, hit }) => ({ label: labelValue(digit, saved.scanMode), hit })),
        status: statusFor(saved.scanMode, targetDigits(row), values.map(({ digit }) => digit)),
      };
    }),
    pendingDraw: saved.savedLatestDraw,
    pendingValues: labelsFromValues(saved.predictionValues, saved.scanMode),
  };
}

export function detailCopyText(detail: DetailData) {
  const history = detail.rows.map((row) => `${row.draw} ➜ ${row.values.map((value) => value.label).join(" ")} ${row.status}`);
  return [`*${detail.title}*`, detail.description, "", ...history, `${detail.pendingDraw} ➜ ${detail.pendingValues.join(" ")} ??`].join("\n");
}
