import { toNumberList } from "@/lib/analysis/utils";
import {
  buildCustomDigitLines,
  bbfsScopeToTargetPair,
  customFocusPairs,
  customFocusToBBFSScope,
  type CustomFocus,
  type TargetPair,
} from "@/lib/analysis/customDigit";
import type { AnalysisScope } from "./ScopeSelectors";

export type PostAnalyze = (
  type: string,
  data: string[],
  param: number,
  targetPair?: TargetPair,
  scope?: AnalysisScope,
) => Promise<any>;

export type PairAiMap = Partial<Record<TargetPair, 2 | 4 | 6 | null>>;
export type PairBoolMap = Partial<Record<TargetPair, boolean>>;
export type PairCountMap = Partial<Record<TargetPair, number | null>>;

export interface CustomDigitState {
  customFocus: CustomFocus;
  customAiDigitByPair: PairAiMap;
  customAiParityByPair: PairBoolMap;
  customAiSizeByPair: PairBoolMap;
  customAi3dDigit: 1 | 3 | 5 | null;
  customAi3dParity: boolean;
  customAi3dSize: boolean;
  customAi4dDigit: 1 | 2 | 4 | null;
  customBBFSDigit: 7 | 8 | 9 | 10 | null;
  customOffAsCount: number | null;
  customOffKopCount: number | null;
  customOffKepalaCount: number | null;
  customOffEkorCount: number | null;
  customOffJumlahCountByPair: PairCountMap;
  customOffShioCountByPair: PairCountMap;
}

/** Cek apakah minimal satu filter dipilih sebelum generate. */
export function hasAnyCustomFilter(s: CustomDigitState): boolean {
  const pairs = customFocusPairs(s.customFocus);
  const hasAnyPairFilter = pairs.some(
    (pair) =>
      s.customAiDigitByPair[pair] ||
      s.customAiParityByPair[pair] ||
      s.customAiSizeByPair[pair] ||
      s.customOffJumlahCountByPair[pair] ||
      s.customOffShioCountByPair[pair],
  );
  const hasScopedAiFilter = Boolean(
    s.customAi3dDigit || s.customAi3dParity || s.customAi3dSize || s.customAi4dDigit,
  );
  return Boolean(
    hasAnyPairFilter ||
      hasScopedAiFilter ||
      s.customBBFSDigit ||
      s.customOffAsCount ||
      s.customOffKopCount ||
      s.customOffKepalaCount ||
      s.customOffEkorCount,
  );
}

