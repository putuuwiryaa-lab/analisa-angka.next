import "server-only";
export const SHIO_TBL: Record<number, number> = (function () {
  const t: Record<number, number> = {};
  const data = [
    [1, [1, 13, 25, 37, 49, 61, 73, 85, 97]],
    [2, [2, 14, 26, 38, 50, 62, 74, 86, 98]],
    [3, [3, 15, 27, 39, 51, 63, 75, 87, 99]],
    [4, [4, 16, 28, 40, 52, 64, 76, 88, 0]],
    [5, [5, 17, 29, 41, 53, 65, 77, 89]],
    [6, [6, 18, 30, 42, 54, 66, 78, 90]],
    [7, [7, 19, 31, 43, 55, 67, 79, 91]],
    [8, [8, 20, 32, 44, 56, 68, 80, 92]],
    [9, [9, 21, 33, 45, 57, 69, 81, 93]],
    [10, [10, 22, 34, 46, 58, 70, 82, 94]],
    [11, [11, 23, 35, 47, 59, 71, 83, 95]],
    [12, [12, 24, 36, 48, 60, 72, 84, 96]],
  ];
  data.forEach((d) => { (d[1] as number[]).forEach((n: number) => { t[n] = d[0] as number; }); });
  return t;
})();

type TargetPair = 'depan' | 'tengah' | 'belakang';

function targetIndexes(targetPair: TargetPair = 'belakang') {
  if (targetPair === 'depan') return [0, 1] as const;
  if (targetPair === 'tengah') return [1, 2] as const;
  return [2, 3] as const;
}

export function _0x2d4get(r: string, targetPair: TargetPair = 'belakang') {
  const [a, b] = targetIndexes(targetPair);
  const n = parseInt(r[a]) * 10 + parseInt(r[b]);
  return SHIO_TBL[n] || SHIO_TBL[n % 100] || 1;
}

export function _0xRumusShio(a: string, b: string) {
  const p = { A: +a[0], B: +a[1], C: +a[2], D: +a[3] };
  const c = { A: +b[0], B: +b[1], C: +b[2], D: +b[3] };
  const m = (x: number) => ((x - 1) % 12 + 12) % 12 + 1;
  return {
    k1: m(c.A + c.B + c.C + c.D), k2: m(p.D + c.D), k3: m(c.C * c.D), k4: m(c.A * c.D), k5: m(c.B + c.C),
    k6: m(p.A + c.A), k7: m(p.B + c.B), k8: m(p.C + c.C), k9: m(c.A - c.D), k10: m(c.B - c.C), k11: m(p.D * c.A),
    k12: m(p.C * c.B), k13: m(p.B * c.C), k14: m(p.A * c.D), k15: m(c.A + c.B), k16: m(c.C + c.D),
    k17: m(p.A + p.B + c.C + c.D), k18: m(p.C + p.D + c.A + c.B), k19: m(c.A * c.B), k20: m(p.A * p.B),
    k21: m(c.A + c.C), k22: m(c.B + c.D), k23: m(p.A + c.C), k24: m(p.B + c.D), k25: m(p.A - c.A),
    k26: m(p.B - c.B), k27: m(p.C - c.C), k28: m(p.D - c.D), k29: m(c.A + p.D), k30: m(c.D + p.A),
    k31: m(c.A * p.A), k32: m(c.B * p.B), k33: m(c.C * p.C), k34: m(c.D * p.D), k35: m((c.A + c.B) * (c.C + c.D)),
    k36: m((p.A + p.B) * (p.C + p.D)), k37: m(c.A + c.B - c.C), k38: m(c.B + c.C - c.D), k39: m(p.A + p.B - c.D),
    k40: m(p.C + p.D - c.A), k41: m(c.A + c.D + p.A + p.D), k42: m(c.B + c.C + p.B + p.C), k43: m((c.A * c.C) + c.D),
    k44: m((c.B * c.D) + c.A), k45: m((p.A * p.C) + p.D), k46: m((p.B * p.D) + p.A), k47: m(c.A + p.B + c.C + p.D),
    k48: m(c.B + p.C + c.D + p.A), k49: m(c.A * c.B * c.C), k50: m(c.B * c.C * c.D),
    k51: m((c.A + c.D) * 2 - c.B), k52: m((c.B + c.C) * 2 - p.D), k53: m((p.A + c.C) * (c.D + 1)),
    k54: m((p.D + c.A) * (c.B + 1)), k55: m((c.A * c.D) - (p.B + c.C)), k56: m((c.B * c.C) - (p.A + c.D)),
    k57: m((p.A + p.D + c.B) * 2), k58: m((p.B + p.C + c.D) * 2), k59: m((c.A + c.B + p.C + p.D) - c.D),
    k60: m((c.C + c.D + p.A + p.B) - c.A),
  };
}

