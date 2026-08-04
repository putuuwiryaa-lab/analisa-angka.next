export const RECONCILIATION_TARGETS = ["depan", "tengah", "belakang"] as const;
export type ReconciliationTarget = (typeof RECONCILIATION_TARGETS)[number];

export interface ReconciliationMarketSnapshot {
  id: string;
  name: string;
  historyLength: number;
  lastDraw: string;
  historyFingerprint?: string | null;
}

export interface ReconciliationStateSnapshot {
  marketId: string;
  target2D: ReconciliationTarget;
  processedHistoryLength: number;
  lastProcessedDraw: string | null;
  historyFingerprint?: string | null;
  pendingHistoryLength?: number | null;
  updatedAt?: string | null;
}

export interface ReconciliationMarketPlan {
  marketId: string;
  marketName: string;
  historyLength: number;
  lastDraw: string;
  targets: ReconciliationTarget[];
  missingStateCount: number;
  correctedHistoryCount: number;
  oldestProcessedHistoryLength: number;
}

export interface ReconciliationPlanOptions {
  marketLimit: number;
  requestedMarketId?: string | null;
  force?: boolean;
}

function stateKey(marketId: string, target2D: ReconciliationTarget): string {
  return `${marketId}:${target2D}`;
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return 4;
  return Math.max(1, Math.min(50, Math.trunc(value)));
}

export function planAdaptiveReconciliation(
  markets: readonly ReconciliationMarketSnapshot[],
  states: readonly ReconciliationStateSnapshot[],
  options: ReconciliationPlanOptions,
): ReconciliationMarketPlan[] {
  const requestedMarketId = options.requestedMarketId?.trim() || null;
  const stateMap = new Map(states.map((state) => [stateKey(state.marketId, state.target2D), state]));
  const plans: ReconciliationMarketPlan[] = [];

  for (const market of markets) {
    if (requestedMarketId && market.id !== requestedMarketId) continue;
    if (!Number.isInteger(market.historyLength) || market.historyLength < 2 || !/^\d{4}$/.test(market.lastDraw)) {
      continue;
    }

    const targets: ReconciliationTarget[] = [];
    let missingStateCount = 0;
    let correctedHistoryCount = 0;
    let oldestProcessedHistoryLength = market.historyLength;

    for (const target2D of RECONCILIATION_TARGETS) {
      const state = stateMap.get(stateKey(market.id, target2D));
      const pendingNeedsSettlement = Number.isInteger(state?.pendingHistoryLength) &&
        Number(state?.pendingHistoryLength) < market.historyLength;
      const fingerprintMismatch = Boolean(
        state &&
        state.processedHistoryLength === market.historyLength &&
        state.historyFingerprint &&
        market.historyFingerprint &&
        state.historyFingerprint !== market.historyFingerprint
      );
      const stale = options.force ||
        !state ||
        state.processedHistoryLength !== market.historyLength ||
        state.lastProcessedDraw !== market.lastDraw ||
        fingerprintMismatch ||
        pendingNeedsSettlement;

      if (!stale) continue;
      targets.push(target2D);
      if (!state) missingStateCount += 1;
      if (fingerprintMismatch) correctedHistoryCount += 1;
      oldestProcessedHistoryLength = Math.min(
        oldestProcessedHistoryLength,
        state?.processedHistoryLength ?? 0,
      );
    }

    if (targets.length === 0) continue;
    plans.push({
      marketId: market.id,
      marketName: market.name,
      historyLength: market.historyLength,
      lastDraw: market.lastDraw,
      targets,
      missingStateCount,
      correctedHistoryCount,
      oldestProcessedHistoryLength,
    });
  }

  plans.sort((left, right) => {
    if (left.correctedHistoryCount !== right.correctedHistoryCount) {
      return right.correctedHistoryCount - left.correctedHistoryCount;
    }
    if (left.missingStateCount !== right.missingStateCount) {
      return right.missingStateCount - left.missingStateCount;
    }
    if (left.oldestProcessedHistoryLength !== right.oldestProcessedHistoryLength) {
      return left.oldestProcessedHistoryLength - right.oldestProcessedHistoryLength;
    }
    return left.marketName.localeCompare(right.marketName);
  });

  return plans.slice(0, requestedMarketId ? 1 : clampLimit(options.marketLimit));
}
