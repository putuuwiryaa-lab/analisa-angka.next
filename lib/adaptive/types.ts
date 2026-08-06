import type { Target2D } from "@/lib/engine/types";

export const ADAPTIVE_METHODS = ["ai", "bbfs"] as const;
export type AdaptiveMethod = (typeof ADAPTIVE_METHODS)[number];

export const ADAPTIVE_TARGETS = ["depan", "tengah", "belakang"] as const satisfies readonly Target2D[];

export const ADAPTIVE_ENGINE_VERSION = "hf-apie-v1-online";
export const ADAPTIVE_CONFIG_VERSION = "2026-08-04.2";

export type PairMatrix = number[];
export type DigitVector = number[];

export interface AdaptiveExpertOutput {
  id: string;
  family: string;
  horizon: number;
  weight: number;
  pairProbabilities: PairMatrix;
}

export interface AdaptiveSelection {
  method: AdaptiveMethod;
  digitCount: number;
  digits: number[];
  estimatedSuccess: number;
  baselineSuccess: number;
  lift: number;
  selectionMargin: number;
}

export interface AdaptiveReplaySummary {
  mode: "full" | "incremental" | "noop";
  startHistoryLength: number;
  endHistoryLength: number;
  processedSteps: number;
  meanEnsembleLoss: number;
  expertMeanLosses: Record<string, number>;
}

export interface AdaptiveLearningState {
  engineVersion: string;
  configVersion: string;
  target2D: Target2D;
  processedHistoryLength: number;
  lastProcessedDraw: string | null;
  expertWeights: Record<string, number>;
  familyWeights: Record<string, number>;
  horizonWeights: Record<string, number>;
  stateRevision: number;
}

export interface AdaptivePrediction {
  engineVersion: string;
  configVersion: string;
  target2D: Target2D;
  historyLength: number;
  historyCutoffKey: string;
  latestDraw: string;
  pairProbabilities: PairMatrix;
  leftProbabilities: DigitVector;
  rightProbabilities: DigitVector;
  expertWeights: Record<string, number>;
  /** Selection yang diminta caller; dipertahankan untuk kompatibilitas UI/API saat ini. */
  selection: AdaptiveSelection;
  /** Seluruh optimizer pass AI 1-9 dan BBFS 1-9 dari matrix yang sama. */
  selections: AdaptiveSelection[];
  signalStrength: "low" | "medium" | "high";
  replay: AdaptiveReplaySummary;
}

export interface AdaptivePendingPrediction {
  predictionId: string;
  engineVersion: string;
  configVersion: string;
  target2D: Target2D;
  historyLength: number;
  pairProbabilities: PairMatrix;
  leftProbabilities: DigitVector;
  rightProbabilities: DigitVector;
  expertWeights: Record<string, number>;
  selections: AdaptiveSelection[];
}

export interface AdaptiveSettlement {
  predictionId: string;
  actualPair: number;
  actualLeft: number;
  actualRight: number;
  pairBrier: number;
  leftBrier: number;
  rightBrier: number;
  combinedLoss: number;
  aiResults: Record<string, boolean>;
  bbfsResults: Record<string, boolean>;
  expertLosses: Record<string, number>;
  weightsBefore: Record<string, number>;
  weightsAfter: Record<string, number>;
}

export interface AdaptivePersistenceContext {
  configured: boolean;
  expectedStateRevision: number | null;
  expectedHistoryFingerprint: string | null;
  state: AdaptiveLearningState | null;
  pendingPrediction: AdaptivePendingPrediction | null;
}

export interface AdaptiveRun {
  prediction: AdaptivePrediction;
  state: AdaptiveLearningState;
  settlement: AdaptiveSettlement | null;
  historyDraws: string[];
}

export function isAdaptiveMethod(value: unknown): value is AdaptiveMethod {
  return typeof value === "string" && (ADAPTIVE_METHODS as readonly string[]).includes(value);
}

export function isAdaptiveTarget(value: unknown): value is Target2D {
  return typeof value === "string" && (ADAPTIVE_TARGETS as readonly string[]).includes(value);
}
