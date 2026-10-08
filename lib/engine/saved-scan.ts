// Initialize the same formula registry (including fresh packs) used by Scan.
import "./acke-engine";
import { ALL_FORMULA_SPECS, computeFormula } from "./formulas";
import {
  buildDeret,
  buildDeretShio,
  digitsFromDeretColumns,
  isShioMode,
  targetDigitsOf,
} from "./helpers";
import { KOLOM, SHIO_KOLOM, type BacktestRow, type Draw } from "./types";
import {
  savedScanRevision,
  type SavedScanFormula,
  type SavedScanUpdate,
} from "../shared/saved-scan";

function anchorEnd(draws: Draw[], request: SavedScanFormula): number {
  const tail = request.historyTail;
  const matches = (end: number) =>
    end >= tail.length - 1 &&
    end < draws.length &&
    tail.every((draw, offset) => draws[end - tail.length + 1 + offset] === draw);
  // Prefer the known index when history grows, including repeated 4D results.
  if (request.historyLength && matches(request.historyLength - 1)) return request.historyLength - 1;
  const matchesAt: number[] = [];
  for (let end = tail.length - 1; end < draws.length; end += 1) {
    if (matches(end)) matchesAt.push(end);
  }
  if (matchesAt.length === 1) return matchesAt[0];
  if (matchesAt.length > 1)
    throw new Error(
      "Urutan result berulang belum dapat dipastikan. Trek sebelumnya tetap disimpan.",
    );
  throw new Error(
    "Riwayat pasaran berubah atau terputus. Trek sebelumnya tetap disimpan; simpan ulang dari Scan untuk mulai trek baru.",
  );
}

export function replaySavedScan(draws: Draw[], request: SavedScanFormula): SavedScanUpdate {
  const spec = ALL_FORMULA_SPECS.find((item) => item.formula === request.formula);
  if (!spec) throw new Error("Rumus tersimpan sudah tidak tersedia. Simpan ulang rumus dari Scan.");
  if (!request.historyTail.length)
    throw new Error("Trek lama belum memiliki riwayat. Simpan ulang rumus dari Scan.");
  if (draws.length < spec.patokanN)
    throw new Error("Data pasaran belum cukup untuk rumus tersimpan.");
  const end = anchorEnd(draws, request);
  const columns = isShioMode(request.scanMode) ? SHIO_KOLOM : KOLOM;
  const deretAt = (targetIndex: number) => {
    const start = computeFormula(spec, draws, targetIndex);
    return isShioMode(request.scanMode) ? buildDeretShio(start) : buildDeret(start);
  };
  const rows: BacktestRow[] = [];
  for (let t = end + 1; t < draws.length; t += 1) {
    if (t < spec.patokanN)
      throw new Error("Riwayat sumber rumus belum lengkap. Trek sebelumnya tetap disimpan.");
    const deret = deretAt(t);
    const targetDigits = targetDigitsOf(
      draws[t],
      request.scanMode,
      request.targetPos,
      request.target2D,
      request.target3D,
    );
    rows.push({
      displayDraw: draws[t - 1],
      patokanDraw: draws[t - spec.patokanN],
      targetDraw: draws[t],
      patokan: deret[0],
      deret,
      targetDigit: targetDigits[0],
      targetDigits,
      kolomKena: columns[deret.indexOf(targetDigits[0])],
    });
  }
  return {
    id: request.id,
    revision: savedScanRevision(request),
    latestDraw: draws[draws.length - 1],
    predictionValues: digitsFromDeretColumns(deretAt(draws.length), request.kolomHidup),
    rows,
    historyTail: draws.slice(-10),
    historyLength: draws.length,
  };
}
