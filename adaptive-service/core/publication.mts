import type { AdaptiveMethod, AdaptiveSelection } from "./types.mts";

const METHODS = ["ai", "bbfs"] as const satisfies readonly AdaptiveMethod[];
const EXPECTED_SELECTION_COUNT = METHODS.length * 9;

function finiteProbability(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function finiteNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function validWeightMap(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return false;
  const total = entries.reduce((sum, [, raw]) =>
    sum + (typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? raw : Number.NaN), 0);
  return Number.isFinite(total) && Math.abs(total - 1) <= 1e-8;
}

function sameWeightMap(
  left: Readonly<Record<string, number>>,
  right: Readonly<Record<string, number>>,
): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => Math.abs((left[key] ?? 0) - (right[key] ?? 0)) <= 1e-12);
}

export function adaptiveSelectionKey(method: AdaptiveMethod, digitCount: number): string {
  return `${method}:${digitCount}`;
}

export function validateAdaptiveSelection(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "Selection Adaptive harus berupa object.";
  }

  const selection = value as Partial<AdaptiveSelection>;
  if (selection.method !== "ai" && selection.method !== "bbfs") {
    return "Metode selection Adaptive tidak valid.";
  }
  if (!Number.isInteger(selection.digitCount) || Number(selection.digitCount) < 1 || Number(selection.digitCount) > 9) {
    return "Jumlah digit selection Adaptive harus antara 1 dan 9.";
  }
  if (!Array.isArray(selection.digits) || selection.digits.length !== selection.digitCount) {
    return "Jumlah output digit selection Adaptive tidak konsisten.";
  }
  if (selection.digits.some((digit) => !Number.isInteger(digit) || digit < 0 || digit > 9)) {
    return "Digit selection Adaptive harus berupa angka 0 sampai 9.";
  }
  if (new Set(selection.digits).size !== selection.digits.length) {
    return "Digit selection Adaptive tidak boleh duplikat.";
  }
  if (!finiteProbability(selection.estimatedSuccess)) {
    return "Estimated success selection Adaptive tidak valid.";
  }
  if (!finiteProbability(selection.baselineSuccess)) {
    return "Baseline success selection Adaptive tidak valid.";
  }
  if (!finiteNumber(selection.lift)) {
    return "Lift selection Adaptive tidak valid.";
  }
  if (!finiteNumber(selection.selectionMargin) || Number(selection.selectionMargin) < 0) {
    return "Selection margin Adaptive tidak valid.";
  }
  if (!validWeightMap(selection.calibrationWeights)) {
    return "Calibration weights selection Adaptive tidak valid.";
  }
  if (!Number.isInteger(selection.calibrationStateRevision) || Number(selection.calibrationStateRevision) < 0) {
    return "Calibration state revision selection Adaptive tidak valid.";
  }
  return null;
}

export function validateFullAdaptivePublication(value: unknown): string | null {
  if (!Array.isArray(value)) return "Seluruh selection Adaptive harus berupa array.";
  if (value.length !== EXPECTED_SELECTION_COUNT) {
    return `Adaptive harus menerbitkan tepat ${EXPECTED_SELECTION_COUNT} selection.`;
  }

  const keys = new Set<string>();
  for (const item of value) {
    const error = validateAdaptiveSelection(item);
    if (error) return error;
    const selection = item as AdaptiveSelection;
    const key = adaptiveSelectionKey(selection.method, selection.digitCount);
    if (keys.has(key)) return `Selection Adaptive ${key} terduplikasi.`;
    keys.add(key);
  }

  for (const method of METHODS) {
    for (let digitCount = 1; digitCount <= 9; digitCount++) {
      const key = adaptiveSelectionKey(method, digitCount);
      if (!keys.has(key)) return `Selection Adaptive ${key} belum tersedia.`;
    }
  }

  return null;
}

export function requestedSelectionBelongsToPublication(
  requested: AdaptiveSelection,
  selections: readonly AdaptiveSelection[],
): boolean {
  const published = selections.find((selection) =>
    selection.method === requested.method && selection.digitCount === requested.digitCount
  );
  return Boolean(
    published &&
    published.digits.length === requested.digits.length &&
    published.digits.every((digit, index) => digit === requested.digits[index]) &&
    Math.abs(published.estimatedSuccess - requested.estimatedSuccess) <= 1e-12 &&
    Math.abs(published.baselineSuccess - requested.baselineSuccess) <= 1e-12 &&
    Math.abs(published.lift - requested.lift) <= 1e-12 &&
    Math.abs(published.selectionMargin - requested.selectionMargin) <= 1e-12 &&
    published.calibrationStateRevision === requested.calibrationStateRevision &&
    sameWeightMap(published.calibrationWeights, requested.calibrationWeights)
  );
}
