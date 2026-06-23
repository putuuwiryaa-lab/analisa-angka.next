import { customFocusPairs, type CustomFocus, type TargetPair } from "@/lib/analysis/customDigit";
import type { BBFSDigit, CustomRekapState } from "./useCustomRekapState";

function readPositiveNumber(searchParams: URLSearchParams, key: string) {
  const value = Number(searchParams.get(key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function pairForInvestPreset(focus: CustomFocus): TargetPair {
  return customFocusPairs(focus)[0] || "belakang";
}

export function buildInvestPreset(searchParams: URLSearchParams, focus: CustomFocus): CustomRekapState {
  const pair = pairForInvestPreset(focus);
  const aiDigit = readPositiveNumber(searchParams, "iv_ai");
  const jumlahCount = readPositiveNumber(searchParams, "iv_jml");
  const shioCount = readPositiveNumber(searchParams, "iv_shio");

  return {
    customFocus: focus,
    customAiDigitByPair: aiDigit ? { [pair]: aiDigit as 2 | 4 | 6 } : {},
    customAiParityByPair: searchParams.get("iv_par") === "1" ? { [pair]: true } : {},
    customAiSizeByPair: searchParams.get("iv_size") === "1" ? { [pair]: true } : {},
    customAi3dDigit: null,
    customAi3dParity: false,
    customAi3dSize: false,
    customAi4dDigit: null,
    customBBFSDigit: readPositiveNumber(searchParams, "iv_bbfs") as BBFSDigit | null,
    customBBFSDigitByPair: {},
    customOffAsCount: readPositiveNumber(searchParams, "iv_off_as"),
    customOffKopCount: readPositiveNumber(searchParams, "iv_off_kop"),
    customOffKepalaCount: readPositiveNumber(searchParams, "iv_off_kepala"),
    customOffEkorCount: readPositiveNumber(searchParams, "iv_off_ekor"),
    customOffJumlahCountByPair: jumlahCount ? { [pair]: jumlahCount } : {},
    customOffShioCountByPair: shioCount ? { [pair]: shioCount } : {},
  };
}
