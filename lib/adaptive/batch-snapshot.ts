import type { Target2D } from "@/lib/engine/types";
import {
  ADAPTIVE_CONFIG_VERSION,
  ADAPTIVE_ENGINE_VERSION,
  ADAPTIVE_SELECTION_COUNT,
} from "./types";

export const ADAPTIVE_PUBLICATION_SELECTION_COUNT = ADAPTIVE_SELECTION_COUNT;

export interface AdaptiveBatchSnapshotMetadata {
  engine_version: unknown;
  config_version: unknown;
  snapshot_complete: unknown;
  selection_count: unknown;
}

export type AdaptiveBatchSnapshotIssue = "version" | "incomplete" | null;

export function buildAdaptiveBatchSnapshotRequest(input: {
  marketIds: string[];
  target2D: Target2D;
  method: "ai" | "bbfs";
  digitCount: number;
}) {
  return {
    ...input,
    engineVersion: ADAPTIVE_ENGINE_VERSION,
    configVersion: ADAPTIVE_CONFIG_VERSION,
  };
}

export function adaptiveBatchSnapshotIssue(
  snapshot: AdaptiveBatchSnapshotMetadata,
): AdaptiveBatchSnapshotIssue {
  if (
    String(snapshot.engine_version ?? "") !== ADAPTIVE_ENGINE_VERSION ||
    String(snapshot.config_version ?? "") !== ADAPTIVE_CONFIG_VERSION
  ) {
    return "version";
  }
  if (
    snapshot.snapshot_complete !== true ||
    Number(snapshot.selection_count) !== ADAPTIVE_PUBLICATION_SELECTION_COUNT
  ) {
    return "incomplete";
  }
  return null;
}
