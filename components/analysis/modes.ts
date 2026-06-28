import { Activity, Grid3X3, ShieldAlert, Hash, Gauge, Trophy, type LucideIcon } from "lucide-react";

export type ModeKey = "ai" | "bbfs" | "mati" | "jumlah" | "shio" | "rekap" | "bbfs7_trial" | "bbfs7_tradisional";

/**
 * Hanya icon + lucide + judul chrome yang disimpan di sini (data unik).
 * WARNA mode TIDAK di sini — datang dari token CSS via atribut data-mode.
 * Catatan: judul rekap = "CUSTOM REKAP" (beda dari typeMeta "MENU REKAP"),
 * jadi sengaja tidak di-merge dengan typeMeta.
 */
export const MODES: Record<ModeKey, { title: string; emoji: string; Icon: LucideIcon }> = {
  ai: { title: "ANGKA IKUT", emoji: "✦", Icon: Activity },
  bbfs: { title: "BBFS", emoji: "▦", Icon: Grid3X3 },
  mati: { title: "ANGKA MATI", emoji: "×", Icon: ShieldAlert },
  jumlah: { title: "JUMLAH MATI", emoji: "#", Icon: Hash },
  shio: { title: "SHIO MATI", emoji: "◎", Icon: Gauge },
  rekap: { title: "CUSTOM REKAP", emoji: "◆", Icon: Trophy },
  bbfs7_trial: { title: "BBFS 7D", emoji: "▧", Icon: Grid3X3 },
  bbfs7_tradisional: { title: "UJI COBA BBFS 7D RUMUS TRADISIONAL", emoji: "▧", Icon: Grid3X3 },
};

export const MODE_KEYS: ModeKey[] = ["ai", "bbfs", "mati", "jumlah", "shio", "rekap", "bbfs7_trial", "bbfs7_tradisional"];

// Pengelompokan menu (label menu dipertahankan apa adanya).
export const ANALYSIS_MENU: Array<{ label: string; mode: ModeKey }> = [
  { label: "ANGKA IKUT", mode: "ai" },
  { label: "ANGKA MATI", mode: "mati" },
  { label: "BBFS", mode: "bbfs" },
  { label: "BBFS 7D TRADISIONAL", mode: "bbfs7_tradisional" },
  { label: "JUMLAH MATI", mode: "jumlah" },
  { label: "SHIO MATI", mode: "shio" },
];

export const CUSTOM_MENU: Array<{ label: string; mode: ModeKey }> = [
  { label: "CUSTOM REKAP", mode: "rekap" },
];

export function isModeKey(value: string): value is ModeKey {
  return (MODE_KEYS as string[]).includes(value);
}
