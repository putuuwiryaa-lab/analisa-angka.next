export type DriftState = "stable" | "warning" | "drift" | "recovery";

export interface DriftDetectorState {
  version: "ewma-ph-v1";
  sampleCount: number;
  meanLoss: number;
  m2: number;
  variance: number;
  ewmaLoss: number;
  pageHinkley: number;
  alertStreak: number;
  recoveryStreak: number;
  lastPredictionId: string | null;
  lastLoss: number | null;
  warningThreshold: number;
  pageHinkleyThreshold: number;
  badSignal: boolean;
  goodSignal: boolean;
  reason: string;
  updatedAt: string | null;
}

export interface DriftGuardrailUpdate {
  previousState: DriftState;
  nextState: DriftState;
  eventType: DriftState | null;
  detectorState: DriftDetectorState;
  duplicate: boolean;
}

export interface GuardrailRunPayload {
  marketId: string;
  targetDrawKey: string;
  prediction: {
    target2D: "depan" | "tengah" | "belakang";
    engineVersion: string;
    configVersion: string;
  };
  settlement: null | {
    predictionId: string;
    combinedLoss: number;
  };
  historyDraws: string[];
}

export type GuardrailPersistenceResult =
  | {
    status: "stored";
    historyFingerprint: string;
    previousState: DriftState;
    nextState: DriftState;
    eventType: DriftState | null;
    detectorState: DriftDetectorState;
  }
  | {
    status: "migration_required";
    historyFingerprint: string;
    previousState: DriftState;
    nextState: DriftState;
    eventType: DriftState | null;
    detectorState: DriftDetectorState;
  };

export type SqlClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

const EWMA_ALPHA = 0.2;
const PAGE_HINKLEY_DELTA = 0.005;
const MIN_SAMPLES = 10;
const DRIFT_ALERT_STREAK = 3;
const RECOVERY_ENTRY_STREAK = 2;
const STABLE_RECOVERY_STREAK = 4;

function finite(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeInteger(value: unknown): number {
  return Math.max(0, Math.trunc(finite(value)));
}

function isDriftState(value: unknown): value is DriftState {
  return value === "stable" || value === "warning" || value === "drift" || value === "recovery";
}

export function defaultDriftDetectorState(): DriftDetectorState {
  return {
    version: "ewma-ph-v1",
    sampleCount: 0,
    meanLoss: 0,
    m2: 0,
    variance: 0,
    ewmaLoss: 0,
    pageHinkley: 0,
    alertStreak: 0,
    recoveryStreak: 0,
    lastPredictionId: null,
    lastLoss: null,
    warningThreshold: 0.04,
    pageHinkleyThreshold: 0.12,
    badSignal: false,
    goodSignal: false,
    reason: "uninitialized",
    updatedAt: null,
  };
}

export function normalizeDriftDetectorState(value: unknown): DriftDetectorState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultDriftDetectorState();
  }
  const row = value as Record<string, unknown>;
  const sampleCount = nonNegativeInteger(row.sampleCount);
  const meanLoss = finite(row.meanLoss);
  const m2 = Math.max(0, finite(row.m2));
  return {
    version: "ewma-ph-v1",
    sampleCount,
    meanLoss,
    m2,
    variance: sampleCount > 1 ? m2 / (sampleCount - 1) : 0,
    ewmaLoss: finite(row.ewmaLoss, meanLoss),
    pageHinkley: Math.max(0, finite(row.pageHinkley)),
    alertStreak: nonNegativeInteger(row.alertStreak),
    recoveryStreak: nonNegativeInteger(row.recoveryStreak),
    lastPredictionId: typeof row.lastPredictionId === "string" && row.lastPredictionId
      ? row.lastPredictionId
      : null,
    lastLoss: row.lastLoss === null || row.lastLoss === undefined
      ? null
      : finite(row.lastLoss),
    warningThreshold: Math.max(0.04, finite(row.warningThreshold, 0.04)),
    pageHinkleyThreshold: Math.max(0.12, finite(row.pageHinkleyThreshold, 0.12)),
    badSignal: row.badSignal === true,
    goodSignal: row.goodSignal === true,
    reason: typeof row.reason === "string" ? row.reason : "normalized",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : null,
  };
}

