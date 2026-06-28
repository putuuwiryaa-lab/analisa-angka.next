export type TargetPair = "depan" | "tengah" | "belakang";

export type Bbfs7TraditionalFormula = {
  code: string;
  name: string;
  keys: string[];
};

export type Bbfs7TraditionalDetail = {
  sourceResult: string;
  targetResult: string;
  target2d: string;
  bbfsDigits: string;
  hit: boolean;
};

export type Bbfs7TraditionalFormulaScore = {
  formulaCode: string;
  formulaName: string;
  total: number;
  masuk: number;
  zonk: number;
  winrate: number;
  latest7Masuk: number;
  maxZonkStreak: number;
  bbfsDigits: string;
  lolos: boolean;
  details: Bbfs7TraditionalDetail[];
};

export type Bbfs7TraditionalVoteScore = {
  digit: string;
  vote: number;
};

export type Bbfs7TraditionalResult = {
  targetPair: TargetPair;
  historyCount: number;
  transitionCount: number;
  window: number;
  threshold: number;
  formulaCount: number;
  lolosCount: number;
  latestResult: string | null;
  nextBbfsDigits: string | null;
  voteRanking: Bbfs7TraditionalVoteScore[];
  ranking: Bbfs7TraditionalFormulaScore[];
  lolosFormulas: Bbfs7TraditionalFormulaScore[];
  selectedFormula: Bbfs7TraditionalFormulaScore | null;
  note: string;
};

export const BBFS7_TRADITIONAL_WINDOW = 14;
export const BBFS7_TRADITIONAL_THRESHOLD = 12;

const INDEX_MAP: Record<number, number> = { 0: 5, 1: 6, 2: 7, 3: 8, 4: 9, 5: 0, 6: 1, 7: 2, 8: 3, 9: 4 };
const LEMAH_MAP: Record<number, number> = { 0: 1, 1: 0, 2: 5, 5: 2, 3: 8, 8: 3, 4: 7, 7: 4, 6: 9, 9: 6 };
const BAYANG_MAP: Record<number, number> = { 0: 8, 8: 0, 1: 7, 7: 1, 2: 6, 6: 2, 3: 9, 9: 3, 4: 5, 5: 4 };
const TESSON_MAP: Record<number, number> = { 0: 7, 7: 0, 1: 4, 4: 1, 2: 9, 9: 2, 3: 6, 6: 3, 5: 8, 8: 5 };

const DEFAULT_FILL_KEYS = [
  "X",
  "Y",
  "JXY",
  "DXY",
  "IX",
  "IY",
  "TX",
  "TY",
  "BX",
  "BY",
  "LX",
  "LY",
  "X+1",
  "Y+1",
  "X-1",
  "Y-1",
  "A",
  "B",
  "C",
  "D",
  "SUM4",
  "JAK",
  "JKH",
  "JHE",
  "JAE",
  "JAH",
  "JKE",
];

