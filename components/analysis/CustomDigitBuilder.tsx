"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import {
  customFocusPairs,
  customFocusPositionLabels,
  customFocusPositions,
  customFocusToBBFSScope,
  type CustomFocus,
  type PositionKey,
  type TargetPair,
} from "@/lib/analysis/customDigit";
import { loadCustomDigitRecommendations } from "@/lib/analysis/recommendations";
import { Button } from "@/components/ui/Button";
import {
  CustomDigitOptionButton,
  CustomDigitSection,
  SingleColumnOptions,
  ThreeColumnOptions,
} from "./CustomDigitControls";

type PairAiMap = Partial<Record<TargetPair, 2 | 4 | 6 | null>>;
type PairBoolMap = Partial<Record<TargetPair, boolean>>;
type PairCountMap = Partial<Record<TargetPair, number | null>>;
type BBFSDigit = 7 | 8 | 9;
type Ai3DDigit = 1 | 3 | 5;
type Ai4DDigit = 1 | 2 | 4;

const RECOMMENDATION_STALE_TIME = 5 * 60 * 1000;
const RECOMMENDATION_GC_TIME = 30 * 60 * 1000;

const pairLabel: Record<TargetPair, string> = {
  depan: "DEPAN",
  tengah: "TENGAH",
  belakang: "BELAKANG",
};

const pairSubtitle: Record<TargetPair, string> = {
  depan: "AS - KOP",
  tengah: "KOP - KEPALA",
  belakang: "KEPALA - EKOR",
};

