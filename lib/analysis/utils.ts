import { DIGITS, SHIO_2D } from "./constants";
export { buildCustomDigitLines } from "./customDigit";

export type LineSection = { label: string; lines: string[] };

export const safeArray = (value: any) => Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
export const statsFrom = (value: any) => Array.isArray(value?.stats) ? value.stats : [];
export const format2D = (n: number | string) => String(n).padStart(2, "0");
export const normalDigitList = (value: any) => Array.from(new Set(safeArray(value).map((v: any) => String(v)).filter((v: string) => /^\d$/.test(v))));
export const toNumberList = (value: any) => Array.from(new Set(safeArray(value).map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v))));

export const jumlah2D = (a: number, b: number) => {
  const s = a + b;
  return s >= 10 ? s - 9 : s;
};

export const shioOf2D = (n: number) => {
  for (const [shio, list] of Object.entries(SHIO_2D)) {
    if (list.includes(n)) return Number(shio);
  }
  return 1;
};

export const buildAngkaJadi = (type: string, result: any): { sections: LineSection[] } => {
  if (!result) return { sections: [] };

  if (type === "mati") {
    const jadi = (pos: string) => {
      const off = normalDigitList(result[pos]?.result);
      const allowed = DIGITS.filter((d) => !off.includes(d));
      return allowed.length ? allowed : DIGITS;
    };
    const kop = jadi("KOP");
    const kepala = jadi("KEPALA");
    const ekor = jadi("EKOR");
    const lines3D: string[] = [];
    const lines2D: string[] = [];
    kop.forEach((k) => kepala.forEach((h) => ekor.forEach((e) => lines3D.push(`${k}${h}${e}`))));
    kepala.forEach((h) => ekor.forEach((e) => lines2D.push(`${h}${e}`)));
    return { sections: [{ label: "ANGKA JADI 3D", lines: lines3D }, { label: "ANGKA JADI 2D", lines: lines2D }] };
  }

  if (type === "jumlah") {
    const off = normalDigitList(result.result);
    const lines: string[] = [];
    for (let k = 0; k <= 9; k++) {
      for (let e = 0; e <= 9; e++) {
        if (!off.includes(String(jumlah2D(k, e)))) lines.push(`${k}${e}`);
      }
    }
    return { sections: [{ label: "ANGKA JADI 2D", lines }] };
  }

  if (type === "shio") {
    const offShio = Array.from(new Set(safeArray(result.result).map((v: any) => Number(String(v).match(/\d+/)?.[0] ?? v)).filter((v: number) => Number.isFinite(v) && v >= 1 && v <= 12)));
    const lines: string[] = [];
    for (let n = 0; n <= 99; n++) {
      if (!offShio.includes(shioOf2D(n))) lines.push(format2D(n));
    }
    return { sections: [{ label: "ANGKA JADI 2D", lines }] };
  }

  return { sections: [] };
};