export const BBFS7_TRADITIONAL_FORMULAS: Bbfs7TraditionalFormula[] = [
  { code: "R01", name: "DARK FORCE", keys: ["X", "Y", "IX", "IY", "TX", "TY", "JXY"] },
  { code: "R02", name: "SHADOW GATE", keys: ["X", "Y", "BX", "BY", "TX", "TY", "IJXY"] },
  { code: "R03", name: "PHANTOM LOCK", keys: ["JXY", "IJXY", "LJXY", "BJXY", "TJXY", "JXY+1", "JXY-1"] },
  { code: "R04", name: "BLACK TENSION", keys: ["DXY", "IDXY", "LDXY", "BDXY", "TDXY", "DXY+1", "DXY-1"] },
  { code: "R05", name: "NIGHT CORE", keys: ["X", "Y", "JXY", "DXY", "IX", "BY", "TX"] },
  { code: "R06", name: "IRON PATH", keys: ["X", "X+1", "X+2", "X+3", "Y", "IX", "TX"] },
  { code: "R07", name: "GHOST LINE", keys: ["Y", "Y+1", "Y+2", "Y+3", "X", "IY", "TY"] },
  { code: "R08", name: "VOID LOCK", keys: ["X", "Y", "MXY", "IMXY", "BMXY", "TMXY", "JXY"] },

  { code: "R09", name: "INDEX STORM", keys: ["IX", "IY", "X", "Y", "TIX", "TIY", "JXY"] },
  { code: "R10", name: "SILENT MIRROR", keys: ["LX", "LY", "X", "Y", "TLX", "TLY", "JXY"] },
  { code: "R11", name: "BLOOD SHADOW", keys: ["BX", "BY", "X", "Y", "TBX", "TBY", "JXY"] },
  { code: "R12", name: "TESSON BLADE", keys: ["TX", "TY", "X", "Y", "ITX", "ITY", "JXY"] },
  { code: "R13", name: "CROSS VENOM", keys: ["IX", "BY", "TIX", "TBY", "JXY", "DXY", "MXY"] },
  { code: "R14", name: "DARK TESSON", keys: ["TX", "LY", "BTX", "BLY", "JXY", "DXY", "Y+1"] },
  { code: "R15", name: "BAYANG STRIKE", keys: ["BX", "TY", "IBX", "ITY", "JXY", "DXY", "X-1"] },
  { code: "R16", name: "LUNAR LOCK", keys: ["LX", "IY", "TLX", "BIY", "JXY", "DXY", "Y-1"] },

  { code: "R17", name: "TOTAL VOID", keys: ["SUM4", "ISUM4", "LSUM4", "BSUM4", "TSUM4", "SUM4+1", "SUM4-1"] },
  { code: "R18", name: "FRONT GATE", keys: ["JAK", "IJAK", "LJAK", "BJAK", "TJAK", "JAK+1", "JAK-1"] },
  { code: "R19", name: "MIDNIGHT CORE", keys: ["JKH", "IJKH", "LJKH", "BJKH", "TJKH", "JKH+1", "JKH-1"] },
  { code: "R20", name: "BACK FORCE", keys: ["JHE", "IJHE", "LJHE", "BJHE", "TJHE", "JHE+1", "JHE-1"] },
  { code: "R21", name: "DIAGONAL GHOST", keys: ["JAE", "IJAE", "LJAE", "BJAE", "TJAE", "JAE+1", "JAE-1"] },
  { code: "R22", name: "TWIN SHADOW", keys: ["JKH", "B", "C", "TB", "TC", "BJKH", "TJKH"] },
  { code: "R23", name: "ALPHA CROSS", keys: ["JAH", "A", "C", "TA", "TC", "BJAH", "TJAH"] },
  { code: "R24", name: "OMEGA CROSS", keys: ["JKE", "B", "D", "TB", "TD", "BJKE", "TJKE"] },
  { code: "R25", name: "BALANCE BREAKER", keys: ["JAK", "JHE", "IJAK", "IJHE", "TJAK", "TJHE", "SUM4"] },
  { code: "R26", name: "DOUBLE GATE", keys: ["JAE", "JKH", "IJAE", "IJKH", "TJAE", "TJKH", "SUM4"] },

  { code: "R27", name: "PAST LOCK", keys: ["PX", "PY", "IPX", "IPY", "TPX", "TPY", "PJXY"] },
  { code: "R28", name: "LEFT ECLIPSE", keys: ["X", "PX", "IX", "IPX", "TX", "TPX", "XPX"] },
  { code: "R29", name: "RIGHT ECLIPSE", keys: ["Y", "PY", "IY", "IPY", "TY", "TPY", "YPY"] },
  { code: "R30", name: "CROSS MEMORY", keys: ["X", "PY", "IX", "IPY", "TX", "TPY", "XPY"] },
  { code: "R31", name: "REVERSE MEMORY", keys: ["Y", "PX", "IY", "IPX", "TY", "TPX", "YPX"] },
  { code: "R32", name: "DELTA LEFT", keys: ["DXPX", "IDXPX", "LDXPX", "BDXPX", "TDXPX", "DXPX+1", "DXPX-1"] },
  { code: "R33", name: "DELTA RIGHT", keys: ["DYPY", "IDYPY", "LDYPY", "BDYPY", "TDYPY", "DYPY+1", "DYPY-1"] },
  { code: "R34", name: "DELTA CORE", keys: ["DJXY_PJXY", "IDJXY_PJXY", "LDJXY_PJXY", "BDJXY_PJXY", "TDJXY_PJXY", "DJXY_PJXY+1", "DJXY_PJXY-1"] },
  { code: "R35", name: "MEMORY LOCK", keys: ["XPX", "YPY", "IXPX", "IYPY", "TXPX", "TYPY", "PJXY"] },
  { code: "R36", name: "SHADOW MEMORY", keys: ["XPX", "YPY", "BXPX", "BYPY", "TXPX", "TYPY", "PJXY"] },
  { code: "R37", name: "TESSON MEMORY", keys: ["TXPX", "TYPY", "XPX", "YPY", "ITXPX", "ITYPY", "PJXY"] },
  { code: "R38", name: "TOTAL DELTA", keys: ["DSUM4_PSUM4", "IDSUM4_PSUM4", "LDSUM4_PSUM4", "BDSUM4_PSUM4", "TDSUM4_PSUM4", "DSUM4_PSUM4+1", "DSUM4_PSUM4-1"] },

  { code: "R39", name: "DEEP MEMORY", keys: ["QX", "QY", "IQX", "IQY", "TQX", "TQY", "QJXY"] },
  { code: "R40", name: "LAG FORCE", keys: ["X", "QX", "IX", "IQX", "TX", "TQX", "XQX"] },
  { code: "R41", name: "LAG SHADOW", keys: ["Y", "QY", "IY", "IQY", "TY", "TQY", "YQY"] },
  { code: "R42", name: "GHOST LAG", keys: ["X", "QY", "IX", "IQY", "TX", "TQY", "XQY"] },
  { code: "R43", name: "REVERSE LAG", keys: ["Y", "QX", "IY", "IQX", "TY", "TQX", "YQX"] },
  { code: "R44", name: "LAG DELTA LEFT", keys: ["DXQX", "IDXQX", "LDXQX", "BDXQX", "TDXQX", "DXQX+1", "DXQX-1"] },
  { code: "R45", name: "LAG DELTA RIGHT", keys: ["DYQY", "IDYQY", "LDYQY", "BDYQY", "TDYQY", "DYQY+1", "DYQY-1"] },
  { code: "R46", name: "DEEP DELTA", keys: ["DJXY_QJXY", "IDJXY_QJXY", "LDJXY_QJXY", "BDJXY_QJXY", "TDJXY_QJXY", "DJXY_QJXY+1", "DJXY_QJXY-1"] },
  { code: "R47", name: "DEEP BAYANG", keys: ["QX", "QY", "BQX", "BQY", "TQX", "TQY", "QJXY"] },
  { code: "R48", name: "DEEP TESSON", keys: ["TQX", "TQY", "QX", "QY", "ITQX", "ITQY", "QJXY"] },

  { code: "R49", name: "DARK MULTIPLY", keys: ["MXY", "IMXY", "LMXY", "BMXY", "TMXY", "MXY+1", "MXY-1"] },
  { code: "R50", name: "CROSS MULTIPLY", keys: ["MXPY", "IMXPY", "LMXPY", "BMXPY", "TMXPY", "MXPY+1", "MXPY-1"] },
  { code: "R51", name: "REVERSE MULTIPLY", keys: ["MYPX", "IMYPX", "LMYPX", "BMYPX", "TMYPX", "MYPX+1", "MYPX-1"] },
  { code: "R52", name: "DIAGONAL MULTIPLY", keys: ["MAE", "IMAE", "LMAE", "BMAE", "TMAE", "MAE+1", "MAE-1"] },
  { code: "R53", name: "MID MULTIPLY", keys: ["MKH", "IMKH", "LMKH", "BMKH", "TMKH", "MKH+1", "MKH-1"] },
  { code: "R54", name: "FRONTBACK MULTIPLY", keys: ["MAK", "MHE", "IMAK", "IMHE", "TMAK", "TMHE", "SUM4"] },
  { code: "R55", name: "RUN FORCE", keys: ["X", "X+1", "X+2", "X+3", "X-1", "IX", "TX"] },
  { code: "R56", name: "RUN SHADOW", keys: ["Y", "Y+1", "Y+2", "Y+3", "Y-1", "IY", "TY"] },
  { code: "R57", name: "RUN CORE", keys: ["JXY", "JXY+1", "JXY+2", "JXY+3", "JXY-1", "IJXY", "TJXY"] },
  { code: "R58", name: "RUN DELTA", keys: ["DXY", "DXY+1", "DXY+2", "DXY+3", "DXY-1", "IDXY", "TDXY"] },
  { code: "R59", name: "PAST RUN", keys: ["PJXY", "PJXY+1", "PJXY+2", "PJXY+3", "PJXY-1", "IPJXY", "TPJXY"] },
  { code: "R60", name: "TOTAL RUN", keys: ["SUM4", "SUM4+1", "SUM4+2", "SUM4+3", "SUM4-1", "ISUM4", "TSUM4"] },
];

