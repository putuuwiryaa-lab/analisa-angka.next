export type TargetPair = "depan" | "tengah" | "belakang";

export type Bbfs7Formula = {
  code: string;
  name: string;
  keys: string[];
};

export type Bbfs7TestDetail = {
  sourceResult: string;
  targetResult: string;
  target2d: string;
  bbfsDigits: string;
  hit: boolean;
};

export type Bbfs7FormulaScore = {
  formulaCode: string;
  formulaName: string;
  total: number;
  masuk: number;
  zonk: number;
  winrate: number;
  latest7Masuk: number;
  maxZonkStreak: number;
  bbfsDigits: string;
  details: Bbfs7TestDetail[];
};

export type Bbfs7WindowResult = {
  window: number;
  isTie: boolean;
  tiedFormulaCodes: string[];
  ranking: Bbfs7FormulaScore[];
};

export type Bbfs7WalkForwardResult = {
  targetPair: TargetPair;
  historyCount: number;
  transitionCount: number;
  selectedWindow: number | null;
  selectedFormula: Bbfs7FormulaScore | null;
  windows: Bbfs7WindowResult[];
  latestResult: string | null;
  nextBbfsDigits: string | null;
  note: string;
};

const TESSON_MAP: Record<number, number> = {
  0: 7,
  7: 0,
  1: 4,
  4: 1,
  2: 9,
  9: 2,
  3: 6,
  6: 3,
  5: 8,
  8: 5,
};

const DEFAULT_FILL_KEYS = [
  "C",
  "D",
  "B",
  "A",
  "C+1",
  "C-1",
  "D+1",
  "D-1",
  "C+2",
  "C-2",
  "D+2",
  "D-2",
  "C+D",
  "B+C",
  "A+D",
  "B+D",
  "A+C",
  "A+B",
  "TC",
  "TD",
  "TB",
  "TA",
  "MC",
  "MD",
  "MB",
  "MA",
  "SUM4",
  "SUM4+1",
  "SUM4-1",
];