export function updateDriftDetector(
  previousStateValue: unknown,
  detectorValue: unknown,
  settlement: GuardrailRunPayload["settlement"],
  now = new Date().toISOString(),
): DriftGuardrailUpdate {
  const previousState: DriftState = isDriftState(previousStateValue) ? previousStateValue : "stable";
  const previous = normalizeDriftDetectorState(detectorValue);

  if (!settlement) {
    return {
      previousState,
      nextState: previousState,
      eventType: null,
      detectorState: { ...previous, reason: "no-settlement" },
      duplicate: false,
    };
  }

  if (previous.lastPredictionId === settlement.predictionId) {
    return {
      previousState,
      nextState: previousState,
      eventType: null,
      detectorState: { ...previous, reason: "duplicate-settlement" },
      duplicate: true,
    };
  }

  const loss = Math.max(0, finite(settlement.combinedLoss));
  const previousCount = previous.sampleCount;
  const previousMean = previous.meanLoss;
  const previousVariance = previousCount > 1 ? previous.m2 / (previousCount - 1) : 0;
  const previousStd = Math.sqrt(Math.max(0, previousVariance));
  const sampleCount = previousCount + 1;
  const delta = loss - previousMean;
  const meanLoss = previousCount === 0 ? loss : previousMean + delta / sampleCount;
  const m2 = previousCount === 0 ? 0 : previous.m2 + delta * (loss - meanLoss);
  const variance = sampleCount > 1 ? m2 / (sampleCount - 1) : 0;
  const ewmaLoss = previousCount === 0
    ? loss
    : EWMA_ALPHA * loss + (1 - EWMA_ALPHA) * previous.ewmaLoss;
  let pageHinkley = previousCount === 0
    ? 0
    : Math.max(0, previous.pageHinkley + loss - previousMean - PAGE_HINKLEY_DELTA);

  const warningThreshold = Math.max(0.04, 1.5 * previousStd);
  const pageHinkleyThreshold = Math.max(0.12, 3 * previousStd);
  const ready = previousCount >= MIN_SAMPLES;
  const ewmaBad = ready && ewmaLoss > previousMean + warningThreshold;
  const pageHinkleyBad = ready && pageHinkley > pageHinkleyThreshold;
  const badSignal = ewmaBad || pageHinkleyBad;
  const goodSignal = ready &&
    ewmaLoss <= previousMean + Math.max(0.015, 0.75 * previousStd) &&
    pageHinkley <= Math.max(0.04, 1.5 * previousStd);

  let nextState: DriftState = previousState;
  let alertStreak = previous.alertStreak;
  let recoveryStreak = previous.recoveryStreak;
  let reason = "within-control";

  if (!ready) {
    nextState = "stable";
    alertStreak = 0;
    recoveryStreak = 0;
    reason = "warmup";
  } else if (previousState === "stable") {
    if (badSignal) {
      nextState = "warning";
      alertStreak = 1;
      recoveryStreak = 0;
      reason = ewmaBad && pageHinkleyBad ? "ewma-and-page-hinkley" : ewmaBad ? "ewma" : "page-hinkley";
    } else {
      alertStreak = 0;
      recoveryStreak = 0;
    }
  } else if (previousState === "warning") {
    if (badSignal) {
      alertStreak += 1;
      recoveryStreak = 0;
      nextState = alertStreak >= DRIFT_ALERT_STREAK ? "drift" : "warning";
      reason = nextState === "drift" ? "persistent-loss-deterioration" : "warning-persisted";
    } else if (goodSignal) {
      nextState = "stable";
      alertStreak = 0;
      recoveryStreak = 0;
      pageHinkley *= 0.5;
      reason = "warning-cleared";
    } else {
      reason = "warning-observe";
    }
  } else if (previousState === "drift") {
    if (goodSignal) {
      recoveryStreak += 1;
      alertStreak = 0;
      nextState = recoveryStreak >= RECOVERY_ENTRY_STREAK ? "recovery" : "drift";
      reason = nextState === "recovery" ? "recovery-started" : "recovery-candidate";
    } else {
      recoveryStreak = 0;
      alertStreak = badSignal ? Math.max(1, alertStreak) : alertStreak;
      reason = badSignal ? "drift-persisted" : "drift-observe";
    }
  } else {
    if (badSignal) {
      nextState = "drift";
      alertStreak = 1;
      recoveryStreak = 0;
      reason = "recovery-relapse";
    } else if (goodSignal) {
      recoveryStreak += 1;
      alertStreak = 0;
      if (recoveryStreak >= STABLE_RECOVERY_STREAK) {
        nextState = "stable";
        recoveryStreak = 0;
        pageHinkley = 0;
        reason = "recovery-complete";
      } else {
        reason = "recovery-progress";
      }
    } else {
      reason = "recovery-observe";
    }
  }

  const detectorState: DriftDetectorState = {
    version: "ewma-ph-v1",
    sampleCount,
    meanLoss,
    m2,
    variance,
    ewmaLoss,
    pageHinkley,
    alertStreak,
    recoveryStreak,
    lastPredictionId: settlement.predictionId,
    lastLoss: loss,
    warningThreshold,
    pageHinkleyThreshold,
    badSignal,
    goodSignal,
    reason,
    updatedAt: now,
  };

  return {
    previousState,
    nextState,
    eventType: nextState !== previousState ? nextState : null,
    detectorState,
    duplicate: false,
  };
}

