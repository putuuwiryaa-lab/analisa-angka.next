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

  const sql = getAdaptiveSql();
  const targetDrawKey = `next:${prediction.historyCutoffKey}`;
  const selection = prediction.selection;
  const rows = await sql`
    select adaptive.store_prediction(
      ${marketId},
      ${marketName},
      ${targetDrawKey},
      ${prediction.target2D},
      ${prediction.engineVersion},
      ${prediction.configVersion},
      ${prediction.historyCutoffKey},
      ${prediction.historyLength},
      ${prediction.latestDraw},
      ${JSON.stringify(prediction.pairProbabilities)}::jsonb,
      ${JSON.stringify(prediction.leftProbabilities)}::jsonb,
      ${JSON.stringify(prediction.rightProbabilities)}::jsonb,
      ${JSON.stringify(prediction.expertWeights)}::jsonb,
      ${prediction.signalStrength},
      ${selection.method},
      ${selection.digitCount},
      ${JSON.stringify(selection.digits)}::jsonb,
      ${selection.estimatedSuccess},
      ${selection.baselineSuccess},
      ${selection.lift},
      ${selection.selectionMargin}
    ) as prediction_id
  `;

  const predictionId = String((rows[0] as { prediction_id?: unknown } | undefined)?.prediction_id ?? "");
  if (!predictionId) throw new Error("Neon tidak mengembalikan prediction id.");
  return { status: "stored", predictionId };
}
