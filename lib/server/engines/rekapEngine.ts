import "server-only";
import { _0xJ2d } from './tables';
import { _0xEngineAI } from './aiEngine';
import { runMatiPos } from './matiEngine';
import { _0xEngineJumlahMati } from './jumlahEngine';
import { _0x2d4get, _0xEngineShioMati } from './shioEngine';

export function runRekap(D: string[], param: number) {
  const isTop = param === 2;

  // Rekap = kombinator murni: panggil engine lain, lalu silang jadi line 2D.
  const CT = isTop ? _0xEngineAI(D, 4) : _0xEngineAI(D, 6);
  const LK = isTop ? runMatiPos(D, 2, 3).result.map(Number) : runMatiPos(D, 2, 1).result.map(Number);
  const LE = isTop ? runMatiPos(D, 3, 3).result.map(Number) : runMatiPos(D, 3, 1).result.map(Number);
  const LJ = isTop ? _0xEngineJumlahMati(D, 2).map(Number) : _0xEngineJumlahMati(D, 1).map(Number);
  const LS = isTop ? _0xEngineShioMati(D, 2).map(Number) : _0xEngineShioMati(D, 1).map(Number);

  const lines = [];
  for (let k = 0; k <= 9; k++) {
    for (let e = 0; e <= 9; e++) {
      if (LK.includes(k) || LE.includes(e) || LJ.includes(_0xJ2d(k, e))) continue;
      if (LS.includes(_0x2d4get(`00${k}${e}`))) continue;
      if (CT.indexOf(k) === -1 && CT.indexOf(e) === -1) continue;
      lines.push(`${k}${e}`);
    }
  }

  return {
    success: true,
    data: {
      ai: CT,
      offKepala: LK,
      offEkor: LE,
      offJumlah: LJ,
      offShio: LS,
      lines,
    },
  };
}
