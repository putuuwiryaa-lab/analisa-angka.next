import type { Target2D } from "@/lib/engine/types";

export type AdaptiveGuardrailOperationalStatus =
  | "migration_required"
  | "waiting_for_state"
  | "waiting_for_run"
  | "warmup"
  | "active";

export interface AdaptiveGuardrailHealth {
  ok: boolean;
  operational: boolean;
  status: AdaptiveGuardrailOperationalStatus;
  mode: "observe-only";
  detectorVersion: "ewma-ph-v1";
  scope: {
    marketId: string;
    target2D: Target2D;
    engineVersion: string;
    configVersion: string;
  };
  migration: {
    historyFingerprintColumn: boolean;
    persistGuardrailFunction: boolean;
    driftEventsTable: boolean;
    ready: boolean;
    completedObjects: number;
    requiredObjects: number;
  };
  runtime: {
    stateFound: boolean;
    fingerprintStored: boolean;
    fingerprintPrefix: string | null;
    driftState: "stable" | "warning" | "drift" | "recovery";
    stateRevision: number;
    processedHistoryLength: number;
    settlementCount: number;
    driftEventCount: number;
    updatedAt: string | null;
    detector: {
      sampleCount: number;
      meanLoss: number;
      ewmaLoss: number;
      pageHinkley: number;
      alertStreak: number;
      recoveryStreak: number;
      lastLoss: number | null;
      reason: string;
      updatedAt: string | null;
    };
    latestEvent: null | {
      eventType: "stable" | "warning" | "drift" | "recovery";
      previousState: "stable" | "warning" | "drift" | "recovery";
      nextState: "stable" | "warning" | "drift" | "recovery";
      reason: string | null;
      sampleCount: number;
      createdAt: string | null;
    };
  };
  issues: string[];
}
