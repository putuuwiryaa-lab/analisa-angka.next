import "server-only";

import type { Target2D } from "@/lib/engine/types";

export interface AdaptiveBatchSnapshotSelection {
  rank: number;
  digits: number[];
  estimatedSuccess: number;
  baselineSuccess: number;
  lift: number;
  selectionMargin: number;
}

export interface AdaptiveBatchSnapshotResult {
  marketId: string;
  marketName: string;
  status: "fresh" | "stale" | "missing";
  latestDraw: string | null;
  expectedLatestDraw: string | null;
  signalStrength: "low" | "medium" | "high" | null;
  driftState: "stable" | "warning" | "drift" | "recovery" | null;
  stateRevision: number | null;
  selections: AdaptiveBatchSnapshotSelection[];
}

interface AdaptiveBatchSnapshotOptions {
  marketIds: string[];
  target2D: Target2D;
  digitCount: number;
  topRanks: number[];
  latestResults: Record<string, string>;
}

function serviceConfiguration(): { serviceUrl: string; serviceSecret: string } {
  const serviceUrl = process.env.ADAPTIVE_SERVICE_URL?.trim();
  if (!serviceUrl) throw new Error("Adaptive service belum dikonfigurasi.");

  const serviceSecret = process.env.ADAPTIVE_SERVICE_SECRET?.trim();
  if (!serviceSecret) throw new Error("ADAPTIVE_SERVICE_SECRET belum dikonfigurasi.");

  return {
    serviceUrl: serviceUrl.replace(/\/$/, ""),
    serviceSecret,
  };
}

export async function loadAdaptiveBatchSnapshots(
  options: AdaptiveBatchSnapshotOptions,
): Promise<AdaptiveBatchSnapshotResult[]> {
  const configuration = serviceConfiguration();
  const response = await fetch(`${configuration.serviceUrl}/snapshots/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${configuration.serviceSecret}`,
    },
    body: JSON.stringify(options),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : `Adaptive service gagal (${response.status}).`,
    );
  }

  if (!Array.isArray(payload.results)) {
    throw new Error("Adaptive service tidak mengembalikan snapshot batch.");
  }

  return payload.results as AdaptiveBatchSnapshotResult[];
}
