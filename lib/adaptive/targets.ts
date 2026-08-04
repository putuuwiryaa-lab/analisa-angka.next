import type { Target2D } from "@/lib/engine/types";

const TARGET_INDEXES: Record<Target2D, readonly [number, number]> = {
  depan: [0, 1],
  tengah: [1, 2],
  belakang: [2, 3],
};

export function targetIndexes(target: Target2D): readonly [number, number] {
  return TARGET_INDEXES[target];
}

export function extractTargetPair(draw: string, target: Target2D): readonly [number, number] {
  if (!/^\d{4}$/.test(draw)) throw new Error(`Result 4D tidak valid: ${draw}`);
  const [leftIndex, rightIndex] = targetIndexes(target);
  return [Number(draw[leftIndex]), Number(draw[rightIndex])];
}

export function targetPairText(draw: string, target: Target2D): string {
  const [left, right] = extractTargetPair(draw, target);
  return `${left}${right}`;
}
