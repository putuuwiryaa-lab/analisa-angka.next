import { useState } from "react";
import type { CustomFocus, TargetPair } from "@/lib/analysis/customDigit";
import type { PairAiMap, PairBoolMap, PairCountMap } from "./customDigitGenerate";

export type BBFSDigit = 7 | 8 | 9;

export type CustomRekapState = {
  customFocus: CustomFocus | null;
  customAiDigitByPair: PairAiMap;
  customAiParityByPair: PairBoolMap;
  customAiSizeByPair: PairBoolMap;
  customAi3dDigit: 1 | 3 | 5 | null;
  customAi3dParity: boolean;
  customAi3dSize: boolean;
  customAi4dDigit: 1 | 2 | 4 | null;
  customBBFSDigit: BBFSDigit | null;
  customOffAsCount: number | null;
  customOffKopCount: number | null;
  customOffKepalaCount: number | null;
  customOffEkorCount: number | null;
  customOffJumlahCountByPair: PairCountMap;
  customOffShioCountByPair: PairCountMap;
};

export function useCustomRekapState(initialCustomFocus: CustomFocus | null) {
  const [customFocus, setCustomFocus] = useState<CustomFocus | null>(initialCustomFocus);
  const [customAiDigitByPair, setCustomAiDigitByPair] = useState<PairAiMap>({});
  const [customAiParityByPair, setCustomAiParityByPair] = useState<PairBoolMap>({});
  const [customAiSizeByPair, setCustomAiSizeByPair] = useState<PairBoolMap>({});
  const [customAi3dDigit, setCustomAi3dDigit] = useState<1 | 3 | 5 | null>(null);
  const [customAi3dParity, setCustomAi3dParity] = useState(false);
  const [customAi3dSize, setCustomAi3dSize] = useState(false);
  const [customAi4dDigit, setCustomAi4dDigit] = useState<1 | 2 | 4 | null>(null);
  const [customBBFSDigit, setCustomBBFSDigit] = useState<BBFSDigit | null>(null);
  const [customOffAsCount, setCustomOffAsCount] = useState<number | null>(null);
  const [customOffKopCount, setCustomOffKopCount] = useState<number | null>(null);
  const [customOffKepalaCount, setCustomOffKepalaCount] = useState<number | null>(null);
  const [customOffEkorCount, setCustomOffEkorCount] = useState<number | null>(null);
  const [customOffJumlahCountByPair, setCustomOffJumlahCountByPair] = useState<PairCountMap>({});
  const [customOffShioCountByPair, setCustomOffShioCountByPair] = useState<PairCountMap>({});

  const setCustomAiDigitForPair = (pair: TargetPair, value: 2 | 4 | 6 | null) =>
    setCustomAiDigitByPair((prev) => ({ ...prev, [pair]: value }));
  const setCustomAiParityForPair = (pair: TargetPair, value: boolean) =>
    setCustomAiParityByPair((prev) => ({ ...prev, [pair]: value }));
  const setCustomAiSizeForPair = (pair: TargetPair, value: boolean) =>
    setCustomAiSizeByPair((prev) => ({ ...prev, [pair]: value }));
  const setCustomOffJumlahCountForPair = (pair: TargetPair, value: number | null) =>
    setCustomOffJumlahCountByPair((prev) => ({ ...prev, [pair]: value }));
  const setCustomOffShioCountForPair = (pair: TargetPair, value: number | null) =>
    setCustomOffShioCountByPair((prev) => ({ ...prev, [pair]: value }));

  const resetCustomRekapSelections = () => {
    setCustomAi3dDigit(null);
    setCustomAi3dParity(false);
    setCustomAi3dSize(false);
    setCustomAi4dDigit(null);
    setCustomBBFSDigit(null);
  };

  const state: CustomRekapState = {
    customFocus,
    customAiDigitByPair,
    customAiParityByPair,
    customAiSizeByPair,
    customAi3dDigit,
    customAi3dParity,
    customAi3dSize,
    customAi4dDigit,
    customBBFSDigit,
    customOffAsCount,
    customOffKopCount,
    customOffKepalaCount,
    customOffEkorCount,
    customOffJumlahCountByPair,
    customOffShioCountByPair,
  };

  return {
    state,
    setters: {
      setCustomFocus,
      setCustomAiDigitByPair,
      setCustomAiParityByPair,
      setCustomAiSizeByPair,
      setCustomAi3dDigit,
      setCustomAi3dParity,
      setCustomAi3dSize,
      setCustomAi4dDigit,
      setCustomBBFSDigit,
      setCustomOffAsCount,
      setCustomOffKopCount,
      setCustomOffKepalaCount,
      setCustomOffEkorCount,
      setCustomOffJumlahCountByPair,
      setCustomOffShioCountByPair,
    },
    handlers: {
      setCustomAiDigitForPair,
      setCustomAiParityForPair,
      setCustomAiSizeForPair,
      setCustomOffJumlahCountForPair,
      setCustomOffShioCountForPair,
      resetCustomRekapSelections,
    },
  };
}