export const SHIO_RUMUS_NAMES = [
  "RS01 Lunar Blade","RS02 Zodiac Drift","RS03 Beast Helix","RS04 Modulus Pulse","RS05 Astral Gate",
  "RS06 Night Zodiac","RS07 Phantom Beast","RS08 Void Modulus","RS09 Lunar Zone","RS10 Hex Zodiac",
  "RS11 Zero Orbit","RS12 Skull Shift","RS13 Toxic Beast","RS14 Dark Lunar","RS15 Iron Modulus",
  "RS16 Reaper Zodiac","RS17 Ash Orbit","RS18 Grave Cycle","RS19 Doom Beast","RS20 Final Modulus",
  "RS21 Twin Zodiac Strike","RS22 Lunar Mirror Delta","RS23 Cross Beast Death","RS24 Modulus Cross Sum","RS25 Beta Lunar Clash",
  "RS26 Hybrid Zodiac Sum","RS27 Beast Tail Echo","RS28 Raw Lunar Strike","RS29 Orbit Inner Cross","RS30 Zodiac Total Kill",
  "RS31 Modulus Cross Multiplex","RS32 Lunar Squared Drop","RS33 Front Cascade Beast","RS34 Twin Orbit Clash","RS35 Zodiac Inversion",
  "RS36 Double Modulus Core","RS37 Outer Cross Lunar","RS38 Beast 2D Backward","RS39 Absolute Zodiac 4D","RS40 Phantom Orbit Strike",
  "RS41 Double Lunar Strike","RS42 Beast Cross Matrix","RS43 Modulus 3D Rear","RS44 Lunar Multiplier","RS45 Inner Resonance Beast",
  "RS46 Zodiac Alpha-Omega","RS47 Cross Wing Orbit","RS48 Modulus Gap Shift","RS49 Past Lunar Multiplier","RS50 Zodiac Triple Front",
  "RS51 Twin Lunar Drop","RS52 Beast Double Drift","RS53 Cross Zodiac Gate","RS54 Alpha Tail Orbit","RS55 Lunar Clash Minus",
  "RS56 Beast Core Minus","RS57 Past Alpha Surge","RS58 Past Core Surge","RS59 Mixed Front Shift","RS60 Mixed Rear Shift"
];

export function _0xEngineShioMati(D: string[], param: number = 1, targetPair: TargetPair = 'belakang') {
  const U = D.slice(-17);
  const SA: Record<string, number> = {};
  const MK = Object.keys(_0xRumusShio('0000', '0000'));
  MK.forEach((k) => { SA[k] = 0; });

  for (let i = 0; i < 14; i++) {
    const pr: any = _0xRumusShio(U[i], U[i + 1]), sh = _0x2d4get(U[i + 2], targetPair);
    MK.forEach((k) => { if (pr[k] !== sh) SA[k] += 1; });
  }

  const fq: Record<number, number> = {};
  for (let s = 1; s <= 12; s++) fq[s] = 0;
  U.forEach((r) => { const s = _0x2d4get(r, targetPair); fq[s]++; });

  const rc: Record<number, number> = {};
  for (let s = 1; s <= 12; s++) rc[s] = 99;
  for (let j = U.length - 1; j >= 0; j--) {
    const sj = _0x2d4get(U[j], targetPair);
    if (rc[sj] === 99) rc[sj] = (U.length - 1 - j);
  }

  let el = MK.filter((k) => SA[k] >= 14);
  if (el.length === 0) {
    const mx = Math.max(...MK.map((k) => SA[k]));
    el = MK.filter((k) => SA[k] === mx);
  }

  const FP: any = _0xRumusShio(D[D.length - 2], D[D.length - 1]);
  const ct: Record<number, number> = {};
  el.forEach((k) => {
    const v = FP[k];
    ct[v] = (ct[v] || 0) + 1;
  });

  const sr = Object.keys(ct).map(Number).sort((a, b) => {
    if (ct[b] !== ct[a]) return ct[b] - ct[a];
    const ga = (rc[a] || 99) === 99 ? 1 : 0, gb = (rc[b] || 99) === 99 ? 1 : 0;
    if (ga !== gb) return ga - gb;
    if ((fq[b] || 0) !== (fq[a])) return (fq[b] || 0) - (fq[a] || 0);
    return (rc[a] || 99) - (rc[b] || 99);
  });

  return sr.slice(0, param);
}