export const BBFS7_FORMULAS: Bbfs7Formula[] = [
  { code: "F01", name: "Ring Belakang C-D ±2", keys: ["C", "D", "C+1", "C-1", "C+2", "D+1", "D-1"] },
  { code: "F02", name: "Ring Ekor D ±2", keys: ["D", "D+1", "D-1", "D+2", "D-2", "C", "C+D"] },
  { code: "F03", name: "Ring Kepala Belakang C ±2", keys: ["C", "C+1", "C-1", "C+2", "C-2", "D", "C+D"] },
  { code: "F04", name: "Silang Tengah Belakang", keys: ["B", "C", "D", "B+C", "C+D", "B+D", "A+D"] },
  { code: "F05", name: "Jumlah 2D Belakang", keys: ["C", "D", "C+D", "C-D", "D-C", "C+D+1", "C+D-1"] },
  { code: "F06", name: "Tesson Belakang", keys: ["C", "D", "TC", "TD", "C+1", "D+1", "C+D"] },
  { code: "F07", name: "Tesson + Selisih Belakang", keys: ["C", "D", "TC", "TD", "C-D", "D-C", "C+D"] },
  { code: "F08", name: "Mirror Belakang", keys: ["C", "D", "MC", "MD", "C+1", "D+1", "C+D"] },
  { code: "F09", name: "Kepala Ekor Result", keys: ["A", "D", "A+D", "A-D", "D-A", "C+D", "A+C"] },
  { code: "F10", name: "Full Jumlah Posisi", keys: ["A+B", "B+C", "C+D", "A+C", "B+D", "A+D", "SUM4"] },
  { code: "F11", name: "ABCD Basic", keys: ["A", "B", "C", "D", "A+B", "C+D", "SUM4"] },
  { code: "F12", name: "AB CD Sum", keys: ["A", "B", "C", "D", "A+B", "C+D", "A+B+C"] },
  { code: "F13", name: "BC Core", keys: ["B", "C", "B+C", "B-C", "C-B", "B+1", "C+1"] },
  { code: "F14", name: "CD Core", keys: ["C", "D", "C+D", "C-D", "D-C", "C+1", "D+1"] },
  { code: "F15", name: "AD Core", keys: ["A", "D", "A+D", "A-D", "D-A", "A+1", "D+1"] },
  { code: "F16", name: "AC Core", keys: ["A", "C", "A+C", "A-C", "C-A", "A+1", "C+1"] },
  { code: "F17", name: "BD Core", keys: ["B", "D", "B+D", "B-D", "D-B", "B+1", "D+1"] },
  { code: "F18", name: "All Tesson", keys: ["TA", "TB", "TC", "TD", "A+B", "C+D", "SUM4"] },
  { code: "F19", name: "All Mirror", keys: ["MA", "MB", "MC", "MD", "A+B", "C+D", "SUM4"] },
  { code: "F20", name: "All Complement", keys: ["KA", "KB", "KC", "KD", "A+B", "C+D", "SUM4"] },
  { code: "F21", name: "C-D Ring Lengkap", keys: ["C", "D", "C+1", "C-1", "D+1", "D-1", "C+D"] },
  { code: "F22", name: "C Ring Kuat", keys: ["C", "C+1", "C-1", "C+2", "C-2", "TC", "D"] },
  { code: "F23", name: "D Ring Kuat", keys: ["D", "D+1", "D-1", "D+2", "D-2", "TD", "C"] },
  { code: "F24", name: "C-D Plus Tesson", keys: ["C", "D", "C+1", "D+1", "TC", "TD", "C+D"] },
  { code: "F25", name: "C-D Minus Tesson", keys: ["C", "D", "C-1", "D-1", "TC", "TD", "C+D"] },
  { code: "F26", name: "C-D Plus Mirror", keys: ["C", "D", "C+1", "D+1", "MC", "MD", "C+D"] },
  { code: "F27", name: "C-D Minus Mirror", keys: ["C", "D", "C-1", "D-1", "MC", "MD", "C+D"] },
  { code: "F28", name: "Belakang + Sum Total", keys: ["C", "D", "C+D", "SUM4", "SUM4+1", "SUM4-1", "B+C"] },
  { code: "F29", name: "Belakang + 3D Tengah", keys: ["B", "C", "D", "B+C", "C+D", "B+C+D", "SUM4"] },
  { code: "F30", name: "Belakang + 3D Acak Posisi", keys: ["A", "C", "D", "A+C", "C+D", "A+C+D", "SUM4"] },
  { code: "F31", name: "Selisih Semua Posisi", keys: ["A-B", "A-C", "A-D", "B-C", "B-D", "C-D", "SUM4"] },
  { code: "F32", name: "Balik Selisih Semua", keys: ["B-A", "C-A", "D-A", "C-B", "D-B", "D-C", "SUM4"] },
  { code: "F33", name: "Selisih Belakang Dominan", keys: ["C-D", "D-C", "C", "D", "C+D", "TC", "TD"] },
  { code: "F34", name: "Selisih Tengah Belakang", keys: ["B-C", "C-B", "B-D", "D-B", "B", "C", "D"] },
  { code: "F35", name: "Selisih Kepala Belakang", keys: ["A-C", "C-A", "A-D", "D-A", "A", "C", "D"] },
  { code: "F36", name: "Jumlah Pair Plus", keys: ["A+B+1", "A+C+1", "A+D+1", "B+C+1", "B+D+1", "C+D+1", "SUM4+1"] },
  { code: "F37", name: "Jumlah Pair Minus", keys: ["A+B-1", "A+C-1", "A+D-1", "B+C-1", "B+D-1", "C+D-1", "SUM4-1"] },
  { code: "F38", name: "Jumlah Pair Plus2", keys: ["A+B+2", "A+C+2", "A+D+2", "B+C+2", "B+D+2", "C+D+2", "SUM4+2"] },
  { code: "F39", name: "Jumlah Pair Minus2", keys: ["A+B-2", "A+C-2", "A+D-2", "B+C-2", "B+D-2", "C+D-2", "SUM4-2"] },
  { code: "F40", name: "ABCD + Tesson Belakang", keys: ["A", "B", "C", "D", "TC", "TD", "SUM4"] },
  { code: "F41", name: "ABCD + Mirror Belakang", keys: ["A", "B", "C", "D", "MC", "MD", "SUM4"] },
  { code: "F42", name: "ABCD + Tesson Tengah", keys: ["A", "B", "C", "D", "TB", "TC", "SUM4"] },
  { code: "F43", name: "ABCD + Mirror Tengah", keys: ["A", "B", "C", "D", "MB", "MC", "SUM4"] },
  { code: "F44", name: "Tengah Belakang Ring", keys: ["B", "C", "D", "B+1", "C+1", "D+1", "B+C"] },
  { code: "F45", name: "Tengah Belakang Minus", keys: ["B", "C", "D", "B-1", "C-1", "D-1", "C+D"] },
  { code: "F46", name: "Kepala Belakang Ring", keys: ["A", "C", "D", "A+1", "C+1", "D+1", "A+D"] },
  { code: "F47", name: "Kepala Belakang Minus", keys: ["A", "C", "D", "A-1", "C-1", "D-1", "A+C"] },
  { code: "F48", name: "Ekor + Sum Pair", keys: ["D", "D+1", "D-1", "A+D", "B+D", "C+D", "SUM4"] },
  { code: "F49", name: "Kepala Belakang + Sum Pair", keys: ["C", "C+1", "C-1", "A+C", "B+C", "C+D", "SUM4"] },
  { code: "F50", name: "Tesson Pair CD + Sum", keys: ["TC", "TD", "C", "D", "C+D", "TC+1", "TD+1"] },
  { code: "F51", name: "Mirror Pair CD + Sum", keys: ["MC", "MD", "C", "D", "C+D", "MC+1", "MD+1"] },
  { code: "F52", name: "Tesson Pair BD", keys: ["TB", "TD", "B", "D", "B+D", "B-D", "D-B"] },
  { code: "F53", name: "Tesson Pair AC", keys: ["TA", "TC", "A", "C", "A+C", "A-C", "C-A"] },
  { code: "F54", name: "Mirror Pair BD", keys: ["MB", "MD", "B", "D", "B+D", "B-D", "D-B"] },
  { code: "F55", name: "Mirror Pair AC", keys: ["MA", "MC", "A", "C", "A+C", "A-C", "C-A"] },
  { code: "F56", name: "3D Akhir Tradisional", keys: ["B", "C", "D", "B+C", "C+D", "B+D", "B+C+D"] },
  { code: "F57", name: "3D Awal Tradisional", keys: ["A", "B", "C", "A+B", "B+C", "A+C", "A+B+C"] },
  { code: "F58", name: "Lompat +2 Semua Posisi", keys: ["A+2", "B+2", "C+2", "D+2", "A+B", "B+C", "C+D"] },
  { code: "F59", name: "Lompat -2 Semua Posisi", keys: ["A-2", "B-2", "C-2", "D-2", "A+B", "B+C", "C+D"] },
  { code: "F60", name: "Campuran Final Tradisional", keys: ["C", "D", "B+C", "A+D", "TC", "TD", "SUM4"] },
];

