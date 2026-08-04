import "server-only";

import type {
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
  }
  | { status: "not_configured" };

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
    signal: AbortSignal.timeout(30_000),
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

export async function loadAdaptiveContext(
  marketId: string,
  target2D: Target2D,
): Promise<AdaptivePersistenceContext> {
  if (!serviceConfiguration()) {
    return { configured: false, state: null, pendingPrediction: null };
  }

  const payload = await callAdaptiveService("/context/load", {
    marketId,
    target2D,
    engineVersion: ADAPTIVE_ENGINE_VERSION,
    configVersion: ADAPTIVE_CONFIG_VERSION,
  });

  return {
    configured: true,
    state: (payload.state ?? null) as AdaptivePersistenceContext["state"],
    pendingPrediction: (payload.pendingPrediction ?? null) as AdaptivePersistenceContext["pendingPrediction"],
  };
}

export async function persistAdaptiveRun(
  marketId: string,
  marketName: string,
  run: AdaptiveRun,
): Promise<AdaptivePersistenceStatus> {
  if (!serviceConfiguration()) return { status: "not_configured" };

  const payload = await callAdaptiveService("/runs/store", {
    marketId,
    marketName,
    targetDrawKey: `next:${run.prediction.historyCutoffKey}`,
    prediction: run.prediction,
    state: run.state,
    settlement: run.settlement,
    historyDraws: run.historyDraws,
  });

  const predictionId = String(payload.predictionId ?? "");
  if (!predictionId) throw new Error("Adaptive service tidak mengembalikan prediction id.");

  return {
    status: "stored",
    predictionId,
    stateRevision: Number(payload.stateRevision ?? 0),
    settledPredictionId: payload.settledPredictionId
      ? String(payload.settledPredictionId)
      : null,
  };
}
