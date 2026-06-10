import type { CustomFocus } from "@/lib/analysis/customDigit";
import type { BBFSDigit, CustomRekapState } from "./useCustomRekapState";

function readPositiveNumber(searchParams: URLSearchParams, key: string) {
  const value = Number(searchParams.get(key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function buildInvestPreset(searchParams: URLSearchParams, focus: CustomFocus): CustomRekapState {
  const aiDigit = readPositiveNumber(searchParams, "iv_ai");
  const jumlahCount = readPositiveNumber(searchParams, "iv_jml");
  const shioCount = readPositiveNumber(searchParams, "iv_shio");

  return {
    customFocus: focus,
    customAiDigitByPair: aiDigit ? { [focus]: aiDigit as 2 | 4 | 6 } : {},
    customAiParityByPair: searchParams.get("iv_par") === "1" ? { [focus]: true } : {},
    customAiSizeByPair: searchParams.get("iv_size") === "1" ? { [focus]: true } : {},
    customAi3dDigit: null,
    customAi3dParity: false,
    customAi3dSize: false,
    customAi4dDigit: null,
    customBBFSDigit: readPositiveNumber(searchParams, "iv_bbfs") as BBFSDigit | null,
    customOffAsCount: readPositiveNumber(searchParams, "iv_off_as"),
    customOffKopCount: readPositiveNumber(searchParams, "iv_off_kop"),
    customOffKepalaCount: readPositiveNumber(searchParams, "iv_off_kepala"),
    customOffEkorCount: readPositiveNumber(searchParams, "iv_off_ekor"),
    customOffJumlahCountByPair: jumlahCount ? { [focus]: jumlahCount } : {},
    customOffShioCountByPair: shioCount ? { [focus]: shioCount } : {},
  };
}
