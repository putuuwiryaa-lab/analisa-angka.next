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
export const BBFS7_TRADITIONAL_THRESHOLD = 10;

const INDEX_MAP: Record<number, number> = { 0: 5, 1: 6, 2: 7, 3: 8, 4: 9, 5: 0, 6: 1, 7: 2, 8: 3, 9: 4 };
const LEMAH_MAP: Record<number, number> = { 0: 1, 1: 0, 2: 5, 5: 2, 3: 8, 8: 3, 4: 7, 7: 4, 6: 9, 9: 6 };
const BAYANG_MAP: Record<number, number> = { 0: 8, 8: 0, 1: 7, 7: 1, 2: 6, 6: 2, 3: 9, 9: 3, 4: 5, 5: 4 };
const TESSON_MAP: Record<number, number> = { 0: 7, 7: 0, 1: 4, 4: 1, 2: 9, 9: 2, 3: 6, 6: 3, 5: 8, 8: 5 };

const DEFAULT_FILL_KEYS = ["X", "Y", "JXY", "DXY", "IX", "IY", "TX", "TY", "BX", "BY", "LX", "LY", "X+1", "Y+1", "X-1", "Y-1", "A", "B", "C", "D", "SUM4", "JAK", "JKH", "JHE", "JAE", "JAH", "JKE"];

