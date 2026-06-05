import "server-only";
import { TBL_I, TBL_L, TBL_B, TBL_T, _0xJ2d, _0xc3c54e } from './tables';

const R56_ALDY_BUSTER: Record<number, number> = {
  0: 3,
  1: 2,
  2: 3,
  3: 6,
  4: 5,
  5: 6,
  6: 9,
  7: 2,
  8: 1,
  9: 4,
};

export const RM_NAMES = [
  "R01 Phantom Edge","R02 Shadow Index","R03 Night Blade","R04 Void Pulse","R05 Ghost Bridge",
  "R06 Dark Mirror","R07 Venom Drift","R08 Silent Spike","R09 Dead Zone","R10 Hex Cutter",
  "R11 Zero Cross","R12 Skull Shift","R13 Toxic Morph","R14 Black Helix","R15 Iron Gate",
  "R16 Reaper Flux","R17 Ash Spiral","R18 Grave Lock","R19 Doom Cycle","R20 Final Axe",
  "R21 Twin AS Strike","R22 Kop Mirror Delta","R23 Cross Line Death","R24 Mystic Cross Sum","R25 Beta Edge Clash",
  "R26 Hybrid 4D Sum","R27 Taysen Tail Echo","R28 Raw Head Strike","R29 Index Inner Cross","R30 Mystic Total Kill",
  "R31 Taysen Cross Multiplex","R32 Kop-Ekor Squared Drop","R33 Front Cascade Mist","R34 Twin Index Clash","R35 Head-Tail Inversion",
  "R36 Double Mistis Core","R37 Outer Cross Index","R38 Biji 2D Backward","R39 Absolute Delta 4D","R40 Phantom Tesson Strike",
  "R41 Double Tail Strike","R42 Kop-Kepala Cross Index","R43 Mystic 3D Rear","R44 As-Ekor Multiplier","R45 Inner Resonance Mist",
  "R46 Taysen Alpha-Omega","R47 Cross Wing Squared","R48 Index Gap Shift","R49 Past Biji Multiplier","R50 Taysen Triple Front",
  "R51 Moegywara666","R52 Nexus Index","R53 Tri Shift","R54 Alpha Shift Four","R55 Rear Drop Sum",
  "R56 Aldy Buster"
];

export function _0x3ca571(a: string, b: string) {
  const p = { as: +a[0], kop: +a[1], kpl: +a[2], ekr: +a[3] };
  const c2 = { as: +b[0], kop: +b[1], kpl: +b[2], ekr: +b[3] };
  return {
    a: (c2.kpl + c2.ekr) % 10, b: TBL_I[(c2.as + c2.ekr) % 10], c: TBL_L[(c2.kop + c2.kpl) % 10],
    d: Math.abs(c2.as - c2.ekr), e: TBL_B[(p.ekr + c2.ekr) % 10], f: TBL_I[(p.as + c2.as) % 10],
    g: (c2.as + c2.kop + c2.kpl + c2.ekr) % 10, h: TBL_L[(c2.ekr + 1) % 10], i: TBL_I[Math.abs(c2.kpl - c2.ekr)],
    j: (c2.as + c2.kop) % 10, k: TBL_I[Math.abs(c2.kop - c2.kpl)], l: (p.kpl + c2.kpl) % 10,
    m: TBL_T[(c2.kpl + c2.ekr) % 10], n: TBL_L[(p.kop + c2.kop) % 10], o: TBL_I[(c2.as + c2.kpl) % 10],
    p: TBL_L[Math.abs(c2.as - c2.kpl)], q: TBL_B[Math.abs(c2.kop - c2.ekr)], r: (c2.kop + c2.kpl + c2.ekr) % 10,
    s: TBL_I[(c2.kpl + 1) % 10], t: TBL_T[c2.as], u: (p.as + c2.as) % 10, v: Math.abs(p.kop - c2.kop),
    w: (p.kpl + c2.ekr) % 10, x: TBL_L[(p.as + c2.kop) % 10], y: TBL_B[Math.abs(p.ekr - c2.as)],
    z: (p.as + p.kop + c2.kpl + c2.ekr) % 10, aa: TBL_T[(p.ekr + c2.ekr) % 10], bb: Math.abs(c2.as - c2.kpl),
    cc: TBL_I[(c2.kop + c2.ekr) % 10], dd: TBL_L[(c2.as + c2.kop + c2.kpl + c2.ekr) % 10],
    ee: TBL_B[TBL_T[(c2.as + p.ekr) % 10]], ff: (c2.kop * c2.ekr) % 10, gg: TBL_L[(c2.as + c2.kop + c2.kpl) % 10],
    hh: (TBL_I[(p.as + c2.as) % 10] + TBL_B[(p.ekr + c2.ekr) % 10]) % 10, ii: Math.abs(TBL_T[c2.kpl] - TBL_T[c2.ekr]),
    jj: (TBL_L[c2.kop] + TBL_B[c2.kpl]) % 10, kk: TBL_I[(p.as + c2.ekr) % 10], ll: TBL_T[(p.kpl + p.ekr + c2.kpl + c2.ekr) % 10],
    mm: Math.abs((c2.as + c2.kop) - (c2.kpl + c2.ekr)) % 10, nn: TBL_T[(p.kop + c2.kpl) % 10], oo: TBL_I[(p.ekr * c2.ekr) % 10],
    pp: TBL_I[Math.abs(p.kop - c2.kpl)], qq: TBL_L[(c2.kop + c2.kpl + c2.ekr) % 10], rr: (c2.as * p.ekr) % 10,
    ss: TBL_B[(p.kop + p.kpl + c2.kop + c2.kpl) % 10], tt: Math.abs(TBL_T[c2.as] - TBL_T[c2.ekr]), uu: ((p.as + c2.ekr) * (p.ekr + c2.as)) % 10,
    vv: TBL_I[Math.abs(c2.kop - p.kpl)], ww: (((p.as + p.kop + p.kpl + p.ekr) % 10) * c2.ekr) % 10, xx: TBL_T[(c2.as + c2.kop + c2.kpl) % 10],
    // R51 Rumus Moegywara666
    yy: _0xJ2d(_0xJ2d(c2.kpl, c2.ekr), 6),
    zz: TBL_I[(c2.as + c2.kop) % 10],
    aaa: (c2.as + c2.kop + 3) % 10,
    bbb: _0xc3c54e(_0xJ2d(c2.as, c2.kop) + 4),
    ccc: _0xc3c54e(c2.kpl + c2.ekr - 1),
    ddd: R56_ALDY_BUSTER[c2.ekr],
  };
}
