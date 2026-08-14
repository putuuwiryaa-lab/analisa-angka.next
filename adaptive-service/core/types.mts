export type Target2D = "depan" | "tengah" | "belakang";

export const ADAPTIVE_METHODS = ["ai", "bbfs"] as const;
export type AdaptiveMethod = (typeof ADAPTIVE_METHODS)[number];

/** Adaptive V2 mempublikasikan prediction hanya untuk 2D belakang. */
export const ADAPTIVE_TARGETS = ["belakang"] as const satisfies readonly Target2D[];
export const ADAPTIVE_AI_DIGIT_COUNTS = [1, 2, 3, 4, 5, 6] as const;
export const ADAPTIVE_BBFS_DIGIT_COUNTS = [5, 6, 7, 8, 9] as const;
export const ADAPTIVE_SELECTION_SPECS = [
  ...ADAPTIVE_AI_DIGIT_COUNTS.map((digitCount) => ({ method: "ai" as const, digitCount })),
  ...ADAPTIVE_BBFS_DIGIT_COUNTS.map((digitCount) => ({ method: "bbfs" as const, digitCount })),
] as const;
export const ADAPTIVE_SELECTION_COUNT = ADAPTIVE_SELECTION_SPECS.length;
export const ADAPTIVE_MAX_HISTORY = 170;
export const ADAPTIVE_REPLAY_WARMUP = 28;
export const ADAPTIVE_BASE_HORIZONS = [21, 42, 85, 170] as const;

export const ADAPTIVE_ENGINE_VERSION = "hf-apie-v2-back";
export const ADAPTIVE_CONFIG_VERSION = "2026-08-15.1";

export function isAdaptiveSelection(method: AdaptiveMethod, digitCount: number): boolean {
  return ADAPTIVE_SELECTION_SPECS.some((spec) =>
    spec.method === method && spec.digitCount === digitCount
  );
}

export type PairMatrix = number[];
export type DigitVector = number[];
export type AdaptiveTimescale = "short" | "medium" | "long" | "adaptive" | "null";

export interface AdaptiveExpertOutput {
  id: string;
  family: string;
  horizon: number;
  weight: number;
  pairProbabilities: PairMatrix;
  effectiveHistory?: number;
  effectiveSampleSize?: number;
  supportScore?: number;
  entropy?: number;
  fallbackLevel?: number;
  timescale?: AdaptiveTimescale;
}

export interface AdaptiveSelection {
  method: AdaptiveMethod;
  digitCount: number;
  digits: number[];
  estimatedSuccess: number;
  baselineSuccess: number;
  lift: number;
  selectionMargin: number;
  calibrationWeights: Record<string, number>;
  calibrationStateRevision: number;
}

export interface AdaptiveSelectionCalibrationState {
  method: AdaptiveMethod;
  digitCount: number;
  expertWeights: Record<string, number>;
  sampleCount: number;
  hitCount: number;
  cumulativeLoss: number;
  stateRevision: number;
}

export interface AdaptiveSelectionCalibrationUpdate {
  method: AdaptiveMethod;
  digitCount: number;
  hit: boolean;
  estimatedSuccess: number;
  calibrationLoss: number;
  expertLosses: Record<string, number>;
  weightsBefore: Record<string, number>;
  weightsAfter: Record<string, number>;
  stateRevisionBefore: number;
  stateRevisionAfter: number;
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
  selection: AdaptiveSelection;
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
  selectionCalibrationUpdates: AdaptiveSelectionCalibrationUpdate[];
}

export interface AdaptiveRunOptions {
  rollingWindowAdvance?: boolean;
  /** Exact 170-result window yang dipakai saat pending prediction dibuat. */
  previousHistoryDraws?: readonly string[];
  selectionCalibrationStates?: readonly AdaptiveSelectionCalibrationState[];
}

export interface AdaptiveRun {
  prediction: AdaptivePrediction;
  state: AdaptiveLearningState;
  settlement: AdaptiveSettlement | null;
  historyDraws: string[];
}
