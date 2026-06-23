import { DIGITS, jumlah2D, shioOf2D } from "./constants";
export { buildCustomDigitLines } from "./customDigit";

// Re-export helper bersama agar impor lama dari "utils" tetap jalan.
export { jumlah2D, shioOf2D };

export type LineSection = { label: string; lines: string[] };

export const safeArray = (value: any) => Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
export const statsFrom = (value: any) => Array.isArray(value?.stats) ? value.stats : [];
export const format2D = (n: number | string) => String(n).padStart(2, "0");
export const normalDigitList = (value: any) => Array.from(new Set(safeArray(value).map((v: any) => String(v)).filter((v: string) => /^\d$/.test(v))));
export const toNumberList = (value: any) => Array.from(new Set(safeArray(value).map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v))));

function is2DAnalysisResult(result: any) {
  const scope = String(result?.analysis_scope || "default");
  return scope === "default" || scope === "2d_depan" || scope === "2d_tengah" || scope === "2d_belakang";
}

function buildAiAngkaJadi(result: any): LineSection[] {
  if (!is2DAnalysisResult(result)) return [];

  const ikut = toNumberList(result.result).filter((digit) => digit >= 0 && digit <= 9);
  if (!ikut.length) return [];

  const lines: string[] = [];
  for (let k = 0; k <= 9; k++) {
    for (let e = 0; e <= 9; e++) {
      if (ikut.includes(k) || ikut.includes(e)) lines.push(`${k}${e}`);
    }
  }

  return [{ label: "ANGKA JADI 2D", lines }];
}

function buildBbfsAngkaJadi(result: any): LineSection[] {
  if (!is2DAnalysisResult(result)) return [];

  const bbfs = toNumberList(result.result).filter((digit) => digit >= 0 && digit <= 9);
  if (!bbfs.length) return [];

  const lines: string[] = [];
  for (let k = 0; k <= 9; k++) {
    for (let e = 0; e <= 9; e++) {
      if (bbfs.includes(k) && bbfs.includes(e)) lines.push(`${k}${e}`);
    }
  }

  return [{ label: "ANGKA JADI 2D", lines }];
}

export const buildAngkaJadi = (type: string, result: any): { sections: LineSection[] } => {
  if (!result) return { sections: [] };

  if (type === "ai") {
    return { sections: buildAiAngkaJadi(result) };
  }

  if (type === "bbfs") {
    return { sections: buildBbfsAngkaJadi(result) };
  }

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
