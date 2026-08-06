import "server-only";

import { buildAdaptiveBatchSnapshotRequest } from "./batch-snapshot";
import type { AdaptiveEvaluationDashboard } from "./evaluation-types";
import type { AdaptiveGuardrailHealth } from "./guardrail-health-types";
import type {
  AdaptiveMethod,
  AdaptivePersistenceContext,
  AdaptiveRun,
} from "./types";
import { ADAPTIVE_CONFIG_VERSION, ADAPTIVE_ENGINE_VERSION } from "./types";
import type { Target2D } from "@/lib/engine/types";

export type AdaptivePersistenceStatus =
  | {
    status: "stored";
    predictionId: string;
    stateRevision: number;
    settledPredictionId: string | null;
    selectionsPublished: number;
    selectionsSettled: number;
    snapshotComplete: boolean;
  }
  | { status: "not_configured" };

export interface AdaptiveReconciliationSummary {
  runId: string;
  trigger: "cron" | "manual" | "api";
  status: "success" | "partial" | "failed";
  marketsAvailable: number;
  marketsPlanned: number;
  marketsProcessed: number;
  targetsProcessed: number;
  fullReplayTargets: number;
  incrementalTargets: number;
  noopTargets: number;
  settledPredictions: number;
  selectionsPublished: number;
  selectionsSettled: number;
  errorCount: number;
  remainingMarkets: number;
  details: Array<Record<string, unknown>>;
  startedAt: string;
  finishedAt: string;
}

function serviceConfiguration(): { serviceUrl: string; serviceSecret: string } | null {
  const serviceUrl = process.env.ADAPTIVE_SERVICE_URL?.trim();
  if (!serviceUrl) return null;

  const serviceSecret = process.env.ADAPTIVE_SERVICE_SECRET?.trim();
  if (!serviceSecret) throw new Error("ADAPTIVE_SERVICE_SECRET belum dikonfigurasi.");
  return { serviceUrl: serviceUrl.replace(/\/$/, ""), serviceSecret };
}

