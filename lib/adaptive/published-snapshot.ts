import type { AdaptiveMethod } from "./types";
import {
  ADAPTIVE_CONFIG_VERSION,
  ADAPTIVE_ENGINE_VERSION,
} from "./types";
import type { Target2D } from "@/lib/engine/types";

const COMPLETE_SELECTION_COUNT = 18;

export interface AdaptivePublishedSnapshot {
  predictionId: string;
  marketId: string;
  marketName: string;
  target2D: Target2D;
  latestDraw: string;
  historyLength: number;
  engineVersion: string;
  configVersion: string;
  predictionCreatedAt: string;
  method: AdaptiveMethod;
  digitCount: number;
  digits: number[];
  estimatedSuccess: number;
  baselineSuccess: number;
  lift: number;
  selectionMargin: number;
  signalStrength: "low" | "medium" | "high";
  stateRevision: number;
}

export type AdaptivePublishedSnapshotIssue =
  | "missing"
  | "version"
  | "incomplete"
  | "selection"
  | "stale";

export type AdaptivePublishedSnapshotResult =
  | { ok: true; value: AdaptivePublishedSnapshot }
  | { ok: false; issue: AdaptivePublishedSnapshotIssue; error: string };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function signalStrength(value: unknown): AdaptivePublishedSnapshot["signalStrength"] {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : "low";
}

export function validateAdaptivePublishedSnapshot(
  input: unknown,
  expected: {
    marketId: string;
    target2D: Target2D;
    method: AdaptiveMethod;
    digitCount: number;
    latestDraw: string;
    historyLength: number;
  },
): AdaptivePublishedSnapshotResult {
  const row = record(input);
  if (!row) {
    return {
      ok: false,
      issue: "missing",
      error: "Snapshot Adaptive belum tersedia.",
    };
  }

  if (
    String(row.engine_version ?? "") !== ADAPTIVE_ENGINE_VERSION ||
    String(row.config_version ?? "") !== ADAPTIVE_CONFIG_VERSION
  ) {
    return {
      ok: false,
      issue: "version",
      error: "Snapshot Adaptive menggunakan versi engine atau konfigurasi lama.",
    };
  }

  if (row.snapshot_complete !== true || Number(row.selection_count) !== COMPLETE_SELECTION_COUNT) {
    return {
      ok: false,
      issue: "incomplete",
      error: "Snapshot Adaptive belum mempunyai publikasi lengkap 18 selection.",
    };
  }

  const marketId = String(row.market_id ?? "");
  const target2D = String(row.target_2d ?? "");
  const method = String(row.method ?? "");
  const digitCount = Number(row.digit_count);
  const rawDigits = Array.isArray(row.digits) ? row.digits.map(Number) : [];
  const validDigits = rawDigits.length === expected.digitCount &&
    rawDigits.every((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9) &&
    new Set(rawDigits).size === rawDigits.length;

  if (
    marketId !== expected.marketId ||
    target2D !== expected.target2D ||
    method !== expected.method ||
    digitCount !== expected.digitCount ||
    !validDigits
  ) {
    return {
      ok: false,
      issue: "selection",
      error: "Selection Adaptive tidak sesuai dengan request.",
    };
  }

  const latestDraw = String(row.latest_draw ?? "");
  const historyLength = Number(row.history_length);
  if (latestDraw !== expected.latestDraw || historyLength !== expected.historyLength) {
    return {
      ok: false,
      issue: "stale",
      error: "Snapshot Adaptive belum mengikuti result terbaru.",
    };
  }

  const estimatedSuccess = finite(row.estimated_success);
  const baselineSuccess = finite(row.baseline_success);
  const lift = finite(row.lift);
  const selectionMargin = finite(row.selection_margin);
  const stateRevision = finite(row.state_revision);
  if (
    estimatedSuccess === null ||
    baselineSuccess === null ||
    lift === null ||
    selectionMargin === null ||
    stateRevision === null
  ) {
    return {
      ok: false,
      issue: "selection",
      error: "Metadata selection Adaptive tidak valid.",
    };
  }

  return {
    ok: true,
    value: {
      predictionId: String(row.prediction_id ?? ""),
      marketId,
      marketName: String(row.market_name ?? marketId),
      target2D: expected.target2D,
      latestDraw,
      historyLength,
      engineVersion: String(row.engine_version),
      configVersion: String(row.config_version),
      predictionCreatedAt: String(row.prediction_created_at ?? ""),
      method: expected.method,
      digitCount,
      digits: rawDigits,
      estimatedSuccess,
      baselineSuccess,
      lift,
      selectionMargin,
      signalStrength: signalStrength(row.signal_strength),
      stateRevision: Math.max(0, Math.trunc(stateRevision)),
    },
  };
}