function mod10(value: number) {
  return ((value % 10) + 10) % 10;
}

function j2d(a: number, b: number) {
  const sum = a + b;
  return sum >= 10 ? sum - 9 : sum;
}

function index5(value: number) {
  return INDEX_MAP[mod10(value)] ?? mod10(value + 5);
}

function lemah(value: number) {
  return LEMAH_MAP[mod10(value)] ?? mod10(value);
}

function bayang(value: number) {
  return BAYANG_MAP[mod10(value)] ?? mod10(value);
}

function tesson(value: number) {
  return TESSON_MAP[mod10(value)] ?? mod10(value);
}

function digitsOf(result: string): [number, number, number, number] | null {
  const value = String(result || "").trim();
  if (!/^\d{4}$/.test(value)) return null;
  return [Number(value[0]), Number(value[1]), Number(value[2]), Number(value[3])];
}

function targetIndexes(targetPair: TargetPair) {
  if (targetPair === "depan") return [0, 1] as const;
  if (targetPair === "tengah") return [1, 2] as const;
  return [2, 3] as const;
}

function setFeature(features: Record<string, number>, key: string, value: number) {
  const v = mod10(value);
  features[key] = v;
  features[`${key}+1`] = mod10(v + 1);
  features[`${key}-1`] = mod10(v - 1);
  features[`${key}+2`] = mod10(v + 2);
  features[`${key}-2`] = mod10(v - 2);
  features[`${key}+3`] = mod10(v + 3);
  features[`${key}-3`] = mod10(v - 3);
  features[`I${key}`] = index5(v);
  features[`L${key}`] = lemah(v);
  features[`B${key}`] = bayang(v);
  features[`T${key}`] = tesson(v);
}