/** Jalankan semua sub-analisa lalu rakit hasil rekap custom digit. */
export async function runCustomDigitGenerate(
  postAnalyze: PostAnalyze,
  data: string[],
  s: CustomDigitState,
): Promise<Record<string, any>> {
  const { customFocus } = s;
  const pairs = customFocusPairs(customFocus);

  const aiByPair: Partial<Record<TargetPair, number[]>> = {};
  const aiParityByPair: Partial<Record<TargetPair, string>> = {};
  const aiSizeByPair: Partial<Record<TargetPair, string>> = {};
  const jumlahByPair: Partial<Record<TargetPair, number[]>> = {};
  const shioByPair: Partial<Record<TargetPair, number[]>> = {};
  const matiCache: Partial<Record<number, any>> = {};
  let ai3d: number[] = [];
  let ai3dParity = "";
  let ai3dSize = "";
  let ai4d: number[] = [];
  let bbfsGlobal: number[] = [];
  let bbfsGgbk: any = null;

  for (const pair of pairs) {
    const aiDigit = s.customAiDigitByPair[pair];
    const jumlahCount = s.customOffJumlahCountByPair[pair];
    const shioCount = s.customOffShioCountByPair[pair];
    if (aiDigit) aiByPair[pair] = toNumberList((await postAnalyze("ai", data, aiDigit, pair))?.result);
    if (s.customAiParityByPair[pair]) {
      const raw = (await postAnalyze("ai", data, 7, pair))?.result;
      aiParityByPair[pair] = String((Array.isArray(raw) ? raw[0] : raw) || "").trim().toUpperCase();
    }
    if (s.customAiSizeByPair[pair]) {
      const raw = (await postAnalyze("ai", data, 8, pair))?.result;
      aiSizeByPair[pair] = String((Array.isArray(raw) ? raw[0] : raw) || "").trim().toUpperCase();
    }
    if (jumlahCount) jumlahByPair[pair] = toNumberList((await postAnalyze("jumlah", data, jumlahCount, pair))?.result);
    if (shioCount) shioByPair[pair] = toNumberList((await postAnalyze("shio", data, shioCount, pair))?.result);
  }

  if ((customFocus === "3d" || customFocus === "4d") && s.customAi3dDigit) {
    ai3d = toNumberList((await postAnalyze("ai", data, s.customAi3dDigit, "belakang", "3d"))?.result);
  }
  if ((customFocus === "3d" || customFocus === "4d") && s.customAi3dParity) {
    const raw = (await postAnalyze("ai", data, 7, "belakang", "3d"))?.result;
    ai3dParity = String((Array.isArray(raw) ? raw[0] : raw) || "").trim().toUpperCase();
  }
  if ((customFocus === "3d" || customFocus === "4d") && s.customAi3dSize) {
    const raw = (await postAnalyze("ai", data, 8, "belakang", "3d"))?.result;
    ai3dSize = String((Array.isArray(raw) ? raw[0] : raw) || "").trim().toUpperCase();
  }
  if (customFocus === "4d" && s.customAi4dDigit) {
    ai4d = toNumberList((await postAnalyze("ai", data, s.customAi4dDigit, "belakang", "4d"))?.result);
  }

  if (s.customBBFSDigit) {
    const bbfsScope = customFocusToBBFSScope(customFocus);
    const bbfsTargetPair = bbfsScopeToTargetPair(bbfsScope);
    const bbfsResult = await postAnalyze("bbfs", data, s.customBBFSDigit, bbfsTargetPair, bbfsScope);
    bbfsGlobal = toNumberList(bbfsResult?.result);
    bbfsGgbk = bbfsResult?.bbfsGgbk || null;
  }

  const getMati = async (count: number | null) => {
    if (!count) return null;
    if (!matiCache[count]) matiCache[count] = await postAnalyze("mati", data, count);
    return matiCache[count];
  };

  const matiAs = await getMati(s.customOffAsCount);
  const matiKop = await getMati(s.customOffKopCount);
  const matiKepala = await getMati(s.customOffKepalaCount);
  const matiEkor = await getMati(s.customOffEkorCount);
  const offAs = s.customOffAsCount ? toNumberList(matiAs?.AS?.result) : [];
  const offKop = s.customOffKopCount ? toNumberList(matiKop?.KOP?.result) : [];
  const offKepala = s.customOffKepalaCount ? toNumberList(matiKepala?.KEPALA?.result) : [];
  const offEkor = s.customOffEkorCount ? toNumberList(matiEkor?.EKOR?.result) : [];

  const lines = buildCustomDigitLines({
    focus: customFocus,
    aiByPair,
    aiParityByPair,
    aiSizeByPair,
    ai3d,
    ai3dParity,
    ai3dSize,
    ai4d,
    bbfsGlobal,
    offAs,
    offKop,
    offKepala,
    offEkor,
    jumlahByPair,
    shioByPair,
  });

  return {
    lines,
    focus: customFocus,
    customFocus,
    aiByPair,
    aiParityByPair,
    aiSizeByPair,
    ai3d,
    ai3dParity,
    ai3dSize,
    ai4d,
    bbfsGlobal,
    bbfsGgbk,
    offAs,
    offKop,
    offKepala,
    offEkor,
    jumlahByPair,
    shioByPair,
  };
}