async function callAdaptiveService(
  path: string,
  body: unknown,
  timeoutMs = 30_000,
): Promise<Record<string, unknown>> {
  const configuration = serviceConfiguration();
  if (!configuration) throw new Error("Adaptive service belum dikonfigurasi.");

  const response = await fetch(`${configuration.serviceUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${configuration.serviceSecret}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof payload.error === "string"
      ? payload.error
      : `Adaptive service gagal (${response.status}).`;
    throw new Error(message);
  }
  return payload;
}

export async function loadAdaptivePublishedSnapshot(options: {
  marketId: string;
  target2D: Target2D;
  method: AdaptiveMethod;
  digitCount: number;
}): Promise<unknown | null> {
  const payload = await callAdaptiveService(
    "/snapshots/batch",
    buildAdaptiveBatchSnapshotRequest({
      marketIds: [options.marketId],
      target2D: options.target2D,
      method: options.method,
      digitCount: options.digitCount,
    }),
    20_000,
  );
  const snapshots = Array.isArray(payload.snapshots) ? payload.snapshots : [];
  return snapshots[0] ?? null;
}

export async function loadAdaptiveContext(
  marketId: string,
  target2D: Target2D,
  historyDraws?: readonly string[],
): Promise<AdaptivePersistenceContext> {
  if (!serviceConfiguration()) {
    return {
      configured: false,
      expectedStateRevision: null,
      expectedHistoryFingerprint: null,
      state: null,
      pendingPrediction: null,
    };
  }

  const payload = await callAdaptiveService("/context/load", {
    marketId,
    target2D,
    engineVersion: ADAPTIVE_ENGINE_VERSION,
    configVersion: ADAPTIVE_CONFIG_VERSION,
    historyDraws: historyDraws ? [...historyDraws] : undefined,
  });

  return {
    configured: true,
    expectedStateRevision: payload.expectedStateRevision === null || payload.expectedStateRevision === undefined
      ? null
      : Number(payload.expectedStateRevision),
    expectedHistoryFingerprint: typeof payload.expectedHistoryFingerprint === "string"
      ? payload.expectedHistoryFingerprint
      : null,
    state: (payload.state ?? null) as AdaptivePersistenceContext["state"],
    pendingPrediction: (payload.pendingPrediction ?? null) as AdaptivePersistenceContext["pendingPrediction"],
  };
}

export async function persistAdaptiveRun(
  marketId: string,
  marketName: string,
  run: AdaptiveRun,
  contextToken: Pick<
    AdaptivePersistenceContext,
    "expectedStateRevision" | "expectedHistoryFingerprint"
  > = {
    expectedStateRevision: null,
    expectedHistoryFingerprint: null,
  },
): Promise<AdaptivePersistenceStatus> {
  if (!serviceConfiguration()) return { status: "not_configured" };

  const payload = await callAdaptiveService("/runs/store", {
    marketId,
    marketName,
    targetDrawKey: `next:${run.prediction.historyCutoffKey}`,
    expectedStateRevision: contextToken.expectedStateRevision,
    expectedHistoryFingerprint: contextToken.expectedHistoryFingerprint,
    prediction: run.prediction,
    state: run.state,
    settlement: run.settlement,
    historyDraws: run.historyDraws,
  });

  const predictionId = String(payload.predictionId ?? "");
  if (!predictionId) throw new Error("Adaptive service tidak mengembalikan prediction id.");

  const selectionsPublished = Number(payload.selectionsPublished ?? 0);
  const selectionsSettled = Number(payload.selectionsSettled ?? 0);
  const snapshotComplete = payload.snapshotComplete === true;
  if (selectionsPublished !== 18 || !snapshotComplete) {
    throw new Error("Adaptive service belum menyimpan snapshot lengkap 18 selection.");
  }
  if (run.settlement && selectionsSettled !== 18) {
    throw new Error("Adaptive service belum menyimpan 18 evaluasi settlement.");
  }

  return {
    status: "stored",
    predictionId,
    stateRevision: Number(payload.stateRevision ?? 0),
    settledPredictionId: payload.settledPredictionId
      ? String(payload.settledPredictionId)
      : null,
    selectionsPublished,
    selectionsSettled,
    snapshotComplete,
  };
}

export async function loadAdaptiveEvaluationDashboard(options: {
  marketId: string;
  target2D: Target2D;
  method: AdaptiveMethod;
  digitCount: number;
  window?: number;
}): Promise<AdaptiveEvaluationDashboard> {
  const payload = await callAdaptiveService(
    "/evaluation/dashboard",
    {
      marketId: options.marketId,
      target2D: options.target2D,
      method: options.method,
      digitCount: options.digitCount,
      window: options.window ?? 100,
    },
    30_000,
  );

  if (!payload.dashboard || typeof payload.dashboard !== "object") {
    throw new Error("Adaptive service tidak mengembalikan dashboard evaluasi.");
  }
  return payload.dashboard as unknown as AdaptiveEvaluationDashboard;
}

export async function loadAdaptiveGuardrailHealth(options: {
  marketId: string;
  target2D: Target2D;
}): Promise<AdaptiveGuardrailHealth> {
  const payload = await callAdaptiveService(
    "/guardrail/health",
    {
      marketId: options.marketId,
      target2D: options.target2D,
    },
    20_000,
  );

  if (!payload.health || typeof payload.health !== "object") {
    throw new Error("Adaptive service tidak mengembalikan health guardrail.");
  }
  return payload.health as unknown as AdaptiveGuardrailHealth;
}

export async function reconcileAdaptiveMarkets(options?: {
  marketId?: string | null;
  marketLimit?: number;
  force?: boolean;
}): Promise<AdaptiveReconciliationSummary> {
  const payload = await callAdaptiveService(
    "/reconcile",
    {
      trigger: "manual",
      marketId: options?.marketId || undefined,
      marketLimit: options?.marketLimit ?? 4,
      force: Boolean(options?.force),
    },
    120_000,
  );
  return payload as unknown as AdaptiveReconciliationSummary;
}

export async function loadLatestAdaptiveReconciliation(): Promise<Record<string, unknown> | null> {
  const payload = await callAdaptiveService("/reconciliation/latest", {}, 15_000);
  return payload.run && typeof payload.run === "object"
    ? payload.run as Record<string, unknown>
    : null;
}