export function CustomDigitBuilder({
  show,
  marketId,
  customFocus,
  customAiDigitByPair,
  setCustomAiDigitForPair,
  customAiParityByPair,
  setCustomAiParityForPair,
  customAiSizeByPair,
  setCustomAiSizeForPair,
  customAi3dDigit,
  setCustomAi3dDigit,
  customAi3dParity,
  setCustomAi3dParity,
  customAi3dSize,
  setCustomAi3dSize,
  customAi4dDigit,
  setCustomAi4dDigit,
  customBBFSDigit,
  setCustomBBFSDigit,
  customOffAsCount,
  setCustomOffAsCount,
  customOffKopCount,
  setCustomOffKopCount,
  customOffKepalaCount,
  setCustomOffKepalaCount,
  customOffEkorCount,
  setCustomOffEkorCount,
  customOffJumlahCountByPair,
  setCustomOffJumlahCountForPair,
  customOffShioCountByPair,
  setCustomOffShioCountForPair,
  loading = false,
  onGenerate,
}: {
  show: boolean;
  marketId: string;
  customFocus: CustomFocus;
  customAiDigitByPair: PairAiMap;
  setCustomAiDigitForPair: (pair: TargetPair, value: 2 | 4 | 6 | null) => void;
  customAiParityByPair: PairBoolMap;
  setCustomAiParityForPair: (pair: TargetPair, value: boolean) => void;
  customAiSizeByPair: PairBoolMap;
  setCustomAiSizeForPair: (pair: TargetPair, value: boolean) => void;
  customAi3dDigit: Ai3DDigit | null;
  setCustomAi3dDigit: (value: Ai3DDigit | null) => void;
  customAi3dParity: boolean;
  setCustomAi3dParity: (value: boolean) => void;
  customAi3dSize: boolean;
  setCustomAi3dSize: (value: boolean) => void;
  customAi4dDigit: Ai4DDigit | null;
  setCustomAi4dDigit: (value: Ai4DDigit | null) => void;
  customBBFSDigit: BBFSDigit | null;
  setCustomBBFSDigit: (value: BBFSDigit | null) => void;
  customOffAsCount: number | null;
  setCustomOffAsCount: (value: number | null) => void;
  customOffKopCount: number | null;
  setCustomOffKopCount: (value: number | null) => void;
  customOffKepalaCount: number | null;
  setCustomOffKepalaCount: (value: number | null) => void;
  customOffEkorCount: number | null;
  setCustomOffEkorCount: (value: number | null) => void;
  customOffJumlahCountByPair: PairCountMap;
  setCustomOffJumlahCountForPair: (pair: TargetPair, value: number | null) => void;
  customOffShioCountByPair: PairCountMap;
  setCustomOffShioCountForPair: (pair: TargetPair, value: number | null) => void;
  loading?: boolean;
  onGenerate: () => void;
}) {
  const { data: badges = {} } = useQuery({
    queryKey: ["customDigitRecommendations", marketId, customFocus],
    queryFn: () => loadCustomDigitRecommendations(marketId, customFocus),
    enabled: show && !!marketId,
    staleTime: RECOMMENDATION_STALE_TIME,
    gcTime: RECOMMENDATION_GC_TIME,
    refetchOnWindowFocus: false,
  });

  const visiblePositions = customFocusPositions(customFocus);
  const visiblePairs = customFocusPairs(customFocus);
  const bbfsScope = customFocusToBBFSScope(customFocus);
  const showAi3d = customFocus === "3d" || customFocus === "4d";
  const showAi4d = customFocus === "4d";

  const positionValues: Record<PositionKey, number | null> = {
    as: customOffAsCount,
    kop: customOffKopCount,
    kepala: customOffKepalaCount,
    ekor: customOffEkorCount,
  };
  const positionSetters: Record<PositionKey, (value: number | null) => void> = {
    as: setCustomOffAsCount,
    kop: setCustomOffKopCount,
    kepala: setCustomOffKepalaCount,
    ekor: setCustomOffEkorCount,
  };

  if (!show) return null;

  const optionButton = (
    active: boolean,
    label: string,
    onClick: () => void,
    extraClass = "",
    recommendKey?: string,
  ) => (
    <CustomDigitOptionButton
      active={active}
      label={label}
      onClick={onClick}
      extraClass={extraClass}
      badge={recommendKey ? badges[recommendKey] : undefined}
    />
  );

  return (
    <div className="animate-rise mt-4 space-y-4 rounded-2xl border border-border-soft bg-surface p-4">
      <div className="text-center">
        <div className="display accent-text text-sm">Custom Digit</div>
        <p className="mt-1.5 text-xs font-medium text-text-muted">
          Pilih filter yang mau dipakai, lalu generate.
        </p>
      </div>

      {showAi4d && (
        <CustomDigitSection label="AI 4D · AS - KOP - KEPALA - EKOR">
          <ThreeColumnOptions>
            {[1, 2, 4].map((n) =>
              optionButton(
                customAi4dDigit === n,
                String(n),
                () => setCustomAi4dDigit(customAi4dDigit === n ? null : (n as Ai4DDigit)),
                "",
                `ai4d-${n}`,
              ),
            )}
          </ThreeColumnOptions>
        </CustomDigitSection>
      )}

      {showAi3d && (
        <CustomDigitSection label="AI 3D · KOP - KEPALA - EKOR">
          <ThreeColumnOptions>
            {[1, 3, 5].map((n) =>
              optionButton(
                customAi3dDigit === n,
                String(n),
                () => setCustomAi3dDigit(customAi3dDigit === n ? null : (n as Ai3DDigit)),
                "",
                `ai3d-${n}`,
              ),
            )}
          </ThreeColumnOptions>
          <SingleColumnOptions>
            {optionButton(customAi3dParity, "GENAP GANJIL", () => setCustomAi3dParity(!customAi3dParity), "", "ai3d-7")}
            {optionButton(customAi3dSize, "BESAR KECIL", () => setCustomAi3dSize(!customAi3dSize), "", "ai3d-8")}
          </SingleColumnOptions>
        </CustomDigitSection>
      )}

      {visiblePairs.map((pair) => (
        <CustomDigitSection key={`ai-${pair}`} label={`AI ${pairLabel[pair]} · ${pairSubtitle[pair]}`}>
          <ThreeColumnOptions>
            {[2, 4, 6].map((n) =>
              optionButton(
                customAiDigitByPair[pair] === n,
                String(n),
                () => setCustomAiDigitForPair(pair, customAiDigitByPair[pair] === n ? null : (n as 2 | 4 | 6)),
                "",
                `ai-${pair}-${n}`,
              ),
            )}
          </ThreeColumnOptions>
          <SingleColumnOptions>
            {optionButton(
              Boolean(customAiParityByPair[pair]),
              "GENAP GANJIL",
              () => setCustomAiParityForPair(pair, !customAiParityByPair[pair]),
              "",
              `ai-${pair}-7`,
            )}
            {optionButton(
              Boolean(customAiSizeByPair[pair]),
              "BESAR KECIL",
              () => setCustomAiSizeForPair(pair, !customAiSizeByPair[pair]),
              "",
              `ai-${pair}-8`,
            )}
          </SingleColumnOptions>
        </CustomDigitSection>
      ))}

      <CustomDigitSection label={`BBFS ${bbfsScope.toUpperCase().replaceAll("_", " ")}`}>
        <ThreeColumnOptions>
          {[7, 8, 9].map((n) =>
            optionButton(
              customBBFSDigit === n,
              String(n),
              () => setCustomBBFSDigit(customBBFSDigit === n ? null : (n as BBFSDigit)),
              "",
              `bbfs-${n}`,
            ),
          )}
        </ThreeColumnOptions>
      </CustomDigitSection>

      {visiblePositions.map((position) => (
        <CustomDigitSection key={position} label={`Angka Mati ${customFocusPositionLabels[position]}`}>
          <ThreeColumnOptions>
            {[1, 2, 3].map((n) =>
              optionButton(
                positionValues[position] === n,
                String(n),
                () => positionSetters[position](positionValues[position] === n ? null : n),
                "",
                `${position}-${n}`,
              ),
            )}
          </ThreeColumnOptions>
        </CustomDigitSection>
      ))}

      {visiblePairs.map((pair) => (
        <CustomDigitSection key={`jumlah-${pair}`} label={`Jumlah Mati ${pairLabel[pair]} · ${pairSubtitle[pair]}`}>
          <ThreeColumnOptions>
            {[1, 2, 3].map((n) =>
              optionButton(
                customOffJumlahCountByPair[pair] === n,
                String(n),
                () => setCustomOffJumlahCountForPair(pair, customOffJumlahCountByPair[pair] === n ? null : n),
                "",
                `jumlah-${pair}-${n}`,
              ),
            )}
          </ThreeColumnOptions>
        </CustomDigitSection>
      ))}

      {visiblePairs.map((pair) => (
        <CustomDigitSection key={`shio-${pair}`} label={`Shio Mati ${pairLabel[pair]} · ${pairSubtitle[pair]}`}>
          <ThreeColumnOptions>
            {[1, 2, 3].map((n) =>
              optionButton(
                customOffShioCountByPair[pair] === n,
                String(n),
                () => setCustomOffShioCountForPair(pair, customOffShioCountByPair[pair] === n ? null : n),
                "",
                `shio-${pair}-${n}`,
              ),
            )}
          </ThreeColumnOptions>
        </CustomDigitSection>
      ))}

      <Button size="lg" className="w-full" onClick={onGenerate} disabled={loading}>
        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        {loading ? "Memproses..." : "Generate"}
      </Button>
    </div>
  );
}
