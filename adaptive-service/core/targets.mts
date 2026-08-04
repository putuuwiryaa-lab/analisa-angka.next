import type { Target2D } from "./types.mts";

const TARGET_INDEXES: Record<Target2D, readonly [number, number]> = {
  depan: [0, 1],
  tengah: [1, 2],
  belakang: [2, 3],
};

export function extractTargetPair(draw: string, target: Target2D): readonly [number, number] {
  if (!/^\d{4}$/.test(draw)) throw new Error(`Result 4D tidak valid: ${draw}`);
  const [leftIndex, rightIndex] = TARGET_INDEXES[target];
  return [Number(draw[leftIndex]), Number(draw[rightIndex])];
}
