export type EvaluationTarget = "depan" | "tengah" | "belakang";
export type EvaluationMethod = "ai" | "bbfs";

export interface EvaluationSelectionSample {
  method: EvaluationMethod;
  digitCount: number;
  estimatedSuccess: number;
  baselineSuccess: number;
  lift: number;
  hit: boolean;
}

export interface EvaluationRow {
  predictionId: string;
  actualPair: number;
  pairBrier: number;
  leftBrier: number;
  rightBrier: number;
  combinedLoss: number;
  expertLosses: Record<string, number>;
  weightsBefore: Record<string, number>;
  weightsAfter: Record<string, number>;
  createdAt: string;
  selections: EvaluationSelectionSample[];
}

export interface EvaluationStateSnapshot {
  stateRevision: number;
  processedHistoryLength: number;
  replayCount: number;
  driftState: "stable" | "warning" | "drift" | "recovery";
  expertWeights: Record<string, number>;
  familyWeights: Record<string, number>;
  horizonWeights: Record<string, number>;
  updatedAt: string | null;
}

export interface EvaluationDashboardOptions {
  marketId: string;
  target2D: EvaluationTarget;
  method: EvaluationMethod;
  digitCount: number;
  window: number;
  pendingPredictions: number;
  state: EvaluationStateSnapshot | null;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function finite(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizedRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, raw]) => [key, finite(raw, Number.NaN)] as const)
      .filter(([, number]) => Number.isFinite(number)),
  );
}

function readinessStage(settlements: number): "empty" | "warmup" | "shadow" | "monitoring" | "evidence" {
  if (settlements === 0) return "empty";
  if (settlements < 10) return "warmup";
  if (settlements < 30) return "shadow";
  if (settlements < 100) return "monitoring";
  return "evidence";
}

function selectionKey(method: EvaluationMethod, digitCount: number): string {
  return `${method}:${digitCount}`;
}

export function buildAdaptiveEvaluationDashboard(
  rawRows: readonly EvaluationRow[],
  options: EvaluationDashboardOptions,
) {
  const rows = rawRows.slice(0, Math.max(1, options.window));
  const selectionGroups = new Map<string, EvaluationSelectionSample[]>();

  for (const row of rows) {
    for (const selection of row.selections) {
      const key = selectionKey(selection.method, selection.digitCount);
      const samples = selectionGroups.get(key) ?? [];
      samples.push(selection);
      selectionGroups.set(key, samples);
    }
  }

  const selectionMetrics = [...selectionGroups.entries()]
    .map(([key, samples]) => {
      const [method, digitCountText] = key.split(":");
      const digitCount = Number(digitCountText);
      const hits = samples.filter((sample) => sample.hit).length;
      const hitRate = samples.length > 0 ? hits / samples.length : 0;
      const averageEstimated = mean(samples.map((sample) => sample.estimatedSuccess));
      const averageBaseline = mean(samples.map((sample) => sample.baselineSuccess));
      return {
        method: method as EvaluationMethod,
        digitCount,
        samples: samples.length,
        hits,
        hitRate,
        averageEstimated,
        averageBaseline,
        averageLift: mean(samples.map((sample) => sample.lift)),
        calibrationGap: hitRate - averageEstimated,
        baselineGap: hitRate - averageBaseline,
      };
    })
    .sort((left, right) => left.method.localeCompare(right.method) || left.digitCount - right.digitCount);

  const selectedSamples = selectionGroups.get(selectionKey(options.method, options.digitCount)) ?? [];
  const buckets = Array.from({ length: 10 }, (_, index) => ({
    index,
    samples: [] as EvaluationSelectionSample[],
  }));

  for (const sample of selectedSamples) {
    const bucketIndex = Math.min(9, Math.max(0, Math.floor(sample.estimatedSuccess * 10)));
    buckets[bucketIndex].samples.push(sample);
  }

  const calibration = buckets
    .filter((bucket) => bucket.samples.length > 0)
    .map((bucket) => {
      const hitRate = bucket.samples.filter((sample) => sample.hit).length / bucket.samples.length;
      const averageEstimated = mean(bucket.samples.map((sample) => sample.estimatedSuccess));
      return {
        lower: bucket.index / 10,
        upper: (bucket.index + 1) / 10,
        samples: bucket.samples.length,
        averageEstimated,
        hitRate,
        gap: hitRate - averageEstimated,
      };
    });

  const recentTen = rows.slice(0, 10).map((row) => row.combinedLoss);
  const previousTen = rows.slice(10, 20).map((row) => row.combinedLoss);
  const lossTrend = previousTen.length > 0 ? mean(recentTen) - mean(previousTen) : null;

  const expertLossGroups = new Map<string, number[]>();
  for (const row of rows) {
    for (const [expertId, loss] of Object.entries(normalizedRecord(row.expertLosses))) {
      const values = expertLossGroups.get(expertId) ?? [];
      values.push(loss);
      expertLossGroups.set(expertId, values);
    }
  }

  const expertPerformance = [...expertLossGroups.entries()]
    .map(([expertId, losses]) => ({ expertId, samples: losses.length, meanLoss: mean(losses) }))
    .sort((left, right) => left.meanLoss - right.meanLoss);

  const latest = rows[0] ?? null;
  const before = normalizedRecord(latest?.weightsBefore);
  const after = normalizedRecord(latest?.weightsAfter);
  const weightChanges = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .map((expertId) => ({
      expertId,
      before: before[expertId] ?? 0,
      after: after[expertId] ?? 0,
      delta: (after[expertId] ?? 0) - (before[expertId] ?? 0),
    }))
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 8);

  const recentSettlements = rows.slice(0, 20).map((row) => {
    const selected = row.selections.find(
      (selection) => selection.method === options.method && selection.digitCount === options.digitCount,
    ) ?? null;
    return {
      predictionId: row.predictionId,
      actualPair: String(Math.max(0, Math.min(99, Math.trunc(row.actualPair)))).padStart(2, "0"),
      combinedLoss: row.combinedLoss,
      pairBrier: row.pairBrier,
      hit: selected?.hit ?? null,
      estimatedSuccess: selected?.estimatedSuccess ?? null,
      baselineSuccess: selected?.baselineSuccess ?? null,
      createdAt: row.createdAt,
    };
  });

  return {
    marketId: options.marketId,
    target2D: options.target2D,
    method: options.method,
    digitCount: options.digitCount,
    window: options.window,
    readiness: {
      stage: readinessStage(rows.length),
      settlements: rows.length,
      targetSettlements: 100,
      enoughForCalibration: selectedSamples.length >= 30,
      selectedSamples: selectedSamples.length,
    },
    overview: {
      settlements: rows.length,
      pendingPredictions: options.pendingPredictions,
      meanCombinedLoss: mean(rows.map((row) => row.combinedLoss)),
      meanPairBrier: mean(rows.map((row) => row.pairBrier)),
      meanLeftBrier: mean(rows.map((row) => row.leftBrier)),
      meanRightBrier: mean(rows.map((row) => row.rightBrier)),
      recent10Loss: mean(recentTen),
      lossTrend,
    },
    state: options.state,
    selectionMetrics,
    calibration,
    expertPerformance,
    weightChanges,
    recentSettlements,
  };
}
