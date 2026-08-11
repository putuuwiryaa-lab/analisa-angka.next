import "server-only";
import { _0x3ca571, RM_NAMES } from './offFormula';

export type MatiPosStat = {
  name: string;
  score: number;
  lolos: boolean;
  fallback: boolean;
};
export type MatiPosResult = {
  result: string[];
  stats: MatiPosStat[];
  activeCount: number;
  fallback: boolean;
};
export type MatiEliteSelection = {
  keys: string[];
  fallback: boolean;
};

const NEVER_SEEN_RECENCY = 99;

export function selectMatiEliteKeys(
  keys: string[],
  scores: Record<string, number>,
): MatiEliteSelection {
  const perfect = keys.filter((key) => (scores[key] ?? 0) >= 14);
  if (perfect.length > 0) return { keys: perfect, fallback: false };

  const maxScore = Math.max(...keys.map((key) => scores[key] ?? 0));
  return {
    keys: keys.filter((key) => (scores[key] ?? 0) === maxScore),
    fallback: true,
  };
}

export function matiRecencyValue(
  recency: Record<string, number>,
  digit: string,
) {
  return recency[digit] ?? NEVER_SEEN_RECENCY;
}

export function buildMatiActiveStats({
  keys,
  names,
  scores,
  eliteSelection,
  predictions,
  result,
}: {
  keys: string[];
  names: string[];
  scores: Record<string, number>;
  eliteSelection: MatiEliteSelection;
  predictions: Record<string, number>;
  result: string[];
}): MatiPosStat[] {
  const eliteKeys = new Set(eliteSelection.keys);

  return keys
    .filter(
      (key) =>
        eliteKeys.has(key) && result.includes(String(predictions[key])),
    )
    .map((key) => {
      const index = keys.indexOf(key);
      return {
        name: names[index],
        score: scores[key],
        lolos: true,
        fallback: eliteSelection.fallback,
      };
    });
}

/**
 * Engine angka mati per posisi (AS=0, KOP=1, KEPALA=2, EKOR=3).
 * SATU sumber kebenaran — dipakai menu Mati DAN menu Rekap.
 *
 * Alur: walk-forward 14 langkah → rumus elite (SA>=14, fallback ke skor max)
 *       → FP → urut kandidat (count → freq → recency) → ambil `param`
 *       → FALLBACK: tambal kekurangan dari digit paling jarang muncul.
 */
export function runMatiPos(D: string[], posIdx: number, param: number = 1): MatiPosResult {
  const U = D.slice(-17);
  const MK = Object.keys(_0x3ca571('0000', '0000'));

  const SA: Record<string, number> = {};
  MK.forEach((k) => { SA[k] = 0; });
  for (let i = 0; i < 14; i++) {
    const pr: any = _0x3ca571(U[i], U[i + 1]);
    const tg = U[i + 2];
    const val = parseInt(tg[posIdx]);
    MK.forEach((k) => { if (pr[k] !== val) SA[k] += 1; });
  }

  const fq: Record<string, number> = {};
  for (let d = 0; d <= 9; d++) fq[String(d)] = 0;
  U.forEach((r) => { fq[r[posIdx]]++; });

  const rc: Record<string, number> = {};
  for (let d = 0; d <= 9; d++) rc[String(d)] = 99;
  for (let j = U.length - 1; j >= 0; j--) {
    const dg = U[j][posIdx];
    if (rc[dg] === 99) rc[dg] = (U.length - 1 - j);
  }

  const eliteSelection = selectMatiEliteKeys(MK, SA);
  const el = eliteSelection.keys;

  const FP: any = _0x3ca571(D[D.length - 2], D[D.length - 1]);
  const ct: Record<string, number> = {};
  el.forEach((k) => { const v = String(FP[k]); ct[v] = (ct[v] || 0) + 1; });

  const sr = Object.keys(ct).sort((a, b) => {
    if (ct[b] !== ct[a]) return ct[b] - ct[a];
    if ((fq[a] || 0) !== (fq[b] || 0)) return (fq[a] || 0) - (fq[b] || 0);
    return matiRecencyValue(rc, b) - matiRecencyValue(rc, a);
  });

  // Kandidat utama dari rumus elite.
  const result: string[] = [];
  for (let fi = 0; fi < sr.length && result.length < param; fi++) {
    result.push(sr[fi]);
  }

  // FALLBACK: kalau kurang dari `param`, tambal dari digit paling jarang muncul.
  if (result.length < param) {
    const fb = Object.keys(fq).sort((a, b) => {
      if (fq[a] !== fq[b]) return fq[a] - fq[b];
      return matiRecencyValue(rc, b) - matiRecencyValue(rc, a);
    });
    for (let fi = 0; fi < fb.length && result.length < param; fi++) {
      if (!result.includes(fb[fi])) result.push(fb[fi]);
    }
  }

  if (result.length === 0) result.push('0');

  // Stats hanya untuk rumus aktif yang FP-nya termasuk hasil terpilih (untuk panel Detail Validasi).
  const stats = buildMatiActiveStats({
    keys: MK,
    names: RM_NAMES,
    scores: SA,
    eliteSelection,
    predictions: FP,
    result,
  });

  return {
    result,
    stats,
    activeCount: stats.length,
    fallback: eliteSelection.fallback,
  };
}
