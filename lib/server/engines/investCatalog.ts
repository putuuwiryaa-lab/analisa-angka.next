import "server-only";
import { jumlah2D, shioOf2D } from "@/lib/analysis/constants";

/**
 * BUKU CATATAN INVEST — katalog kombinasi analisa yang menghasilkan ~55-65 line 2D.
 *
 * Dibangun dari studi simulasi atas blok bangunan:
 *   AI {4,6} · Ganjil/Genap · Besar/Kecil · Mati Kepala/Ekor {1,2}
 *   · BBFS {8,9} · Shio Mati {1,2,3} · Jumlah Mati {1,2,3}
 * Cakupan: 1-4 blok, andal >=70% jatuh di 55-65 (Opsi B / cakupan maksimal).
 *
 * Engine, per pasaran:
 *   1. isi InvestBundle dari hasil analisa nyata
 *   2. applyInvestCombo -> hitung line AKTUAL hari itu
 *   3. saring yang masuk rentang (boleh sedikit longgar, lihat INVEST_TARGET_*)
 *   4. urutkan sisanya pakai win-rate evaluasi (>=13/15) -> rekomendasi
 *
 * expectedLines = rata-rata simulasi; stability = sd (kecil = makin pasti);
 * hitRate = % simulasi yang jatuh 55-65.
 */

// Target ideal + toleransi (meleset sedikit boleh -> dipakai engine saat menyaring).
export const INVEST_TARGET_MIN = 55;
export const INVEST_TARGET_MAX = 65;
export const INVEST_SOFT_MIN = 53;
export const INVEST_SOFT_MAX = 67;

export type InvestFilterKind =
  | "ai"
  | "parity"
  | "size"
  | "bbfs"
  | "off_kepala"
  | "off_ekor"
  | "off_shio"
  | "off_jumlah";

export interface InvestFilter {
  kind: InvestFilterKind;
  /** ai/bbfs = ukuran himpunan; off_* = jumlah angka mati; parity/size = 1 */
  param: number;
}

export interface InvestCombo {
  id: string;
  label: string;
  expectedLines: number;
  stability: number;
  hitRate: number;
  filters: InvestFilter[];
}

/** Output analisa nyata per pasaran. Diisi engine dari runAnalysis. */
export interface InvestBundle {
  ai: Record<number, number[]>;        // angka ikut per param, mis. {4:[...],6:[...]}
  parity?: "GANJIL" | "GENAP";         // dominan ganjil-genap (ai_parity)
  size?: "BESAR" | "KECIL";            // dominan besar-kecil (ai_size)
  bbfs: Record<number, number[]>;      // bbfs per param {8:[...],9:[...]}
  offKepala: Record<number, number[]>; // angka mati kepala {1:[...],2:[...]}
  offEkor: Record<number, number[]>;   // angka mati ekor
  offShio: Record<number, number[]>;   // shio mati {1,2,3} (nilai 1-12)
  offJumlah: Record<number, number[]>; // jumlah mati {1,2,3} (nilai 0-9)
}