const FORMULA_ROWS: Array<[string, string, string]> = [
  ["R01", "DARK FORCE", "X,Y,IX,IY,TX,TY,JXY"],
  ["R02", "SHADOW GATE", "X,Y,BX,BY,TX,TY,IJXY"],
  ["R03", "PHANTOM LOCK", "JXY,IJXY,LJXY,BJXY,TJXY,JXY+1,JXY-1"],
  ["R04", "BLACK TENSION", "DXY,IDXY,LDXY,BDXY,TDXY,DXY+1,DXY-1"],
  ["R05", "NIGHT CORE", "X,Y,JXY,DXY,IX,BY,TX"],
  ["R06", "IRON PATH", "X,X+1,X+2,X+3,Y,IX,TX"],
  ["R07", "GHOST LINE", "Y,Y+1,Y+2,Y+3,X,IY,TY"],
  ["R08", "VOID LOCK", "X,Y,MXY,IMXY,BMXY,TMXY,JXY"],
  ["R09", "INDEX STORM", "IX,IY,X,Y,TIX,TIY,JXY"],
  ["R10", "SILENT MIRROR", "LX,LY,X,Y,TLX,TLY,JXY"],
  ["R11", "BLOOD SHADOW", "BX,BY,X,Y,TBX,TBY,JXY"],
  ["R12", "TESSON BLADE", "TX,TY,X,Y,ITX,ITY,JXY"],
  ["R13", "CROSS VENOM", "IX,BY,TIX,TBY,JXY,DXY,MXY"],
  ["R14", "DARK TESSON", "TX,LY,BTX,BLY,JXY,DXY,Y+1"],
  ["R15", "BAYANG STRIKE", "BX,TY,IBX,ITY,JXY,DXY,X-1"],
  ["R16", "LUNAR LOCK", "LX,IY,TLX,BIY,JXY,DXY,Y-1"],
  ["R17", "TOTAL VOID", "SUM4,ISUM4,LSUM4,BSUM4,TSUM4,SUM4+1,SUM4-1"],
  ["R18", "FRONT GATE", "JAK,IJAK,LJAK,BJAK,TJAK,JAK+1,JAK-1"],
  ["R19", "MIDNIGHT CORE", "JKH,IJKH,LJKH,BJKH,TJKH,JKH+1,JKH-1"],
  ["R20", "BACK FORCE", "JHE,IJHE,LJHE,BJHE,TJHE,JHE+1,JHE-1"],
  ["R21", "DIAGONAL GHOST", "JAE,IJAE,LJAE,BJAE,TJAE,JAE+1,JAE-1"],
  ["R22", "TWIN SHADOW", "JKH,B,C,TB,TC,BJKH,TJKH"],
  ["R23", "ALPHA CROSS", "JAH,A,C,TA,TC,BJAH,TJAH"],
  ["R24", "OMEGA CROSS", "JKE,B,D,TB,TD,BJKE,TJKE"],
  ["R25", "BALANCE BREAKER", "JAK,JHE,IJAK,IJHE,TJAK,TJHE,SUM4"],
  ["R26", "DOUBLE GATE", "JAE,JKH,IJAE,IJKH,TJAE,TJKH,SUM4"],
  ["R27", "PAST LOCK", "PX,PY,IPX,IPY,TPX,TPY,PJXY"],
  ["R28", "LEFT ECLIPSE", "X,PX,IX,IPX,TX,TPX,XPX"],
  ["R29", "RIGHT ECLIPSE", "Y,PY,IY,IPY,TY,TPY,YPY"],
  ["R30", "CROSS MEMORY", "X,PY,IX,IPY,TX,TPY,XPY"],
  ["R31", "REVERSE MEMORY", "Y,PX,IY,IPX,TY,TPX,YPX"],
  ["R32", "DELTA LEFT", "DXPX,IDXPX,LDXPX,BDXPX,TDXPX,DXPX+1,DXPX-1"],
  ["R33", "DELTA RIGHT", "DYPY,IDYPY,LDYPY,BDYPY,TDYPY,DYPY+1,DYPY-1"],
  ["R34", "DELTA CORE", "DJXY_PJXY,IDJXY_PJXY,LDJXY_PJXY,BDJXY_PJXY,TDJXY_PJXY,DJXY_PJXY+1,DJXY_PJXY-1"],
  ["R35", "MEMORY LOCK", "XPX,YPY,IXPX,IYPY,TXPX,TYPY,PJXY"],
  ["R36", "SHADOW MEMORY", "XPX,YPY,BXPX,BYPY,TXPX,TYPY,PJXY"],
  ["R37", "TESSON MEMORY", "TXPX,TYPY,XPX,YPY,ITXPX,ITYPY,PJXY"],
  ["R38", "TOTAL DELTA", "DSUM4_PSUM4,IDSUM4_PSUM4,LDSUM4_PSUM4,BDSUM4_PSUM4,TDSUM4_PSUM4,DSUM4_PSUM4+1,DSUM4_PSUM4-1"],
  ["R39", "DEEP MEMORY", "QX,QY,IQX,IQY,TQX,TQY,QJXY"],
  ["R40", "LAG FORCE", "X,QX,IX,IQX,TX,TQX,XQX"],
  ["R41", "LAG SHADOW", "Y,QY,IY,IQY,TY,TQY,YQY"],
  ["R42", "GHOST LAG", "X,QY,IX,IQY,TX,TQY,XQY"],
  ["R43", "REVERSE LAG", "Y,QX,IY,IQX,TY,TQX,YQX"],
  ["R44", "LAG DELTA LEFT", "DXQX,IDXQX,LDXQX,BDXQX,TDXQX,DXQX+1,DXQX-1"],
  ["R45", "LAG DELTA RIGHT", "DYQY,IDYQY,LDYQY,BDYQY,TDYQY,DYQY+1,DYQY-1"],
  ["R46", "DEEP DELTA", "DJXY_QJXY,IDJXY_QJXY,LDJXY_QJXY,BDJXY_QJXY,TDJXY_QJXY,DJXY_QJXY+1,DJXY_QJXY-1"],
  ["R47", "DEEP BAYANG", "QX,QY,BQX,BQY,TQX,TQY,QJXY"],
  ["R48", "DEEP TESSON", "TQX,TQY,QX,QY,ITQX,ITQY,QJXY"],
  ["R49", "DARK MULTIPLY", "MXY,IMXY,LMXY,BMXY,TMXY,MXY+1,MXY-1"],
  ["R50", "CROSS MULTIPLY", "MXPY,IMXPY,LMXPY,BMXPY,TMXPY,MXPY+1,MXPY-1"],
  ["R51", "REVERSE MULTIPLY", "MYPX,IMYPX,LMYPX,BMYPX,TMYPX,MYPX+1,MYPX-1"],
  ["R52", "DIAGONAL MULTIPLY", "MAE,IMAE,LMAE,BMAE,TMAE,MAE+1,MAE-1"],
  ["R53", "MID MULTIPLY", "MKH,IMKH,LMKH,BMKH,TMKH,MKH+1,MKH-1"],
  ["R54", "FRONTBACK MULTIPLY", "MAK,MHE,IMAK,IMHE,TMAK,TMHE,SUM4"],
  ["R55", "RUN FORCE", "X,X+1,X+2,X+3,X-1,IX,TX"],
  ["R56", "RUN SHADOW", "Y,Y+1,Y+2,Y+3,Y-1,IY,TY"],
  ["R57", "RUN CORE", "JXY,JXY+1,JXY+2,JXY+3,JXY-1,IJXY,TJXY"],
  ["R58", "RUN DELTA", "DXY,DXY+1,DXY+2,DXY+3,DXY-1,IDXY,TDXY"],
  ["R59", "PAST RUN", "PJXY,PJXY+1,PJXY+2,PJXY+3,PJXY-1,IPJXY,TPJXY"],
  ["R60", "TOTAL RUN", "SUM4,SUM4+1,SUM4+2,SUM4+3,SUM4-1,ISUM4,TSUM4"],
];

export const BBFS7_TRADITIONAL_FORMULAS: Bbfs7TraditionalFormula[] = FORMULA_ROWS.map(([code, name, keys]) => ({
  code,
  name,
  keys: keys.split(","),
}));

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