function addResultFeatures(features: Record<string, number>, prefix: string, result: string, targetPair: TargetPair) {
  const digits = digitsOf(result);
  if (!digits) return null;
  const [a, b, c, d] = digits;
  const [leftIndex, rightIndex] = targetIndexes(targetPair);
  const x = digits[leftIndex];
  const y = digits[rightIndex];

  const tag = (name: string) => `${prefix}${name}`;
  setFeature(features, tag("A"), a);
  setFeature(features, tag("B"), b);
  setFeature(features, tag("C"), c);
  setFeature(features, tag("D"), d);
  setFeature(features, tag("X"), x);
  setFeature(features, tag("Y"), y);
  setFeature(features, tag("SUM4"), a + b + c + d);
  setFeature(features, tag("JXY"), j2d(x, y));
  setFeature(features, tag("DXY"), Math.abs(x - y));
  setFeature(features, tag("MXY"), x * y);

  if (!prefix) {
    setFeature(features, "JAK", j2d(a, b));
    setFeature(features, "JKH", j2d(b, c));
    setFeature(features, "JHE", j2d(c, d));
    setFeature(features, "JAE", j2d(a, d));
    setFeature(features, "JAH", j2d(a, c));
    setFeature(features, "JKE", j2d(b, d));
    setFeature(features, "DAK", Math.abs(a - b));
    setFeature(features, "DKH", Math.abs(b - c));
    setFeature(features, "DHE", Math.abs(c - d));
    setFeature(features, "MAK", a * b);
    setFeature(features, "MKH", b * c);
    setFeature(features, "MHE", c * d);
    setFeature(features, "MAE", a * d);
  }

  return { a, b, c, d, x, y };
}

