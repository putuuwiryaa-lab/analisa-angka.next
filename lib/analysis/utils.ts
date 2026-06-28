import { DIGITS, jumlah2D, shioOf2D } from "./constants";

type LineSection = { label: string; lines: string[] };

const toNumberList = (value: any): number[] => {
  if (Array.isArray(value)) return value.map(Number).filter((n) => Number.isFinite(n));
  if (typeof value === "string") return value.split("").map(Number).filter((n) => Number.isFinite(n));
  return [];
};

const normalDigitList = (value: any) => toNumberList(value).filter((digit) => digit >= 0 && digit <= 9);

const safeArray = (value: any): any[] => (Array.isArray(value) ? value : value ? [value] : []);

function is2DAnalysisResult(result: any) {
  const scope = result?.analysisScope || result?.analysis_scope || "default";
  return scope === "2d_depan" || scope === "2d_tengah" || scope === "2d_belakang" || result?.targetPair;
}

function buildAiGgbkAngkaJadi(result: any): LineSection[] {
  const ggbk = result?.bbfsGgbk;
  if (!ggbk || !Array.isArray(ggbk.sections)) return [];
  return ggbk.sections
    .map((section: any) => ({ label: section.label || "BBFS GGBK", lines: safeArray(section.lines).map(String) }))
    .filter((section: LineSection) => section.lines.length);
}

function buildAiAngkaJadi(result: any): LineSection[] {
  const ggbkSections = buildAiGgbkAngkaJadi(result);
  if (ggbkSections.length) return ggbkSections;
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

  if (type === "bbfs" || type === "bbfs7_tradisional") {
    return { sections: buildBbfsAngkaJadi(result) };
  }

  if (type === "mati") {
    const jadi = (pos: string) => {
      const off = normalDigitList(result[pos]?.result);
      const allowed = DIGITS.filter((d) => !off.includes(Number(d)));
      return allowed.length ? allowed : DIGITS;
    };
    const kop = jadi("KOP");
    const kepala = jadi("KEPALA");
    const ekor = jadi("EKOR");
    const lines3D: string[] = [];
    const lines2D: string[] = [];
    for (const k of kop) for (const h of kepala) for (const e of ekor) lines3D.push(`${k}${h}${e}`);
    for (const h of kepala) for (const e of ekor) lines2D.push(`${h}${e}`);
    return { sections: [{ label: "3D", lines: lines3D }, { label: "2D BELAKANG", lines: lines2D }] };
  }

  if (type === "jumlah") {
    const off = normalDigitList(result.result);
    const allowed = DIGITS.map(Number).filter((digit) => !off.includes(digit));
    const lines: string[] = [];
    for (let k = 0; k <= 9; k++) {
      for (let e = 0; e <= 9; e++) {
        if (allowed.includes(jumlah2D(k, e))) lines.push(`${k}${e}`);
      }
    }
    return { sections: [{ label: "2D JUMLAH AKTIF", lines }] };
  }

  if (type === "shio") {
    const off = normalDigitList(result.result);
    const allowed = Array.from({ length: 12 }, (_, index) => index + 1).filter((shio) => !off.includes(shio));
    const lines = Array.from({ length: 100 }, (_, n) => n.toString().padStart(2, "0")).filter((line) => allowed.includes(shioOf2D(Number(line))));
    return { sections: [{ label: "2D SHIO AKTIF", lines }] };
  }

  return { sections: [] };
};

export { safeArray, statsFrom } from "./utilsCore";
