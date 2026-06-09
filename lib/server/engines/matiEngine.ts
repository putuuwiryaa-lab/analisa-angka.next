import "server-only";
import { _0x3ca571, RM_NAMES } from './offFormula';

export type MatiPosStat = { name: string; score: number; lolos: boolean };
export type MatiPosResult = {
  result: string[];
  stats: MatiPosStat[];
  activeCount: number;
};

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

  const allStats = MK.map((k, idx) => ({ key: k, name: RM_NAMES[idx], score: SA[k], lolos: SA[k] >= 14 }));

  const fq: Record<string, number> = {};
  for (let d = 0; d <= 9; d++) fq[String(d)] = 0;
  U.forEach((r) => { fq[r[posIdx]]++; });

  const rc: Record<string, number> = {};
  for (let d = 0; d <= 9; d++) rc[String(d)] = 99;
  for (let j = U.length - 1; j >= 0; j--) {
    const dg = U[j][posIdx];
    if (rc[dg] === 99) rc[dg] = (U.length - 1 - j);
  }

  let el = MK.filter((k) => SA[k] >= 14);
  if (el.length === 0) {
    const mx = Math.max(...MK.map((k) => SA[k]));
    el = MK.filter((k) => SA[k] === mx);
  }

  const FP: any = _0x3ca571(D[D.length - 2], D[D.length - 1]);
  const ct: Record<string, number> = {};
  el.forEach((k) => { const v = String(FP[k]); ct[v] = (ct[v] || 0) + 1; });

  const sr = Object.keys(ct).sort((a, b) => {
    if (ct[b] !== ct[a]) return ct[b] - ct[a];
    if ((fq[a] || 0) !== (fq[b] || 0)) return (fq[a] || 0) - (fq[b] || 0);
    return (rc[b] || 99) - (rc[a] || 99);
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
      return (rc[b] || 99) - (rc[a] || 99);
    });
    for (let fi = 0; fi < fb.length && result.length < param; fi++) {
      if (!result.includes(fb[fi])) result.push(fb[fi]);
    }
  }

  if (result.length === 0) result.push('0');

  // Stats hanya untuk rumus elite yang FP-nya termasuk hasil terpilih (untuk panel Detail Validasi).
  const stats: MatiPosStat[] = allStats
    .filter((s) => s.lolos && result.includes(String(FP[s.key])))
    .map((s) => ({ name: s.name, score: s.score, lolos: s.lolos }));

  return { result, stats, activeCount: stats.length };
}