function addCrossFeatures(features: Record<string, number>, current: ReturnType<typeof addResultFeatures>, previous: ReturnType<typeof addResultFeatures>, lag2: ReturnType<typeof addResultFeatures>) {
  if (!current || !previous || !lag2) return;
  setFeature(features, "XPX", j2d(current.x, previous.x));
  setFeature(features, "YPY", j2d(current.y, previous.y));
  setFeature(features, "XPY", j2d(current.x, previous.y));
  setFeature(features, "YPX", j2d(current.y, previous.x));
  setFeature(features, "DXPX", Math.abs(current.x - previous.x));
  setFeature(features, "DYPY", Math.abs(current.y - previous.y));
  setFeature(features, "DJXY_PJXY", Math.abs(j2d(current.x, current.y) - j2d(previous.x, previous.y)));
  setFeature(features, "DSUM4_PSUM4", Math.abs(current.a + current.b + current.c + current.d - (previous.a + previous.b + previous.c + previous.d)));
  setFeature(features, "MXPY", current.x * previous.y);
  setFeature(features, "MYPX", current.y * previous.x);

  setFeature(features, "XQX", j2d(current.x, lag2.x));
  setFeature(features, "YQY", j2d(current.y, lag2.y));
  setFeature(features, "XQY", j2d(current.x, lag2.y));
  setFeature(features, "YQX", j2d(current.y, lag2.x));
  setFeature(features, "DXQX", Math.abs(current.x - lag2.x));
  setFeature(features, "DYQY", Math.abs(current.y - lag2.y));
  setFeature(features, "DJXY_QJXY", Math.abs(j2d(current.x, current.y) - j2d(lag2.x, lag2.y)));
}

function makeFeatures(currentResult: string, previousResult: string, lag2Result: string, targetPair: TargetPair) {
  const features: Record<string, number> = {};
  const current = addResultFeatures(features, "", currentResult, targetPair);
  const previous = addResultFeatures(features, "P", previousResult, targetPair);
  const lag2 = addResultFeatures(features, "Q", lag2Result, targetPair);
  addCrossFeatures(features, current, previous, lag2);
  return current && previous && lag2 ? features : null;
}

export function makeTraditionalBbfs7(currentResult: string, previousResult: string, lag2Result: string, targetPair: TargetPair, keys: string[]) {
  const features = makeFeatures(currentResult, previousResult, lag2Result, targetPair);
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

  for (let digit = 0; digit <= 9 && output.length < 7; digit++) addDigit(digit);
  return output.slice(0, 7).sort((a, b) => a - b).join("");
}

export function target2D(result: string, targetPair: TargetPair) {
  const value = String(result || "").trim();
  if (!/^\d{4}$/.test(value)) return "";
  if (targetPair === "depan") return value.slice(0, 2);
  if (targetPair === "tengah") return value.slice(1, 3);
  return value.slice(2, 4);
}

function maxZonkStreak(details: Bbfs7TraditionalDetail[]) {
  let current = 0;
  let max = 0;
  for (const detail of details) {
    if (detail.hit) current = 0;
    else {
      current += 1;
      max = Math.max(max, current);
    }
  }
  return max;
}

function evaluateFormula(history: string[], formula: Bbfs7TraditionalFormula, targetPair: TargetPair): Bbfs7TraditionalFormulaScore {
  const details: Bbfs7TraditionalDetail[] = [];
  const startIndex = Math.max(3, history.length - BBFS7_TRADITIONAL_WINDOW);

  for (let targetIndex = startIndex; targetIndex < history.length; targetIndex++) {
    const sourceResult = history[targetIndex - 1];
    const previousResult = history[targetIndex - 2];
    const lag2Result = history[targetIndex - 3];
    const targetResult = history[targetIndex];
    const bbfsDigits = makeTraditionalBbfs7(sourceResult, previousResult, lag2Result, targetPair, formula.keys);
    const target = target2D(targetResult, targetPair);
    const hit = Boolean(target && bbfsDigits.includes(target[0]) && bbfsDigits.includes(target[1]));
    details.push({ sourceResult, targetResult, target2d: target, bbfsDigits, hit });
  }

  const masuk = details.filter((detail) => detail.hit).length;
  const total = details.length;
  const latest7Masuk = details.slice(-7).filter((detail) => detail.hit).length;
  const latestResult = history[history.length - 1] || "";
  const previousResult = history[history.length - 2] || "";
  const lag2Result = history[history.length - 3] || "";

  return {
    formulaCode: formula.code,
    formulaName: formula.name,
    total,
    masuk,
    zonk: total - masuk,
    winrate: total ? Number(((masuk / total) * 100).toFixed(2)) : 0,
    latest7Masuk,
    maxZonkStreak: maxZonkStreak(details),
    bbfsDigits: makeTraditionalBbfs7(latestResult, previousResult, lag2Result, targetPair, formula.keys),
    lolos: total === BBFS7_TRADITIONAL_WINDOW && masuk >= BBFS7_TRADITIONAL_THRESHOLD,
    details,
  };
}