function mod10(value: number) {
  return ((value % 10) + 10) % 10;
}

function tesson(value: number) {
  return TESSON_MAP[mod10(value)] ?? mod10(value);
}

function mirror9(value: number) {
  return 9 - mod10(value);
}

function complement10(value: number) {
  return mod10(10 - value);
}

function digitsOf(result: string): [number, number, number, number] | null {
  const value = String(result || "").trim();
  if (!/^\d{4}$/.test(value)) return null;
  return [Number(value[0]), Number(value[1]), Number(value[2]), Number(value[3])];
}

function addFeatureVariants(features: Record<string, number>, key: string, value: number) {
  features[key] = mod10(value);
  features[`${key}+1`] = mod10(value + 1);
  features[`${key}-1`] = mod10(value - 1);
  features[`${key}+2`] = mod10(value + 2);
  features[`${key}-2`] = mod10(value - 2);
  features[`${key}+3`] = mod10(value + 3);
  features[`${key}-3`] = mod10(value - 3);
}

function makeFeatures(result: string) {
  const digits = digitsOf(result);
  if (!digits) return null;
  const [a, b, c, d] = digits;
  const features: Record<string, number> = {};
  const base = { A: a, B: b, C: c, D: d };

  for (const [key, value] of Object.entries(base)) {
    addFeatureVariants(features, key, value);
    addFeatureVariants(features, `T${key}`, tesson(value));
    addFeatureVariants(features, `M${key}`, mirror9(value));
    addFeatureVariants(features, `K${key}`, complement10(value));
  }

  const pairValues: Record<string, number> = {
    "A+B": a + b,
    "A+C": a + c,
    "A+D": a + d,
    "B+C": b + c,
    "B+D": b + d,
    "C+D": c + d,
    "A-B": a - b,
    "B-A": b - a,
    "A-C": a - c,
    "C-A": c - a,
    "A-D": a - d,
    "D-A": d - a,
    "B-C": b - c,
    "C-B": c - b,
    "B-D": b - d,
    "D-B": d - b,
    "C-D": c - d,
    "D-C": d - c,
  };

  for (const [key, value] of Object.entries(pairValues)) {
    addFeatureVariants(features, key, value);
  }

  addFeatureVariants(features, "SUM4", a + b + c + d);
  addFeatureVariants(features, "A+B+C", a + b + c);
  addFeatureVariants(features, "B+C+D", b + c + d);
  addFeatureVariants(features, "A+C+D", a + c + d);
  addFeatureVariants(features, "A+B+D", a + b + d);

  return features;
}