export const INVEST_CATALOG: InvestCombo[] = [
  { id: "off_kepala2-off_ekor2", label: "Mati Kepala 2 + Mati Ekor 2", expectedLines: 64, stability: 0.0, hitRate: 100, filters: [{ kind: "off_kepala", param: 2 }, { kind: "off_ekor", param: 2 }] },
  { id: "ai4", label: "AI 4 Digit", expectedLines: 64, stability: 0.0, hitRate: 100, filters: [{ kind: "ai", param: 4 }] },
  { id: "size1-off_kepala1-off_ekor1", label: "Besar/Kecil + Mati Kepala 1 + Mati Ekor 1", expectedLines: 60.7, stability: 3.15, hitRate: 100, filters: [{ kind: "size", param: 1 }, { kind: "off_kepala", param: 1 }, { kind: "off_ekor", param: 1 }] },
  { id: "parity1-off_kepala1-off_ekor1", label: "Ganjil/Genap + Mati Kepala 1 + Mati Ekor 1", expectedLines: 60.8, stability: 3.19, hitRate: 100, filters: [{ kind: "parity", param: 1 }, { kind: "off_kepala", param: 1 }, { kind: "off_ekor", param: 1 }] },
  { id: "size1-off_ekor2", label: "Besar/Kecil + Mati Ekor 2", expectedLines: 60.0, stability: 3.32, hitRate: 100, filters: [{ kind: "size", param: 1 }, { kind: "off_ekor", param: 2 }] },
  { id: "parity1-off_kepala2", label: "Ganjil/Genap + Mati Kepala 2", expectedLines: 60.1, stability: 3.32, hitRate: 100, filters: [{ kind: "parity", param: 1 }, { kind: "off_kepala", param: 2 }] },
  { id: "size1-off_kepala2", label: "Besar/Kecil + Mati Kepala 2", expectedLines: 60.0, stability: 3.35, hitRate: 100, filters: [{ kind: "size", param: 1 }, { kind: "off_kepala", param: 2 }] },
  { id: "parity1-off_ekor2", label: "Ganjil/Genap + Mati Ekor 2", expectedLines: 60.0, stability: 3.39, hitRate: 100, filters: [{ kind: "parity", param: 1 }, { kind: "off_ekor", param: 2 }] },
  { id: "ai6-off_kepala1-off_ekor2", label: "AI 6 Digit + Mati Kepala 1 + Mati Ekor 2", expectedLines: 60.5, stability: 2.86, hitRate: 94, filters: [{ kind: "ai", param: 6 }, { kind: "off_kepala", param: 1 }, { kind: "off_ekor", param: 2 }] },
  { id: "ai6-off_kepala2-off_ekor1", label: "AI 6 Digit + Mati Kepala 2 + Mati Ekor 1", expectedLines: 60.4, stability: 2.89, hitRate: 94, filters: [{ kind: "ai", param: 6 }, { kind: "off_kepala", param: 2 }, { kind: "off_ekor", param: 1 }] },
  { id: "ai6-size1", label: "AI 6 Digit + Besar/Kecil", expectedLines: 63.6, stability: 3.34, hitRate: 74, filters: [{ kind: "ai", param: 6 }, { kind: "size", param: 1 }] },
  { id: "ai6-parity1", label: "AI 6 Digit + Ganjil/Genap", expectedLines: 63.7, stability: 3.41, hitRate: 74, filters: [{ kind: "ai", param: 6 }, { kind: "parity", param: 1 }] },
  { id: "ai6-size1-off_kepala1", label: "AI 6 Digit + Besar/Kecil + Mati Kepala 1", expectedLines: 57.4, stability: 3.91, hitRate: 71, filters: [{ kind: "ai", param: 6 }, { kind: "size", param: 1 }, { kind: "off_kepala", param: 1 }] },
  { id: "ai6-size1-off_ekor1", label: "AI 6 Digit + Besar/Kecil + Mati Ekor 1", expectedLines: 57.3, stability: 3.94, hitRate: 71, filters: [{ kind: "ai", param: 6 }, { kind: "size", param: 1 }, { kind: "off_ekor", param: 1 }] },
  { id: "bbfs8", label: "BBFS 8", expectedLines: 64, stability: 0.0, hitRate: 100, filters: [{ kind: "bbfs", param: 8 }] },
  { id: "off_kepala2-off_shio3", label: "Mati Kepala 2 + Shio Mati 3", expectedLines: 60.0, stability: 1.01, hitRate: 100, filters: [{ kind: "off_kepala", param: 2 }, { kind: "off_shio", param: 3 }] },
  { id: "size1-off_shio2", label: "Besar/Kecil + Shio Mati 2", expectedLines: 62.5, stability: 1.14, hitRate: 100, filters: [{ kind: "size", param: 1 }, { kind: "off_shio", param: 2 }] },
  { id: "bbfs8-off_shio1", label: "BBFS 8 + Shio Mati 1", expectedLines: 58.7, stability: 1.17, hitRate: 100, filters: [{ kind: "bbfs", param: 8 }, { kind: "off_shio", param: 1 }] },
  { id: "off_kepala2-off_ekor2-off_shio1", label: "Mati Kepala 2 + Mati Ekor 2 + Shio Mati 1", expectedLines: 58.6, stability: 1.18, hitRate: 100, filters: [{ kind: "off_kepala", param: 2 }, { kind: "off_ekor", param: 2 }, { kind: "off_shio", param: 1 }] },
  { id: "ai4-off_shio1", label: "AI 4 Digit + Shio Mati 1", expectedLines: 58.7, stability: 1.26, hitRate: 100, filters: [{ kind: "ai", param: 4 }, { kind: "off_shio", param: 1 }] },
  { id: "off_kepala2-off_ekor1-off_shio2", label: "Mati Kepala 2 + Mati Ekor 1 + Shio Mati 2", expectedLines: 60.0, stability: 1.34, hitRate: 100, filters: [{ kind: "off_kepala", param: 2 }, { kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 2 }] },
  { id: "off_kepala1-off_ekor1-off_shio3", label: "Mati Kepala 1 + Mati Ekor 1 + Shio Mati 3", expectedLines: 60.7, stability: 1.54, hitRate: 100, filters: [{ kind: "off_kepala", param: 1 }, { kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 3 }] },
  { id: "bbfs9-off_shio3", label: "BBFS 9 + Shio Mati 3", expectedLines: 60.8, stability: 1.56, hitRate: 100, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_shio", param: 3 }] },
  { id: "off_kepala1-off_ekor2-off_shio2", label: "Mati Kepala 1 + Mati Ekor 2 + Shio Mati 2", expectedLines: 60.0, stability: 1.64, hitRate: 100, filters: [{ kind: "off_kepala", param: 1 }, { kind: "off_ekor", param: 2 }, { kind: "off_shio", param: 2 }] },
  { id: "off_kepala2-off_ekor2-off_jumlah1", label: "Mati Kepala 2 + Mati Ekor 2 + Jumlah Mati 1", expectedLines: 57.6, stability: 2.06, hitRate: 100, filters: [{ kind: "off_kepala", param: 2 }, { kind: "off_ekor", param: 2 }, { kind: "off_jumlah", param: 1 }] },
  { id: "bbfs8-off_jumlah1", label: "BBFS 8 + Jumlah Mati 1", expectedLines: 57.6, stability: 2.06, hitRate: 100, filters: [{ kind: "bbfs", param: 8 }, { kind: "off_jumlah", param: 1 }] },
  { id: "bbfs8-off_ekor1", label: "BBFS 8 + Mati Ekor 1", expectedLines: 57.5, stability: 3.11, hitRate: 100, filters: [{ kind: "bbfs", param: 8 }, { kind: "off_ekor", param: 1 }] },
  { id: "bbfs8-off_kepala1", label: "BBFS 8 + Mati Kepala 1", expectedLines: 57.6, stability: 3.17, hitRate: 100, filters: [{ kind: "bbfs", param: 8 }, { kind: "off_kepala", param: 1 }] },
  { id: "size1-bbfs9", label: "Besar/Kecil + BBFS 9", expectedLines: 60.4, stability: 4.5, hitRate: 100, filters: [{ kind: "size", param: 1 }, { kind: "bbfs", param: 9 }] },
  { id: "parity1-bbfs9", label: "Ganjil/Genap + BBFS 9", expectedLines: 60.5, stability: 4.5, hitRate: 100, filters: [{ kind: "parity", param: 1 }, { kind: "bbfs", param: 9 }] },
  { id: "off_kepala2-off_ekor1-off_jumlah2", label: "Mati Kepala 2 + Mati Ekor 1 + Jumlah Mati 2", expectedLines: 57.6, stability: 2.95, hitRate: 99, filters: [{ kind: "off_kepala", param: 2 }, { kind: "off_ekor", param: 1 }, { kind: "off_jumlah", param: 2 }] },
  { id: "off_kepala1-off_ekor2-off_jumlah2", label: "Mati Kepala 1 + Mati Ekor 2 + Jumlah Mati 2", expectedLines: 57.7, stability: 3.01, hitRate: 99, filters: [{ kind: "off_kepala", param: 1 }, { kind: "off_ekor", param: 2 }, { kind: "off_jumlah", param: 2 }] },
  { id: "off_ekor2-off_shio3", label: "Mati Ekor 2 + Shio Mati 3", expectedLines: 60.0, stability: 1.99, hitRate: 98, filters: [{ kind: "off_ekor", param: 2 }, { kind: "off_shio", param: 3 }] },
  { id: "size1-off_kepala1-off_shio1", label: "Besar/Kecil + Mati Kepala 1 + Shio Mati 1", expectedLines: 61.9, stability: 2.43, hitRate: 98, filters: [{ kind: "size", param: 1 }, { kind: "off_kepala", param: 1 }, { kind: "off_shio", param: 1 }] },
  { id: "bbfs9-off_kepala1-off_ekor2", label: "BBFS 9 + Mati Kepala 1 + Mati Ekor 2", expectedLines: 58.3, stability: 3.91, hitRate: 98, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_kepala", param: 1 }, { kind: "off_ekor", param: 2 }] },
  { id: "bbfs9-off_kepala2-off_ekor1", label: "BBFS 9 + Mati Kepala 2 + Mati Ekor 1", expectedLines: 58.4, stability: 3.94, hitRate: 98, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_kepala", param: 2 }, { kind: "off_ekor", param: 1 }] },
  { id: "ai4-off_jumlah1", label: "AI 4 Digit + Jumlah Mati 1", expectedLines: 57.7, stability: 2.43, hitRate: 97, filters: [{ kind: "ai", param: 4 }, { kind: "off_jumlah", param: 1 }] },
  { id: "bbfs9-off_ekor1-off_jumlah2", label: "BBFS 9 + Mati Ekor 1 + Jumlah Mati 2", expectedLines: 58.2, stability: 3.63, hitRate: 97, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_ekor", param: 1 }, { kind: "off_jumlah", param: 2 }] },
  { id: "bbfs9-off_kepala1-off_jumlah2", label: "BBFS 9 + Mati Kepala 1 + Jumlah Mati 2", expectedLines: 58.3, stability: 3.67, hitRate: 97, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_kepala", param: 1 }, { kind: "off_jumlah", param: 2 }] },
  { id: "bbfs9-off_kepala2-off_jumlah1", label: "BBFS 9 + Mati Kepala 2 + Jumlah Mati 1", expectedLines: 58.3, stability: 3.81, hitRate: 97, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_kepala", param: 2 }, { kind: "off_jumlah", param: 1 }] },
  { id: "bbfs9-off_ekor2-off_jumlah1", label: "BBFS 9 + Mati Ekor 2 + Jumlah Mati 1", expectedLines: 58.3, stability: 3.83, hitRate: 97, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_ekor", param: 2 }, { kind: "off_jumlah", param: 1 }] },
  { id: "off_kepala2-off_ekor1-off_shio1-off_jumlah1", label: "Mati Kepala 2 + Mati Ekor 1 + Shio Mati 1 + Jumlah Mati 1", expectedLines: 59.4, stability: 2.43, hitRate: 96, filters: [{ kind: "off_kepala", param: 2 }, { kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "size1-off_ekor1-off_shio1", label: "Besar/Kecil + Mati Ekor 1 + Shio Mati 1", expectedLines: 61.9, stability: 2.5, hitRate: 96, filters: [{ kind: "size", param: 1 }, { kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 1 }] },
  { id: "parity1-off_kepala1-off_jumlah1", label: "Ganjil/Genap + Mati Kepala 1 + Jumlah Mati 1", expectedLines: 60.7, stability: 3.11, hitRate: 96, filters: [{ kind: "parity", param: 1 }, { kind: "off_kepala", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "bbfs9-off_kepala1-off_ekor1-off_jumlah1", label: "BBFS 9 + Mati Kepala 1 + Mati Ekor 1 + Jumlah Mati 1", expectedLines: 59.0, stability: 3.74, hitRate: 96, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_kepala", param: 1 }, { kind: "off_ekor", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "off_kepala1-off_ekor2-off_shio1-off_jumlah1", label: "Mati Kepala 1 + Mati Ekor 2 + Shio Mati 1 + Jumlah Mati 1", expectedLines: 59.4, stability: 2.55, hitRate: 95, filters: [{ kind: "off_kepala", param: 1 }, { kind: "off_ekor", param: 2 }, { kind: "off_shio", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "parity1-off_ekor1-off_jumlah1", label: "Ganjil/Genap + Mati Ekor 1 + Jumlah Mati 1", expectedLines: 60.7, stability: 3.18, hitRate: 95, filters: [{ kind: "parity", param: 1 }, { kind: "off_ekor", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "size1-off_ekor1-off_jumlah1", label: "Besar/Kecil + Mati Ekor 1 + Jumlah Mati 1", expectedLines: 60.8, stability: 3.44, hitRate: 95, filters: [{ kind: "size", param: 1 }, { kind: "off_ekor", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "size1-off_kepala1-off_jumlah1", label: "Besar/Kecil + Mati Kepala 1 + Jumlah Mati 1", expectedLines: 60.7, stability: 3.44, hitRate: 95, filters: [{ kind: "size", param: 1 }, { kind: "off_kepala", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "ai6-off_shio3", label: "AI 6 Digit + Shio Mati 3", expectedLines: 63.0, stability: 1.63, hitRate: 94, filters: [{ kind: "ai", param: 6 }, { kind: "off_shio", param: 3 }] },
  { id: "off_kepala2-off_shio1-off_jumlah2", label: "Mati Kepala 2 + Shio Mati 1 + Jumlah Mati 2", expectedLines: 58.7, stability: 3.31, hitRate: 94, filters: [{ kind: "off_kepala", param: 2 }, { kind: "off_shio", param: 1 }, { kind: "off_jumlah", param: 2 }] },
  { id: "off_kepala2-off_shio2-off_jumlah1", label: "Mati Kepala 2 + Shio Mati 2 + Jumlah Mati 1", expectedLines: 60.0, stability: 2.58, hitRate: 93, filters: [{ kind: "off_kepala", param: 2 }, { kind: "off_shio", param: 2 }, { kind: "off_jumlah", param: 1 }] },
  { id: "ai6-off_kepala1-off_ekor1-off_jumlah1", label: "AI 6 Digit + Mati Kepala 1 + Mati Ekor 1 + Jumlah Mati 1", expectedLines: 61.3, stability: 3.23, hitRate: 93, filters: [{ kind: "ai", param: 6 }, { kind: "off_kepala", param: 1 }, { kind: "off_ekor", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "ai6-off_ekor2-off_jumlah1", label: "AI 6 Digit + Mati Ekor 2 + Jumlah Mati 1", expectedLines: 60.4, stability: 3.26, hitRate: 93, filters: [{ kind: "ai", param: 6 }, { kind: "off_ekor", param: 2 }, { kind: "off_jumlah", param: 1 }] },
  { id: "ai6-off_kepala2-off_jumlah1", label: "AI 6 Digit + Mati Kepala 2 + Jumlah Mati 1", expectedLines: 60.4, stability: 3.28, hitRate: 93, filters: [{ kind: "ai", param: 6 }, { kind: "off_kepala", param: 2 }, { kind: "off_jumlah", param: 1 }] },
  { id: "ai6-bbfs9-off_jumlah1", label: "AI 6 Digit + BBFS 9 + Jumlah Mati 1", expectedLines: 61.1, stability: 4.0, hitRate: 92, filters: [{ kind: "ai", param: 6 }, { kind: "bbfs", param: 9 }, { kind: "off_jumlah", param: 1 }] },
  { id: "ai6-off_ekor2-off_shio1", label: "AI 6 Digit + Mati Ekor 2 + Shio Mati 1", expectedLines: 61.6, stability: 2.75, hitRate: 91, filters: [{ kind: "ai", param: 6 }, { kind: "off_ekor", param: 2 }, { kind: "off_shio", param: 1 }] },
  { id: "bbfs9-off_ekor1-off_shio2", label: "BBFS 9 + Mati Ekor 1 + Shio Mati 2", expectedLines: 60.7, stability: 2.79, hitRate: 91, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 2 }] },
  { id: "off_kepala1-off_ekor1-off_shio2-off_jumlah1", label: "Mati Kepala 1 + Mati Ekor 1 + Shio Mati 2 + Jumlah Mati 1", expectedLines: 60.8, stability: 2.85, hitRate: 91, filters: [{ kind: "off_kepala", param: 1 }, { kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 2 }, { kind: "off_jumlah", param: 1 }] },
  { id: "off_ekor2-off_shio2-off_jumlah1", label: "Mati Ekor 2 + Shio Mati 2 + Jumlah Mati 1", expectedLines: 60.0, stability: 2.94, hitRate: 91, filters: [{ kind: "off_ekor", param: 2 }, { kind: "off_shio", param: 2 }, { kind: "off_jumlah", param: 1 }] },
  { id: "bbfs9-off_kepala1-off_shio1-off_jumlah1", label: "BBFS 9 + Mati Kepala 1 + Shio Mati 1 + Jumlah Mati 1", expectedLines: 60.1, stability: 3.27, hitRate: 91, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_kepala", param: 1 }, { kind: "off_shio", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "size1-off_shio3", label: "Besar/Kecil + Shio Mati 3", expectedLines: 56.3, stability: 1.3, hitRate: 90, filters: [{ kind: "size", param: 1 }, { kind: "off_shio", param: 3 }] },
  { id: "off_kepala2-off_ekor1-off_jumlah1", label: "Mati Kepala 2 + Mati Ekor 1 + Jumlah Mati 1", expectedLines: 64.8, stability: 2.19, hitRate: 90, filters: [{ kind: "off_kepala", param: 2 }, { kind: "off_ekor", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "bbfs9-off_kepala1-off_shio2", label: "BBFS 9 + Mati Kepala 1 + Shio Mati 2", expectedLines: 60.7, stability: 2.59, hitRate: 90, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_kepala", param: 1 }, { kind: "off_shio", param: 2 }] },
  { id: "ai6-off_kepala2-off_shio1", label: "AI 6 Digit + Mati Kepala 2 + Shio Mati 1", expectedLines: 61.6, stability: 2.63, hitRate: 90, filters: [{ kind: "ai", param: 6 }, { kind: "off_kepala", param: 2 }, { kind: "off_shio", param: 1 }] },
  { id: "bbfs9-off_shio2-off_jumlah1", label: "BBFS 9 + Shio Mati 2 + Jumlah Mati 1", expectedLines: 60.8, stability: 2.85, hitRate: 90, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_shio", param: 2 }, { kind: "off_jumlah", param: 1 }] },
  { id: "off_kepala1-off_shio3-off_jumlah1", label: "Mati Kepala 1 + Shio Mati 3 + Jumlah Mati 1", expectedLines: 60.8, stability: 2.86, hitRate: 90, filters: [{ kind: "off_kepala", param: 1 }, { kind: "off_shio", param: 3 }, { kind: "off_jumlah", param: 1 }] },
  { id: "size1-off_shio1-off_jumlah1", label: "Besar/Kecil + Shio Mati 1 + Jumlah Mati 1", expectedLines: 61.8, stability: 2.86, hitRate: 90, filters: [{ kind: "size", param: 1 }, { kind: "off_shio", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "off_ekor1-off_shio3-off_jumlah1", label: "Mati Ekor 1 + Shio Mati 3 + Jumlah Mati 1", expectedLines: 60.8, stability: 3.14, hitRate: 90, filters: [{ kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 3 }, { kind: "off_jumlah", param: 1 }] },
  { id: "off_kepala1-off_ekor1-off_shio1-off_jumlah2", label: "Mati Kepala 1 + Mati Ekor 1 + Shio Mati 1 + Jumlah Mati 2", expectedLines: 59.3, stability: 3.39, hitRate: 90, filters: [{ kind: "off_kepala", param: 1 }, { kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 1 }, { kind: "off_jumlah", param: 2 }] },
  { id: "bbfs9-off_shio1-off_jumlah2", label: "BBFS 9 + Shio Mati 1 + Jumlah Mati 2", expectedLines: 59.3, stability: 3.41, hitRate: 90, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_shio", param: 1 }, { kind: "off_jumlah", param: 2 }] },
  { id: "parity1-off_shio1-off_jumlah1", label: "Ganjil/Genap + Shio Mati 1 + Jumlah Mati 1", expectedLines: 61.8, stability: 3.19, hitRate: 89, filters: [{ kind: "parity", param: 1 }, { kind: "off_shio", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "parity1-off_jumlah2", label: "Ganjil/Genap + Jumlah Mati 2", expectedLines: 60.0, stability: 3.29, hitRate: 89, filters: [{ kind: "parity", param: 1 }, { kind: "off_jumlah", param: 2 }] },
  { id: "off_ekor2-off_shio1-off_jumlah2", label: "Mati Ekor 2 + Shio Mati 1 + Jumlah Mati 2", expectedLines: 58.6, stability: 3.36, hitRate: 89, filters: [{ kind: "off_ekor", param: 2 }, { kind: "off_shio", param: 1 }, { kind: "off_jumlah", param: 2 }] },
  { id: "bbfs9-off_ekor1-off_shio1-off_jumlah1", label: "BBFS 9 + Mati Ekor 1 + Shio Mati 1 + Jumlah Mati 1", expectedLines: 60.2, stability: 3.45, hitRate: 89, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "off_kepala1-off_ekor2-off_jumlah1", label: "Mati Kepala 1 + Mati Ekor 2 + Jumlah Mati 1", expectedLines: 64.9, stability: 2.31, hitRate: 88, filters: [{ kind: "off_kepala", param: 1 }, { kind: "off_ekor", param: 2 }, { kind: "off_jumlah", param: 1 }] },
  { id: "ai6-off_kepala1-off_ekor1-off_shio1", label: "AI 6 Digit + Mati Kepala 1 + Mati Ekor 1 + Shio Mati 1", expectedLines: 62.4, stability: 2.57, hitRate: 88, filters: [{ kind: "ai", param: 6 }, { kind: "off_kepala", param: 1 }, { kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 1 }] },
  { id: "parity1-off_kepala1-off_shio1", label: "Ganjil/Genap + Mati Kepala 1 + Shio Mati 1", expectedLines: 61.9, stability: 3.01, hitRate: 88, filters: [{ kind: "parity", param: 1 }, { kind: "off_kepala", param: 1 }, { kind: "off_shio", param: 1 }] },
  { id: "bbfs9-off_kepala1-off_ekor1-off_shio1", label: "BBFS 9 + Mati Kepala 1 + Mati Ekor 1 + Shio Mati 1", expectedLines: 60.0, stability: 3.25, hitRate: 88, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_kepala", param: 1 }, { kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 1 }] },
  { id: "ai6-size1-off_shio1", label: "AI 6 Digit + Besar/Kecil + Shio Mati 1", expectedLines: 58.3, stability: 3.31, hitRate: 88, filters: [{ kind: "ai", param: 6 }, { kind: "size", param: 1 }, { kind: "off_shio", param: 1 }] },
  { id: "bbfs9-off_ekor2-off_shio1", label: "BBFS 9 + Mati Ekor 2 + Shio Mati 1", expectedLines: 59.4, stability: 3.54, hitRate: 87, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_ekor", param: 2 }, { kind: "off_shio", param: 1 }] },
  { id: "ai6-off_kepala1-off_shio2", label: "AI 6 Digit + Mati Kepala 1 + Shio Mati 2", expectedLines: 63.0, stability: 2.11, hitRate: 86, filters: [{ kind: "ai", param: 6 }, { kind: "off_kepala", param: 1 }, { kind: "off_shio", param: 2 }] },
  { id: "bbfs9-off_kepala2-off_shio1", label: "BBFS 9 + Mati Kepala 2 + Shio Mati 1", expectedLines: 59.4, stability: 3.42, hitRate: 86, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_kepala", param: 2 }, { kind: "off_shio", param: 1 }] },
  { id: "off_kepala1-off_shio2-off_jumlah2", label: "Mati Kepala 1 + Shio Mati 2 + Jumlah Mati 2", expectedLines: 60.0, stability: 3.69, hitRate: 86, filters: [{ kind: "off_kepala", param: 1 }, { kind: "off_shio", param: 2 }, { kind: "off_jumlah", param: 2 }] },
  { id: "ai6-off_kepala1-off_jumlah2", label: "AI 6 Digit + Mati Kepala 1 + Jumlah Mati 2", expectedLines: 60.5, stability: 3.72, hitRate: 86, filters: [{ kind: "ai", param: 6 }, { kind: "off_kepala", param: 1 }, { kind: "off_jumlah", param: 2 }] },
  { id: "ai6-off_ekor1-off_jumlah2", label: "AI 6 Digit + Mati Ekor 1 + Jumlah Mati 2", expectedLines: 60.5, stability: 3.77, hitRate: 86, filters: [{ kind: "ai", param: 6 }, { kind: "off_ekor", param: 1 }, { kind: "off_jumlah", param: 2 }] },
  { id: "ai6-off_kepala1-off_shio1-off_jumlah1", label: "AI 6 Digit + Mati Kepala 1 + Shio Mati 1 + Jumlah Mati 1", expectedLines: 62.4, stability: 3.23, hitRate: 85, filters: [{ kind: "ai", param: 6 }, { kind: "off_kepala", param: 1 }, { kind: "off_shio", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "ai6-off_kepala1-off_shio3", label: "AI 6 Digit + Mati Kepala 1 + Shio Mati 3", expectedLines: 56.7, stability: 2.21, hitRate: 84, filters: [{ kind: "ai", param: 6 }, { kind: "off_kepala", param: 1 }, { kind: "off_shio", param: 3 }] },
  { id: "ai6-off_ekor1-off_shio2", label: "AI 6 Digit + Mati Ekor 1 + Shio Mati 2", expectedLines: 63.0, stability: 2.35, hitRate: 84, filters: [{ kind: "ai", param: 6 }, { kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 2 }] },
  { id: "ai6-off_ekor1-off_shio1-off_jumlah1", label: "AI 6 Digit + Mati Ekor 1 + Shio Mati 1 + Jumlah Mati 1", expectedLines: 62.4, stability: 3.25, hitRate: 84, filters: [{ kind: "ai", param: 6 }, { kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "ai6-parity1-off_shio1", label: "AI 6 Digit + Ganjil/Genap + Shio Mati 1", expectedLines: 58.3, stability: 3.64, hitRate: 84, filters: [{ kind: "ai", param: 6 }, { kind: "parity", param: 1 }, { kind: "off_shio", param: 1 }] },
  { id: "off_ekor1-off_shio2-off_jumlah2", label: "Mati Ekor 1 + Shio Mati 2 + Jumlah Mati 2", expectedLines: 60.0, stability: 3.82, hitRate: 84, filters: [{ kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 2 }, { kind: "off_jumlah", param: 2 }] },
  { id: "ai6-bbfs9-off_ekor1", label: "AI 6 Digit + BBFS 9 + Mati Ekor 1", expectedLines: 61.1, stability: 4.17, hitRate: 84, filters: [{ kind: "ai", param: 6 }, { kind: "bbfs", param: 9 }, { kind: "off_ekor", param: 1 }] },
  { id: "parity1-off_shio2", label: "Ganjil/Genap + Shio Mati 2", expectedLines: 62.5, stability: 2.92, hitRate: 83, filters: [{ kind: "parity", param: 1 }, { kind: "off_shio", param: 2 }] },
  { id: "ai6-off_shio2-off_jumlah1", label: "AI 6 Digit + Shio Mati 2 + Jumlah Mati 1", expectedLines: 63.0, stability: 3.09, hitRate: 83, filters: [{ kind: "ai", param: 6 }, { kind: "off_shio", param: 2 }, { kind: "off_jumlah", param: 1 }] },
  { id: "size1-off_jumlah2", label: "Besar/Kecil + Jumlah Mati 2", expectedLines: 60.0, stability: 3.82, hitRate: 82, filters: [{ kind: "size", param: 1 }, { kind: "off_jumlah", param: 2 }] },
  { id: "ai6-bbfs9-off_kepala1", label: "AI 6 Digit + BBFS 9 + Mati Kepala 1", expectedLines: 61.1, stability: 4.24, hitRate: 82, filters: [{ kind: "ai", param: 6 }, { kind: "bbfs", param: 9 }, { kind: "off_kepala", param: 1 }] },
  { id: "ai6-off_ekor1-off_shio3", label: "AI 6 Digit + Mati Ekor 1 + Shio Mati 3", expectedLines: 56.7, stability: 2.45, hitRate: 81, filters: [{ kind: "ai", param: 6 }, { kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 3 }] },
  { id: "off_kepala2-off_jumlah2", label: "Mati Kepala 2 + Jumlah Mati 2", expectedLines: 63.9, stability: 3.18, hitRate: 81, filters: [{ kind: "off_kepala", param: 2 }, { kind: "off_jumlah", param: 2 }] },
  { id: "bbfs9-off_kepala1-off_ekor1", label: "BBFS 9 + Mati Kepala 1 + Mati Ekor 1", expectedLines: 65.6, stability: 3.5, hitRate: 81, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_kepala", param: 1 }, { kind: "off_ekor", param: 1 }] },
  { id: "bbfs9-off_ekor2", label: "BBFS 9 + Mati Ekor 2", expectedLines: 64.7, stability: 3.52, hitRate: 81, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_ekor", param: 2 }] },
  { id: "ai6-off_shio1-off_jumlah2", label: "AI 6 Digit + Shio Mati 1 + Jumlah Mati 2", expectedLines: 61.5, stability: 3.89, hitRate: 81, filters: [{ kind: "ai", param: 6 }, { kind: "off_shio", param: 1 }, { kind: "off_jumlah", param: 2 }] },
  { id: "off_shio3-off_jumlah2", label: "Shio Mati 3 + Jumlah Mati 2", expectedLines: 60.0, stability: 4.03, hitRate: 81, filters: [{ kind: "off_shio", param: 3 }, { kind: "off_jumlah", param: 2 }] },
  { id: "off_kepala1-off_ekor1-off_jumlah2", label: "Mati Kepala 1 + Mati Ekor 1 + Jumlah Mati 2", expectedLines: 64.8, stability: 3.3, hitRate: 80, filters: [{ kind: "off_kepala", param: 1 }, { kind: "off_ekor", param: 1 }, { kind: "off_jumlah", param: 2 }] },
  { id: "bbfs9-off_kepala2", label: "BBFS 9 + Mati Kepala 2", expectedLines: 64.8, stability: 3.61, hitRate: 80, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_kepala", param: 2 }] },
  { id: "parity1-off_ekor1-off_shio1", label: "Ganjil/Genap + Mati Ekor 1 + Shio Mati 1", expectedLines: 61.9, stability: 3.18, hitRate: 79, filters: [{ kind: "parity", param: 1 }, { kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 1 }] },
  { id: "off_ekor2-off_jumlah2", label: "Mati Ekor 2 + Jumlah Mati 2", expectedLines: 64.1, stability: 3.29, hitRate: 79, filters: [{ kind: "off_ekor", param: 2 }, { kind: "off_jumlah", param: 2 }] },
  { id: "bbfs9-off_jumlah2", label: "BBFS 9 + Jumlah Mati 2", expectedLines: 64.8, stability: 3.35, hitRate: 79, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_jumlah", param: 2 }] },
  { id: "ai6-off_jumlah3", label: "AI 6 Digit + Jumlah Mati 3", expectedLines: 58.8, stability: 4.31, hitRate: 79, filters: [{ kind: "ai", param: 6 }, { kind: "off_jumlah", param: 3 }] },
  { id: "ai6-off_kepala1-off_ekor1-off_shio2", label: "AI 6 Digit + Mati Kepala 1 + Mati Ekor 1 + Shio Mati 2", expectedLines: 56.7, stability: 2.67, hitRate: 77, filters: [{ kind: "ai", param: 6 }, { kind: "off_kepala", param: 1 }, { kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 2 }] },
  { id: "ai6-off_shio3-off_jumlah1", label: "AI 6 Digit + Shio Mati 3 + Jumlah Mati 1", expectedLines: 56.7, stability: 3.11, hitRate: 76, filters: [{ kind: "ai", param: 6 }, { kind: "off_shio", param: 3 }, { kind: "off_jumlah", param: 1 }] },
  { id: "bbfs9-off_kepala1-off_jumlah1", label: "BBFS 9 + Mati Kepala 1 + Jumlah Mati 1", expectedLines: 65.6, stability: 3.31, hitRate: 75, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_kepala", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "bbfs9-off_ekor1-off_jumlah1", label: "BBFS 9 + Mati Ekor 1 + Jumlah Mati 1", expectedLines: 65.6, stability: 3.4, hitRate: 75, filters: [{ kind: "bbfs", param: 9 }, { kind: "off_ekor", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "ai6-bbfs9-off_shio1", label: "AI 6 Digit + BBFS 9 + Shio Mati 1", expectedLines: 62.2, stability: 3.37, hitRate: 74, filters: [{ kind: "ai", param: 6 }, { kind: "bbfs", param: 9 }, { kind: "off_shio", param: 1 }] },
  { id: "size1-off_shio2-off_jumlah1", label: "Besar/Kecil + Shio Mati 2 + Jumlah Mati 1", expectedLines: 56.2, stability: 2.95, hitRate: 73, filters: [{ kind: "size", param: 1 }, { kind: "off_shio", param: 2 }, { kind: "off_jumlah", param: 1 }] },
  { id: "ai6-off_kepala1-off_shio2-off_jumlah1", label: "AI 6 Digit + Mati Kepala 1 + Shio Mati 2 + Jumlah Mati 1", expectedLines: 56.7, stability: 3.26, hitRate: 73, filters: [{ kind: "ai", param: 6 }, { kind: "off_kepala", param: 1 }, { kind: "off_shio", param: 2 }, { kind: "off_jumlah", param: 1 }] },
  { id: "ai6-parity1-off_jumlah1", label: "AI 6 Digit + Ganjil/Genap + Jumlah Mati 1", expectedLines: 57.2, stability: 3.83, hitRate: 73, filters: [{ kind: "ai", param: 6 }, { kind: "parity", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "off_kepala1-off_shio1-off_jumlah3", label: "Mati Kepala 1 + Shio Mati 1 + Jumlah Mati 3", expectedLines: 57.8, stability: 4.29, hitRate: 73, filters: [{ kind: "off_kepala", param: 1 }, { kind: "off_shio", param: 1 }, { kind: "off_jumlah", param: 3 }] },
  { id: "ai6-off_ekor1-off_shio2-off_jumlah1", label: "AI 6 Digit + Mati Ekor 1 + Shio Mati 2 + Jumlah Mati 1", expectedLines: 56.7, stability: 3.29, hitRate: 72, filters: [{ kind: "ai", param: 6 }, { kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 2 }, { kind: "off_jumlah", param: 1 }] },
  { id: "off_ekor1-off_shio1-off_jumlah3", label: "Mati Ekor 1 + Shio Mati 1 + Jumlah Mati 3", expectedLines: 57.6, stability: 4.21, hitRate: 72, filters: [{ kind: "off_ekor", param: 1 }, { kind: "off_shio", param: 1 }, { kind: "off_jumlah", param: 3 }] },
  { id: "off_shio2-off_jumlah3", label: "Shio Mati 2 + Jumlah Mati 3", expectedLines: 58.3, stability: 4.58, hitRate: 72, filters: [{ kind: "off_shio", param: 2 }, { kind: "off_jumlah", param: 3 }] },
  { id: "ai6-size1-off_jumlah1", label: "AI 6 Digit + Besar/Kecil + Jumlah Mati 1", expectedLines: 57.3, stability: 4.08, hitRate: 71, filters: [{ kind: "ai", param: 6 }, { kind: "size", param: 1 }, { kind: "off_jumlah", param: 1 }] },
  { id: "off_shio1-off_jumlah3", label: "Shio Mati 1 + Jumlah Mati 3", expectedLines: 64.0, stability: 4.58, hitRate: 71, filters: [{ kind: "off_shio", param: 1 }, { kind: "off_jumlah", param: 3 }] },
  { id: "ai6-off_kepala2-off_shio2", label: "AI 6 Digit + Mati Kepala 2 + Shio Mati 2", expectedLines: 56.0, stability: 2.6, hitRate: 70, filters: [{ kind: "ai", param: 6 }, { kind: "off_kepala", param: 2 }, { kind: "off_shio", param: 2 }] },
];

const digitParity = (d: number) => (d % 2 === 0 ? "GENAP" : "GANJIL");
const digitSize = (d: number) => (d >= 5 ? "BESAR" : "KECIL");

/** Cek apakah semua input yang dibutuhkan combo tersedia di bundle. */
export function comboInputsReady(combo: InvestCombo, b: InvestBundle): boolean {
  for (const f of combo.filters) {
    if (f.kind === "ai" && !b.ai[f.param]?.length) return false;
    if (f.kind === "bbfs" && !b.bbfs[f.param]?.length) return false;
    if (f.kind === "parity" && !b.parity) return false;
    if (f.kind === "size" && !b.size) return false;
    if (f.kind === "off_kepala" && !b.offKepala[f.param]) return false;
    if (f.kind === "off_ekor" && !b.offEkor[f.param]) return false;
    if (f.kind === "off_shio" && !b.offShio[f.param]) return false;
    if (f.kind === "off_jumlah" && !b.offJumlah[f.param]) return false;
  }
  return true;
}

function lineAllowed(combo: InvestCombo, b: InvestBundle, k: number, e: number): boolean {
  for (const f of combo.filters) {
    switch (f.kind) {
      case "ai": {
        const s = b.ai[f.param];
        if (!s.includes(k) && !s.includes(e)) return false;
        break;
      }
      case "parity":
        if (digitParity(k) !== b.parity && digitParity(e) !== b.parity) return false;
        break;
      case "size":
        if (digitSize(k) !== b.size && digitSize(e) !== b.size) return false;
        break;
      case "bbfs": {
        const s = b.bbfs[f.param];
        if (!s.includes(k) || !s.includes(e)) return false; // BBFS: kedua digit harus masuk
        break;
      }
      case "off_kepala":
        if (b.offKepala[f.param].includes(k)) return false;
        break;
      case "off_ekor":
        if (b.offEkor[f.param].includes(e)) return false;
        break;
      case "off_shio":
        if (b.offShio[f.param].includes(shioOf2D(k * 10 + e))) return false;
        break;
      case "off_jumlah":
        if (b.offJumlah[f.param].includes(jumlah2D(k, e))) return false;
        break;
    }
  }
  return true;
}

/** RUMUS: hasilkan daftar line 2D ("ke") untuk sebuah combo. null jika input belum lengkap. */
export function applyInvestCombo(combo: InvestCombo, b: InvestBundle): string[] | null {
  if (!comboInputsReady(combo, b)) return null;
  const lines: string[] = [];
  for (let k = 0; k <= 9; k++) {
    for (let e = 0; e <= 9; e++) {
      if (lineAllowed(combo, b, k, e)) lines.push(`${k}${e}`);
    }
  }
  return lines;
}

export interface InvestEvaluation {
  combo: InvestCombo;
  lines: string[];
  count: number;
  inRange: boolean; // ketat 55-65
  inSoftRange: boolean; // longgar 53-67
}

/** Evaluasi satu combo terhadap bundle: hitung line + apakah masuk rentang. */
export function evaluateInvestCombo(combo: InvestCombo, b: InvestBundle): InvestEvaluation | null {
  const lines = applyInvestCombo(combo, b);
  if (lines === null) return null;
  const count = lines.length;
  return {
    combo,
    lines,
    count,
    inRange: count >= INVEST_TARGET_MIN && count <= INVEST_TARGET_MAX,
    inSoftRange: count >= INVEST_SOFT_MIN && count <= INVEST_SOFT_MAX,
  };
}
