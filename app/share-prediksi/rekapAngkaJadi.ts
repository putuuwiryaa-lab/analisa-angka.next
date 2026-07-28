import type { PositionKey, TargetPair } from "@/lib/analysis/customDigit";
import type { ShareOption, ShareRow } from "./types";
import { marketLabel } from "./utils";

export type RekapAngkaJadiCount = 1 | 2 | 3;
export type RekapAngkaJadiAiDigit = 2 | 4 | 6;
export type RekapAngkaJadiBbfsDigit = 7 | 8 | 9 | 10;

export type RekapAngkaJadiConfig = {
  aiDigit: RekapAngkaJadiAiDigit | null;
  parity: boolean;
  size: boolean;
  bbfsDigit: RekapAngkaJadiBbfsDigit | null;
  offPositions: Partial<Record<PositionKey, RekapAngkaJadiCount>>;
  offJumlah: RekapAngkaJadiCount | null;
  offShio: RekapAngkaJadiCount | null;
};

export type RekapAngkaJadiRow = ShareRow & {
  baseResult: string;
  lineCount: number;
  lines: string[];
};

export type RekapAngkaJadiFailure = {
  marketId: string;
  marketName: string;
  reason: string;
};

export type RekapAngkaJadiResponse = {
  success: boolean;
  focus: TargetPair;
  rows: RekapAngkaJadiRow[];
  failed: RekapAngkaJadiFailure[];
  error?: string;
};

export const REKAP_ANGKA_JADI_MAX_MARKETS = 100;

export const REKAP_ANGKA_JADI_FOCUS_OPTIONS: Array<{
  key: TargetPair;
  label: string;
  subtitle: string;
}> = [
  { key: "depan", label: "2D Depan", subtitle: "AS - KOP" },
  { key: "tengah", label: "2D Tengah", subtitle: "KOP - KEPALA" },
  { key: "belakang", label: "2D Belakang", subtitle: "KEPALA - EKOR" },
];

export const POSITION_LABELS: Record<PositionKey, string> = {
  as: "AS",
  kop: "KOP",
  kepala: "KPL",
  ekor: "EKR",
};

export function emptyRekapAngkaJadiConfig(): RekapAngkaJadiConfig {
  return {
    aiDigit: null,
    parity: false,
    size: false,
    bbfsDigit: null,
    offPositions: {},
    offJumlah: null,
    offShio: null,
  };
}

export function focusPositions(focus: TargetPair): [PositionKey, PositionKey] {
  if (focus === "depan") return ["as", "kop"];
  if (focus === "tengah") return ["kop", "kepala"];
  return ["kepala", "ekor"];
}

export function focusLabel(focus: TargetPair) {
  return REKAP_ANGKA_JADI_FOCUS_OPTIONS.find((item) => item.key === focus)?.label || "2D Belakang";
}

export function rekapAngkaJadiMethodCount(config: RekapAngkaJadiConfig) {
  return Number(Boolean(config.aiDigit))
    + Number(config.parity)
    + Number(config.size)
    + Number(Boolean(config.bbfsDigit))
    + Object.keys(config.offPositions).length
    + Number(Boolean(config.offJumlah))
    + Number(Boolean(config.offShio));
}

function optionMatches(
  option: ShareOption,
  mode: string,
  param: number,
  targetPair: string,
  analysisScope: string,
) {
  return option.mode === mode
    && option.param === param
    && option.targetPair === targetPair
    && option.analysisScope === analysisScope;
}

export function hasAiDigitOption(options: ShareOption[], focus: TargetPair, param: RekapAngkaJadiAiDigit) {
  return options.some((option) => optionMatches(option, "ai", param, focus, "default"));
}

export function hasParityOption(options: ShareOption[], focus: TargetPair) {
  return options.some((option) => (
    optionMatches(option, "ai_parity", 1, focus, "default")
    || optionMatches(option, "ai", 7, focus, "default")
  ));
}

export function hasSizeOption(options: ShareOption[], focus: TargetPair) {
  return options.some((option) => (
    optionMatches(option, "ai_size", 1, focus, "default")
    || optionMatches(option, "ai", 8, focus, "default")
  ));
}

export function hasBbfsOption(options: ShareOption[], focus: TargetPair, param: RekapAngkaJadiBbfsDigit) {
  return options.some((option) => optionMatches(option, "bbfs", param, focus, `2d_${focus}`));
}

export function hasMatiOption(options: ShareOption[], param: RekapAngkaJadiCount) {
  return options.some((option) => optionMatches(option, "mati", param, "belakang", "default"));
}

export function hasJumlahOption(options: ShareOption[], focus: TargetPair, param: RekapAngkaJadiCount) {
  return options.some((option) => optionMatches(option, "jumlah", param, focus, "default"));
}

export function hasShioOption(options: ShareOption[], focus: TargetPair, param: RekapAngkaJadiCount) {
  return options.some((option) => optionMatches(option, "shio", param, focus, "default"));
}

function buildBlock(row: RekapAngkaJadiRow) {
  if (!row.lines?.length) return "";
  return [`*${marketLabel(row)}* - ${row.lineCount} line`, row.lines.join("*")].join("\n");
}

export function buildRekapAngkaJadiShareText(rows: RekapAngkaJadiRow[]) {
  return rows.map(buildBlock).filter(Boolean).join("\n\n");
}

export function buildRekapAngkaJadiPreviewText(rows: RekapAngkaJadiRow[]) {
  return buildRekapAngkaJadiShareText(rows);
}