export function makeBbfs7(sourceResult: string, keys: string[]) {
  const features = makeFeatures(sourceResult);
  if (!features) return "";

  const output: number[] = [];
  const addDigit = (value: number | undefined) => {
    if (value === undefined) return;
    const digit = mod10(value);
    if (!output.includes(digit)) output.push(digit);
  };

  for (const key of keys) {
    addDigit(features[key]);
    if (output.length >= 7) break;
  }

  for (const key of DEFAULT_FILL_KEYS) {
    addDigit(features[key]);
    if (output.length >= 7) break;
  }

  for (let digit = 0; digit <= 9 && output.length < 7; digit++) {
    addDigit(digit);
  }

  return output.slice(0, 7).sort((a, b) => a - b).join("");
}

export function target2D(result: string, targetPair: TargetPair) {
  const value = String(result || "").trim();
  if (!/^\d{4}$/.test(value)) return "";
  if (targetPair === "depan") return value.slice(0, 2);
  if (targetPair === "tengah") return value.slice(1, 3);
  return value.slice(2, 4);
}

function maxZonkStreak(details: Bbfs7TestDetail[]) {
  let current = 0;
  let max = 0;
  for (const detail of details) {
    if (detail.hit) {
      current = 0;
    } else {
      current += 1;
      max = Math.max(max, current);
    }
  }
  return max;
}

