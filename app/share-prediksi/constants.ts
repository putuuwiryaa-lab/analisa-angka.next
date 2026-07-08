import type { PickItem, ShareOption } from "./types";

export const SEPARATOR = "⟢";
export const SEPARATOR_OPTIONS: PickItem[] = [
  { key: "⟢", label: "⟢" },
  { key: "-", label: "-" },
  { key: "→", label: "→" },
  { key: ":", label: ":" },
  { key: "|", label: "|" },
  { key: "•", label: "•" },
];
export const REKAP_BADGE_MODE = "rekap_badge";
export const REKAP_MAX_MARKETS = 5;

export const REKAP_BADGE_OPTION: ShareOption = {
  key: "rekap_badge|0|belakang|all2d",
  mode: REKAP_BADGE_MODE,
  param: 0,
  targetPair: "belakang",
  analysisScope: "all2d",
  updatedAt: null,
};

export const MODE_LABEL: Record<string, string> = {
  rekap_badge: "Rekap Badge 2D",
  ai: "Angka Ikut",
  bbfs: "BBFS",
  mati: "Angka Mati",
  jumlah: "Jumlah Mati",
  shio: "Shio Mati",
};

export const TARGET_LABEL: Record<string, string> = {
  default: "",
  all2d: "Semua 2D",
  "2d_depan": "2D Depan",
  "2d_tengah": "2D Tengah",
  "2d_belakang": "2D Belakang",
  "3d": "3D",
  "4d": "4D",
};

export const TARGET_PAIR_LABEL: Record<string, string> = {
  depan: "2D Depan",
  tengah: "2D Tengah",
  belakang: "2D Belakang",
};

export const MODE_ORDER: Record<string, number> = {
  rekap_badge: 0,
  ai: 1,
  bbfs: 2,
  mati: 3,
  jumlah: 4,
  shio: 5,
};

export const TARGET_ORDER: Record<string, number> = {
  "belakang|all2d": 0,
  "depan|default": 1,
  "tengah|default": 2,
  "belakang|default": 3,
  "belakang|2d_depan": 4,
  "belakang|2d_tengah": 5,
  "belakang|2d_belakang": 6,
  "belakang|3d": 7,
  "belakang|4d": 8,
};

export const MATI_POSITIONS = [
  ["AS", "AS"],
  ["KOP", "COP"],
  ["KEPALA", "KPL"],
  ["EKOR", "EKR"],
] as const;
