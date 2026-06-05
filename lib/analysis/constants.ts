export const SHIO_NAMES = ["", "Kuda", "Ular", "Naga", "Kelinci", "Harimau", "Kerbau", "Tikus", "Babi", "Anjing", "Ayam", "Monyet", "Kambing"];
export const SHIO_EMOJI = ["", "🐴", "🐍", "🐉", "🐰", "🐯", "🐂", "🐭", "🐷", "🐕", "🐔", "🐒", "🐐"];
export const DIGITS = Array.from({ length: 10 }, (_, i) => String(i));

export const SHIO_2D: Record<number, number[]> = {
  1: [1, 13, 25, 37, 49, 61, 73, 85, 97],
  2: [2, 14, 26, 38, 50, 62, 74, 86, 98],
  3: [3, 15, 27, 39, 51, 63, 75, 87, 99],
  4: [4, 16, 28, 40, 52, 64, 76, 88, 0],
  5: [5, 17, 29, 41, 53, 65, 77, 89],
  6: [6, 18, 30, 42, 54, 66, 78, 90],
  7: [7, 19, 31, 43, 55, 67, 79, 91],
  8: [8, 20, 32, 44, 56, 68, 80, 92],
  9: [9, 21, 33, 45, 57, 69, 81, 93],
  10: [10, 22, 34, 46, 58, 70, 82, 94],
  11: [11, 23, 35, 47, 59, 71, 83, 95],
  12: [12, 24, 36, 48, 60, 72, 84, 96],
};

/**
 * Metadata tiap mode analisa — DATA saja (label + jumlah rumus).
 * Warna accent TIDAK lagi di sini; sudah pindah ke token CSS (--color-mode-*)
 * dan dipasang via atribut data-mode pada komponen.
 */
export const typeMeta: Record<string, { label: string; formula: string }> = {
  ai: { label: "ANGKA IKUT", formula: "35 RUMUS" },
  bbfs: { label: "BBFS", formula: "35 RUMUS" },
  mati: { label: "ANGKA MATI", formula: "56 RUMUS" },
  jumlah: { label: "JUMLAH MATI", formula: "56 RUMUS" },
  shio: { label: "SHIO MATI", formula: "60 RUMUS" },
  rekap: { label: "MENU REKAP", formula: "LINE GENERATOR" },
};

export const evaluationModes = new Set(["ai", "ai_parity", "ai_size", "bbfs", "mati", "jumlah", "shio"]);
export const angkaJadiModes = new Set(["mati", "jumlah", "shio"]);
  
