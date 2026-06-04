import "server-only";
import { _0x3ca571 } from './offFormula.js';

export function _0xEngineMatiPos(D: string[], posIdx: number, param: number = 1) {
  const U = D.slice(-17);
  const SA: Record<string, number> = {};
  const MK = Object.keys(_0x3ca571('0000', '0000'));
  MK.forEach((k) => { SA[k] = 0; });

  for (let i = 0; i < 14; i++) {
    const pr: any = _0x3ca571(U[i], U[i + 1]), tg = U[i + 2];
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

  let el = MK.filter((k) => SA[k] >= 14);
  if (el.length === 0) {
    const mx = Math.max(...MK.map((k) => SA[k]));
    el = MK.filter((k) => SA[k] === mx);
  }

  const FP: any = _0x3ca571(D[D.length - 2], D[D.length - 1]);
  const ct: Record<string, number> = {};
  el.forEach((k) => {
    const v = String(FP[k]);
    ct[v] = (ct[v] || 0) + 1;
  });

  const sr = Object.keys(ct).sort((a, b) => {
    if (ct[b] !== ct[a]) return ct[b] - ct[a];
    if ((fq[a] || 0) !== (fq[b] || 0)) return (fq[a] || 0) - (fq[b] || 0);
    return (rc[b] || 99) - (rc[a] || 99);
  });

  let hasil: string[] = [];
  for (let fi = 0; fi < sr.length && hasil.length < param; fi++) {
    hasil.push(sr[fi]);
  }
  if (hasil.length < param) {
    const fb = Object.keys(fq).sort((a, b) => {
      if (fq[a] !== fq[b]) return fq[a] - fq[b];
      return (rc[b] || 99) - (rc[a] || 99);
    });
    for (let fi = 0; fi < fb.length && hasil.length < param; fi++) {
      if (!hasil.includes(fb[fi])) hasil.push(fb[fi]);
    }
  }
  if (hasil.length === 0) hasil = ['0'];
  return hasil;
}