function evaluateFormula(history: string[], formula: Bbfs7Formula, targetPair: TargetPair, window: number): Bbfs7FormulaScore {
  const transitionCount = Math.max(history.length - 1, 0);
  const safeWindow = Math.min(window, transitionCount);
  const startIndex = Math.max(1, history.length - safeWindow);
  const details: Bbfs7TestDetail[] = [];

  for (let index = startIndex; index < history.length; index++) {
    const sourceResult = history[index - 1];
    const targetResult = history[index];
    const bbfsDigits = makeBbfs7(sourceResult, formula.keys);
    const target = target2D(targetResult, targetPair);
    const hit = Boolean(target && bbfsDigits.includes(target[0]) && bbfsDigits.includes(target[1]));
    details.push({ sourceResult, targetResult, target2d: target, bbfsDigits, hit });
  }

  const masuk = details.filter((detail) => detail.hit).length;
  const total = details.length;
  const latest7Masuk = details.slice(-7).filter((detail) => detail.hit).length;
  const latestResult = history[history.length - 1] || "";

  return {
    formulaCode: formula.code,
    formulaName: formula.name,
    total,
    masuk,
    zonk: total - masuk,
    winrate: total ? Number(((masuk / total) * 100).toFixed(2)) : 0,
    latest7Masuk,
    maxZonkStreak: maxZonkStreak(details),
    bbfsDigits: makeBbfs7(latestResult, formula.keys),
    details,
  };
}

function sortScores(scores: Bbfs7FormulaScore[]) {
  return [...scores].sort((a, b) => {
    if (b.masuk !== a.masuk) return b.masuk - a.masuk;
    if (b.latest7Masuk !== a.latest7Masuk) return b.latest7Masuk - a.latest7Masuk;
    if (a.maxZonkStreak !== b.maxZonkStreak) return a.maxZonkStreak - b.maxZonkStreak;
    return a.formulaCode.localeCompare(b.formulaCode);
  });
}

export function runBbfs7WalkForward(
  rawHistory: string[],
  targetPair: TargetPair,
  options: { startWindow?: number; step?: number; maxWindow?: number } = {},
): Bbfs7WalkForwardResult {
  const history = rawHistory.map((item) => String(item).trim()).filter((item) => /^\d{4}$/.test(item));
  const transitionCount = Math.max(history.length - 1, 0);
  const startWindow = Math.max(7, options.startWindow || 14);
  const step = Math.max(1, options.step || 7);
  const maxWindow = Math.min(options.maxWindow || transitionCount, transitionCount);
  const windows: Bbfs7WindowResult[] = [];

  if (transitionCount < startWindow) {
    return {
      targetPair,
      historyCount: history.length,
      transitionCount,
      selectedWindow: null,
      selectedFormula: null,
      windows,
      latestResult: history[history.length - 1] || null,
      nextBbfsDigits: null,
      note: `Minimal butuh ${startWindow + 1} result untuk uji ${startWindow} transisi.`,
    };
  }

  let selected: Bbfs7FormulaScore | null = null;
  let selectedWindow: number | null = null;

  for (let window = startWindow; window <= maxWindow; window += step) {
    const ranking = sortScores(BBFS7_FORMULAS.map((formula) => evaluateFormula(history, formula, targetPair, window)));
    const bestScore = ranking[0]?.masuk ?? 0;
    const tiedFormulaCodes = ranking.filter((score) => score.masuk === bestScore).map((score) => score.formulaCode);
    const isTie = tiedFormulaCodes.length > 1;
    windows.push({ window, isTie, tiedFormulaCodes, ranking });

    if (!isTie) {
      selected = ranking[0];
      selectedWindow = window;
      break;
    }
  }

  if (!selected && windows.length) {
    const lastWindow = windows[windows.length - 1];
    selected = lastWindow.ranking[0] || null;
    selectedWindow = lastWindow.window;
  }

  return {
    targetPair,
    historyCount: history.length,
    transitionCount,
    selectedWindow,
    selectedFormula: selected,
    windows,
    latestResult: history[history.length - 1] || null,
    nextBbfsDigits: selected?.bbfsDigits || null,
    note: selected ? "Rumus dipilih dari walk-forward bertahap." : "Belum ada rumus terpilih.",
  };
}
