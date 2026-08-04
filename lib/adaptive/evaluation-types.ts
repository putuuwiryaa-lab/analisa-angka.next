import type { AdaptiveMethod } from "./types";
import type { Target2D } from "@/lib/engine/types";

export type AdaptiveEvaluationStage =
  | "empty"
  | "warmup"
  | "shadow"
  | "monitoring"
  | "evidence";

export interface AdaptiveEvaluationDashboard {
  marketId: string;
  target2D: Target2D;
  method: AdaptiveMethod;
  digitCount: number;
  window: number;
  readiness: {
    stage: AdaptiveEvaluationStage;
    settlements: number;
    targetSettlements: number;
    enoughForCalibration: boolean;
    selectedSamples: number;
  };
  overview: {
    settlements: number;
    pendingPredictions: number;
    meanCombinedLoss: number;
    meanPairBrier: number;
    meanLeftBrier: number;
    meanRightBrier: number;
    recent10Loss: number;
    lossTrend: number | null;
  };
  state: null | {
    stateRevision: number;
    processedHistoryLength: number;
    replayCount: number;
    driftState: "stable" | "warning" | "drift" | "recovery";
    expertWeights: Record<string, number>;
    familyWeights: Record<string, number>;
    horizonWeights: Record<string, number>;
    updatedAt: string | null;
  };
  selectionMetrics: Array<{
    method: AdaptiveMethod;
    digitCount: number;
    samples: number;
    hits: number;
    hitRate: number;
    averageEstimated: number;
    averageBaseline: number;
    averageLift: number;
    calibrationGap: number;
    baselineGap: number;
  }>;
  calibration: Array<{
    lower: number;
    upper: number;
    samples: number;
    averageEstimated: number;
    hitRate: number;
    gap: number;
  }>;
  expertPerformance: Array<{
    expertId: string;
    samples: number;
    meanLoss: number;
  }>;
  weightChanges: Array<{
    expertId: string;
    before: number;
    after: number;
    delta: number;
  }>;
  recentSettlements: Array<{
    predictionId: string;
    actualPair: string;
    combinedLoss: number;
    pairBrier: number;
    hit: boolean | null;
    estimatedSuccess: number | null;
    baselineSuccess: number | null;
    createdAt: string;
  }>;
}