function sortScores(scores: Bbfs7TraditionalFormulaScore[]) {
  return [...scores].sort((a, b) => {
    if (Number(b.lolos) !== Number(a.lolos)) return Number(b.lolos) - Number(a.lolos);
    if (b.masuk !== a.masuk) return b.masuk - a.masuk;
    if (b.latest7Masuk !== a.latest7Masuk) return b.latest7Masuk - a.latest7Masuk;
    if (a.maxZonkStreak !== b.maxZonkStreak) return a.maxZonkStreak - b.maxZonkStreak;
    return a.formulaCode.localeCompare(b.formulaCode);
  });
}

function buildVoting(lolosFormulas: Bbfs7TraditionalFormulaScore[]) {
  const votes: Record<string, number> = {};
  for (let digit = 0; digit <= 9; digit++) votes[String(digit)] = 0;

  for (const formula of lolosFormulas) {
    for (const digit of formula.bbfsDigits) {
      votes[digit] = (votes[digit] || 0) + 1;
    }
  }

  const voteRanking = Object.entries(votes)
    .map(([digit, vote]) => ({ digit, vote }))
    .sort((a, b) => (b.vote !== a.vote ? b.vote - a.vote : Number(a.digit) - Number(b.digit)));

  const votingDigits = voteRanking
    .filter((item) => item.vote > 0)
    .slice(0, 7)
    .map((item) => Number(item.digit))
    .sort((a, b) => a - b)
    .join("");

  return { voteRanking, votingDigits: votingDigits.length === 7 ? votingDigits : null };
}

export function runBbfs7TraditionalWalkForward(rawHistory: string[], targetPair: TargetPair): Bbfs7TraditionalResult {
  const history = rawHistory.map((item) => String(item).trim()).filter((item) => /^\d{4}$/.test(item));
  const transitionCount = Math.max(history.length - 3, 0);

  if (transitionCount < BBFS7_TRADITIONAL_WINDOW) {
    return {
      targetPair,
      historyCount: history.length,
      transitionCount,
      window: BBFS7_TRADITIONAL_WINDOW,
      threshold: BBFS7_TRADITIONAL_THRESHOLD,
      formulaCount: BBFS7_TRADITIONAL_FORMULAS.length,
      lolosCount: 0,
      latestResult: history[history.length - 1] || null,
      nextBbfsDigits: null,
      voteRanking: [],
      ranking: [],
      lolosFormulas: [],
      selectedFormula: null,
      note: `Minimal butuh ${BBFS7_TRADITIONAL_WINDOW + 3} result untuk walk-forward ${BBFS7_TRADITIONAL_WINDOW} data.`,
    };
  }

  const ranking = sortScores(BBFS7_TRADITIONAL_FORMULAS.map((formula) => evaluateFormula(history, formula, targetPair)));
  const lolosFormulas = ranking.filter((formula) => formula.lolos);
  const { voteRanking, votingDigits } = buildVoting(lolosFormulas);

  return {
    targetPair,
    historyCount: history.length,
    transitionCount,
    window: BBFS7_TRADITIONAL_WINDOW,
    threshold: BBFS7_TRADITIONAL_THRESHOLD,
    formulaCount: BBFS7_TRADITIONAL_FORMULAS.length,
    lolosCount: lolosFormulas.length,
    latestResult: history[history.length - 1] || null,
    nextBbfsDigits: votingDigits,
    voteRanking,
    ranking,
    lolosFormulas,
    selectedFormula: lolosFormulas[0] || null,
    note: votingDigits
      ? `Voting dibentuk dari ${lolosFormulas.length} rumus lolos threshold ${BBFS7_TRADITIONAL_THRESHOLD}/${BBFS7_TRADITIONAL_WINDOW}.`
      : `Belum ada rumus lolos threshold ${BBFS7_TRADITIONAL_THRESHOLD}/${BBFS7_TRADITIONAL_WINDOW}.`,
  };
}
