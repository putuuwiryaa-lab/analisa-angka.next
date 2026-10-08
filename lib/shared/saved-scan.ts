import type {
  BacktestRow,
  Draw,
  Kolom,
  Posisi,
  ScanMode,
  Target2D,
  Target3D,
} from "../engine/types";
import { isOffMode } from "./scan-mode";

export type SavedScanFormula = {
  id: string;
  marketId: string;
  formula: string;
  scanMode: ScanMode;
  targetPos: Posisi;
  target2D: Target2D;
  target3D: Target3D;
  kolomHidup: Kolom[];
  historyTail: Draw[];
  historyLength?: number;
};

export type SavedScanUpdate = {
  id: string;
  revision: string;
  latestDraw: Draw;
  predictionValues: number[];
  rows: BacktestRow[];
  historyTail: Draw[];
  historyLength: number;
};

export type SavedScanRefreshResult = {
  id: string;
  revision: string;
  update?: SavedScanUpdate;
  error?: string;
};

export function savedScanRevision(request: SavedScanFormula): string {
  return JSON.stringify([
    request.id,
    request.marketId,
    request.formula,
    request.scanMode,
    request.targetPos,
    request.target2D,
    request.target3D,
    request.kolomHidup,
    request.historyTail,
    request.historyLength ?? null,
  ]);
}

export function scanRowSucceeded(mode: ScanMode, targets: number[], values: number[]): boolean {
  const uniqueTargets = [...new Set(targets)];
  const hits = uniqueTargets.filter((digit) => values.includes(digit)).length;
  if (isOffMode(mode)) return hits === 0;
  if (mode === "bbfs_2d_belakang" || mode === "bbfs_3d") return hits === uniqueTargets.length;
  if (mode === "ai_3d") return hits >= Math.min(2, uniqueTargets.length);
  return hits > 0;
}
