/**
 * Canonical cutoff identity shared by the Next.js read path and the Deno
 * Adaptive engine. The 64-bit FNV-1a hash must remain bit-for-bit identical to
 * adaptive-service/core/engine.mts.
 */
export function adaptiveHistoryCutoffKey(draws: readonly string[]): string {
  if (draws.length === 0) throw new Error("Histori Adaptive kosong.");
  let hash = 0xcbf29ce484222325n;
  const input = draws.join("|");
  for (let index = 0; index < input.length; index++) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `${draws.length}:${draws[draws.length - 1]}:${hash.toString(16).padStart(16, "0")}`;
}
