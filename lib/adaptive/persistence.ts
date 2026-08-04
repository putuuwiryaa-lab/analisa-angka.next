import "server-only";

import type { AdaptivePrediction } from "./types";

export type AdaptivePersistenceStatus =
  | { status: "stored"; predictionId: string }
  | { status: "not_configured" };

export async function persistAdaptivePrediction(
  marketId: string,
  marketName: string,
  prediction: AdaptivePrediction,
): Promise<AdaptivePersistenceStatus> {
  const serviceUrl = process.env.ADAPTIVE_SERVICE_URL?.trim();
  if (!serviceUrl) return { status: "not_configured" };

  const serviceSecret = process.env.ADAPTIVE_SERVICE_SECRET?.trim();
  if (!serviceSecret) {
    throw new Error("ADAPTIVE_SERVICE_SECRET belum dikonfigurasi.");
  }

  const response = await fetch(`${serviceUrl.replace(/\/$/, "")}/predictions/store`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceSecret}`,
    },
    body: JSON.stringify({
      marketId,
      marketName,
      targetDrawKey: `next:${prediction.historyCutoffKey}`,
      prediction,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const payload = await response.json().catch(() => ({})) as {
    predictionId?: unknown;
    error?: unknown;
  };

  if (!response.ok) {
    const message = typeof payload.error === "string"
      ? payload.error
      : `Adaptive service gagal (${response.status}).`;
    throw new Error(message);
  }

  const predictionId = String(payload.predictionId ?? "");
  if (!predictionId) throw new Error("Adaptive service tidak mengembalikan prediction id.");
  return { status: "stored", predictionId };
}
