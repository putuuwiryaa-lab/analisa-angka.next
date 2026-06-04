import { SHIO_2D } from "./constants";

export type TargetPair = "depan" | "tengah" | "belakang";
export type CustomFocus = TargetPair | "3d" | "4d";
export type PositionKey = "as" | "kop" | "kepala" | "ekor";
export type BBFSAnalysisScope = "4d" | "3d" | "2d_depan" | "2d_tengah" | "2d_belakang";

export const CUSTOM_FOCUS_OPTIONS: Array<{ key: CustomFocus; title: string; subtitle: string }> = [
  { key: "depan", title: "2D DEPAN", subtitle: "AS - KOP" },
  { key: "tengah", title: "2D TENGAH", subtitle: "KOP - KEPALA" },
  { key: "belakang", title: "2D BELAKANG", subtitle: "KEPALA - EKOR" },
  { key: "3d", title: "3D", subtitle: "KOP - KEPALA - EKOR" },
  { key: "4d", title: "4D", subtitle: "AS - KOP - KEPALA - EKOR" },
];

export const customFocusLabel = (focus: CustomFocus) => CUSTOM_FOCUS_OPTIONS.find((item) => item.key === focus)?.title || "2D BELAKANG";
export const customFocusSubtitle = (focus: CustomFocus) => CUSTOM_FOCUS_OPTIONS.find((item) => item.key === focus)?.subtitle || "KEPALA - EKOR";

export const customFocusPositions = (focus: CustomFocus): PositionKey[] => {
  if (focus === "depan") return ["as", "kop"];
  if (focus === "tengah") return ["kop", "kepala"];
  if (focus === "3d") return ["kop", "kepala", "ekor"];
  if (focus === "4d") return ["as", "kop", "kepala", "ekor"];
  return ["kepala", "ekor"];
};

export const customFocusPairs = (focus: CustomFocus): TargetPair[] => {
  if (focus === "depan") return ["depan"];
  if (focus === "tengah") return ["tengah"];
  if (focus === "3d") return ["tengah", "belakang"];
  if (focus === "4d") return ["depan", "tengah", "belakang"];
  return ["belakang"];
};

export const customFocusToBBFSScope = (focus: CustomFocus): BBFSAnalysisScope => {
  if (focus === "4d") return "4d";
  if (focus === "3d") return "3d";
  if (focus === "depan") return "2d_depan";
  if (focus === "tengah") return "2d_tengah";
  return "2d_belakang";
};

export const bbfsScopeToTargetPair = (scope: BBFSAnalysisScope): TargetPair => {
  if (scope === "2d_depan") return "depan";
  if (scope === "2d_tengah") return "tengah";
  return "belakang";
};

export const customFocusPositionLabels: Record<PositionKey, string> = {
  as: "AS",
  kop: "KOP",
  kepala: "KEPALA",
  ekor: "EKOR",
};

const jumlah2DLocal = (a: number, b: number) => {
  const s = a + b;
  return s >= 10 ? s - 9 : s;
};

const shioOf2DLocal = (n: number) => {
  for (const [shio, list] of Object.entries(SHIO_2D)) {
    if (list.includes(n)) return Number(shio);
  }
  return 1;
};

const pairDigits = (line: Record<PositionKey, number>, pair: TargetPair) => {
  if (pair === "depan") return [line.as, line.kop];
  if (pair === "tengah") return [line.kop, line.kepala];
  return [line.kepala, line.ekor];
};

const scopeDigits = (line: Record<PositionKey, number>, scope: "3d" | "4d") => {
  if (scope === "3d") return [line.kop, line.kepala, line.ekor];
  return [line.as, line.kop, line.kepala, line.ekor];
};

const digitParity = (digit: number) => digit % 2 === 0 ? "GENAP" : "GANJIL";
const digitSize = (digit: number) => digit >= 5 ? "BESAR" : "KECIL";

export const buildCustomDigitLines = ({
  focus = "belakang",
  aiByPair,
  aiParityByPair,
  aiSizeByPair,
  ai3d = [],
  ai3dParity = "",
  ai3dSize = "",
  ai4d = [],
  bbfsByPair,
  bbfsGlobal = [],
  offAs = [],
  offKop = [],
  offKepala = [],
  offEkor = [],
  jumlahByPair,
  shioByPair,
}: {
  focus?: CustomFocus;
  aiByPair?: Partial<Record<TargetPair, number[]>>;
  aiParityByPair?: Partial<Record<TargetPair, string>>;
  aiSizeByPair?: Partial<Record<TargetPair, string>>;
  ai3d?: number[];
  ai3dParity?: string;
  ai3dSize?: string;
  ai4d?: number[];
  bbfsByPair?: Partial<Record<TargetPair, number[]>>;
  bbfsGlobal?: number[];
  includeBBFS?: boolean;
  offAs?: number[];
  offKop?: number[];
  offKepala?: number[];
  offEkor?: number[];
  jumlahByPair?: Partial<Record<TargetPair, number[]>>;
  shioByPair?: Partial<Record<TargetPair, number[]>>;
}) => {
  const positions = customFocusPositions(focus);
  const pairs = customFocusPairs(focus);
  const offByPosition: Record<PositionKey, number[]> = { as: offAs, kop: offKop, kepala: offKepala, ekor: offEkor };
  const lines: string[] = [];

  const isAllowed = (line: Record<PositionKey, number>) => {
    for (const position of positions) {
      if ((offByPosition[position] || []).includes(line[position])) return false;
      if (bbfsGlobal.length && !bbfsGlobal.includes(line[position])) return false;
    }

    if (focus === "3d" || focus === "4d") {
      const digits3d = scopeDigits(line, "3d");
      if (ai3d.length && !digits3d.some((digit) => ai3d.includes(digit))) return false;
      if (ai3dParity && !digits3d.some((digit) => digitParity(digit) === ai3dParity)) return false;
      if (ai3dSize && !digits3d.some((digit) => digitSize(digit) === ai3dSize)) return false;
    }

    if (focus === "4d") {
      const digits4d = scopeDigits(line, "4d");
      if (ai4d.length && !digits4d.some((digit) => ai4d.includes(digit))) return false;
    }

    for (const pair of pairs) {
      const [a, b] = pairDigits(line, pair);
      const ai = aiByPair?.[pair] || [];
      const aiParity = aiParityByPair?.[pair] || "";
      const aiSize = aiSizeByPair?.[pair] || "";
      const bbfs = bbfsByPair?.[pair] || [];
      const offJumlah = jumlahByPair?.[pair] || [];
      const offShio = shioByPair?.[pair] || [];
      if (ai.length && !ai.includes(a) && !ai.includes(b)) return false;
      if (aiParity && digitParity(a) !== aiParity && digitParity(b) !== aiParity) return false;
      if (aiSize && digitSize(a) !== aiSize && digitSize(b) !== aiSize) return false;
      if (bbfs.length && (!bbfs.includes(a) || !bbfs.includes(b))) return false;
      if (offJumlah.includes(jumlah2DLocal(a, b))) return false;
      if (offShio.includes(shioOf2DLocal(a * 10 + b))) return false;
    }
    return true;
  };

  const walk = (index: number, line: Record<PositionKey, number>) => {
    if (index >= positions.length) {
      if (isAllowed(line)) lines.push(positions.map((position) => line[position]).join(""));
      return;
    }
    const position = positions[index];
    for (let digit = 0; digit <= 9; digit++) walk(index + 1, { ...line, [position]: digit });
  };

  walk(0, { as: 0, kop: 0, kepala: 0, ekor: 0 });
  return lines;
};
