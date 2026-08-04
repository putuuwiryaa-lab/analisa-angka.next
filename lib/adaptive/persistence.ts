import "server-only";

import { getAdaptiveSql, isAdaptiveDatabaseConfigured } from "@/lib/server/neon";
import type { AdaptivePrediction } from "./types";

export type AdaptivePersistenceStatus =
  | { status: "stored"; predictionId: string }
  | { status: "not_configured" };

export async function persistAdaptivePrediction(
  marketId: string,
  marketName: string,
  prediction: AdaptivePrediction,
): Promise<AdaptivePersistenceStatus> {
  if (!isAdaptiveDatabaseConfigured()) return { status: "not_configured" };

  const sql = await getAdaptiveSql();
  const targetDrawKey = `next:${prediction.historyCutoffKey}`;
  const selection = prediction.selection;
  const rawRows = await sql`
    select adaptive.store_prediction(
      ${marketId}::text,
      ${marketName}::text,
      ${targetDrawKey}::text,
      ${prediction.target2D}::text,
      ${prediction.engineVersion}::text,
      ${prediction.configVersion}::text,
      ${prediction.historyCutoffKey}::text,
      ${prediction.historyLength}::integer,
      ${prediction.latestDraw}::text,
      ${JSON.stringify(prediction.pairProbabilities)}::jsonb,
      ${JSON.stringify(prediction.leftProbabilities)}::jsonb,
      ${JSON.stringify(prediction.rightProbabilities)}::jsonb,
      ${JSON.stringify(prediction.expertWeights)}::jsonb,
      ${prediction.signalStrength}::text,
      ${selection.method}::text,
      ${selection.digitCount}::smallint,
      ${JSON.stringify(selection.digits)}::jsonb,
      ${selection.estimatedSuccess}::real,
      ${selection.baselineSuccess}::real,
      ${selection.lift}::real,
      ${selection.selectionMargin}::real
    ) as prediction_id
  `;
  const rows = rawRows as unknown as Array<{ prediction_id?: unknown }>;

  const predictionId = String(rows[0]?.prediction_id ?? "");
  if (!predictionId) throw new Error("Neon tidak mengembalikan prediction id.");
  return { status: "stored", predictionId };
}