function putFeature(features: Record<string, number>, key: string, value: number) {
  features[key] = mod10(value);
}

function expandFeature(features: Record<string, number>, key: string, value: number) {
  const v = mod10(value);
  putFeature(features, key, v);
  putFeature(features, `${key}+1`, v + 1);
  putFeature(features, `${key}-1`, v - 1);
  putFeature(features, `${key}+2`, v + 2);
  putFeature(features, `${key}-2`, v - 2);
  putFeature(features, `${key}+3`, v + 3);
  putFeature(features, `${key}-3`, v - 3);
  putFeature(features, `I${key}`, index5(v));
  putFeature(features, `L${key}`, lemah(v));
  putFeature(features, `B${key}`, bayang(v));
  putFeature(features, `T${key}`, tesson(v));
}

function expandDerivedFeatures(features: Record<string, number>) {
  const entries = Object.entries(features);
  for (const [key, value] of entries) {
    expandFeature(features, key, value);
  }
}

function addResultFeatures(features: Record<string, number>, prefix: string, result: string, targetPair: TargetPair) {
  const digits = digitsOf(result);
  if (!digits) return null;
  const [a, b, c, d] = digits;
  const [leftIndex, rightIndex] = targetIndexes(targetPair);
  const x = digits[leftIndex];
  const y = digits[rightIndex];

  const tag = (name: string) => `${prefix}${name}`;
  expandFeature(features, tag("A"), a);
  expandFeature(features, tag("B"), b);
  expandFeature(features, tag("C"), c);
  expandFeature(features, tag("D"), d);
  expandFeature(features, tag("X"), x);
  expandFeature(features, tag("Y"), y);
  expandFeature(features, tag("SUM4"), a + b + c + d);
  expandFeature(features, tag("JXY"), j2d(x, y));
  expandFeature(features, tag("DXY"), Math.abs(x - y));
  expandFeature(features, tag("MXY"), x * y);

  if (!prefix) {
    expandFeature(features, "JAK", j2d(a, b));
    expandFeature(features, "JKH", j2d(b, c));
    expandFeature(features, "JHE", j2d(c, d));
    expandFeature(features, "JAE", j2d(a, d));
    expandFeature(features, "JAH", j2d(a, c));
    expandFeature(features, "JKE", j2d(b, d));
    expandFeature(features, "MAK", a * b);
    expandFeature(features, "MKH", b * c);
    expandFeature(features, "MHE", c * d);
    expandFeature(features, "MAE", a * d);
  }

  return { a, b, c, d, x, y };
}

function addCrossFeatures(features: Record<string, number>, current: ReturnType<typeof addResultFeatures>, previous: ReturnType<typeof addResultFeatures>, lag2: ReturnType<typeof addResultFeatures>) {
  if (!current || !previous || !lag2) return;
  expandFeature(features, "XPX", j2d(current.x, previous.x));
  expandFeature(features, "YPY", j2d(current.y, previous.y));
  expandFeature(features, "XPY", j2d(current.x, previous.y));
  expandFeature(features, "YPX", j2d(current.y, previous.x));
  expandFeature(features, "DXPX", Math.abs(current.x - previous.x));
  expandFeature(features, "DYPY", Math.abs(current.y - previous.y));
  expandFeature(features, "DJXY_PJXY", Math.abs(j2d(current.x, current.y) - j2d(previous.x, previous.y)));
  expandFeature(features, "DSUM4_PSUM4", Math.abs(current.a + current.b + current.c + current.d - (previous.a + previous.b + previous.c + previous.d)));
  expandFeature(features, "MXPY", current.x * previous.y);
  expandFeature(features, "MYPX", current.y * previous.x);
  expandFeature(features, "XQX", j2d(current.x, lag2.x));
  expandFeature(features, "YQY", j2d(current.y, lag2.y));
  expandFeature(features, "XQY", j2d(current.x, lag2.y));
  expandFeature(features, "YQX", j2d(current.y, lag2.x));
  expandFeature(features, "DXQX", Math.abs(current.x - lag2.x));
  expandFeature(features, "DYQY", Math.abs(current.y - lag2.y));
  expandFeature(features, "DJXY_QJXY", Math.abs(j2d(current.x, current.y) - j2d(lag2.x, lag2.y)));
}

function makeFeatures(currentResult: string, previousResult: string, lag2Result: string, targetPair: TargetPair) {
  const features: Record<string, number> = {};
  const current = addResultFeatures(features, "", currentResult, targetPair);
  const previous = addResultFeatures(features, "P", previousResult, targetPair);
  const lag2 = addResultFeatures(features, "Q", lag2Result, targetPair);
  addCrossFeatures(features, current, previous, lag2);
  expandDerivedFeatures(features);
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
    for (const digit of formula.bbfsDigits) votes[digit] = (votes[digit] || 0) + 1;
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