export async function historyFingerprint(draws: readonly string[]): Promise<string> {
  const encoded = new TextEncoder().encode(draws.join("|"));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function isStoredHistoryCompatible(options: {
  draws: readonly string[];
  processedHistoryLength: number;
  lastProcessedDraw: string | null;
  storedFingerprint: string | null;
}): Promise<{ compatible: boolean; correctionDetected: boolean; currentFingerprint: string | null }> {
  if (!Number.isInteger(options.processedHistoryLength) || options.processedHistoryLength < 2) {
    return { compatible: false, correctionDetected: false, currentFingerprint: null };
  }
  if (options.processedHistoryLength > options.draws.length) {
    return { compatible: false, correctionDetected: true, currentFingerprint: null };
  }
  if (options.draws[options.processedHistoryLength - 1] !== options.lastProcessedDraw) {
    return { compatible: false, correctionDetected: true, currentFingerprint: null };
  }

  const currentFingerprint = await historyFingerprint(
    options.draws.slice(0, options.processedHistoryLength),
  );
  if (!options.storedFingerprint) {
    return { compatible: true, correctionDetected: false, currentFingerprint };
  }
  return {
    compatible: currentFingerprint === options.storedFingerprint,
    correctionDetected: currentFingerprint !== options.storedFingerprint,
    currentFingerprint,
  };
}

function migrationMissing(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /persist_guardrail|history_fingerprint|does not exist/i.test(message);
}

export async function applyAdaptiveGuardrail(
  sql: SqlClient,
  payload: GuardrailRunPayload,
): Promise<GuardrailPersistenceResult> {
  const historyFingerprintValue = await historyFingerprint(payload.historyDraws);
  const stateRows = await sql`
    select
      drift_state,
      detector_state
    from adaptive.engine_states
    where market_id = ${payload.marketId}
      and target_2d = ${payload.prediction.target2D}
      and engine_version = ${payload.prediction.engineVersion}
      and config_version = ${payload.prediction.configVersion}
    limit 1
  `;
  const stateRow = stateRows[0] ?? {};
  const update = updateDriftDetector(
    stateRow.drift_state,
    stateRow.detector_state,
    payload.settlement,
  );

  const persistencePayload = {
    marketId: payload.marketId,
    targetDrawKey: payload.targetDrawKey,
    target2D: payload.prediction.target2D,
    engineVersion: payload.prediction.engineVersion,
    configVersion: payload.prediction.configVersion,
    settledPredictionId: payload.settlement?.predictionId ?? null,
    historyFingerprint: historyFingerprintValue,
    previousState: update.previousState,
    nextState: update.nextState,
    eventType: update.eventType,
    detectorState: update.detectorState,
  };

  try {
    await sql`
      select adaptive.persist_guardrail(${JSON.stringify(persistencePayload)}::jsonb)
    `;
    return {
      status: "stored",
      historyFingerprint: historyFingerprintValue,
      previousState: update.previousState,
      nextState: update.nextState,
      eventType: update.eventType,
      detectorState: update.detectorState,
    };
  } catch (error) {
    if (!migrationMissing(error)) throw error;
    console.warn("[adaptive-guardrail] Migration 004 belum tersedia; guardrail persistence dilewati.");
    return {
      status: "migration_required",
      historyFingerprint: historyFingerprintValue,
      previousState: update.previousState,
      nextState: update.nextState,
      eventType: update.eventType,
      detectorState: update.detectorState,
    };
  }
}
