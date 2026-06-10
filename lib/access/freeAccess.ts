export type AccessRole = "FREE" | "TRIAL" | "PRO" | "MASTER";
export type LockableMode = string;
export type LockableScope = "default" | "2d_depan" | "2d_tengah" | "2d_belakang" | "3d" | "4d";
export type LockableTargetPair = "depan" | "tengah" | "belakang";
export type LockableCustomFocus = LockableTargetPair | "3d" | "4d";

const MODE_BBFS = "bbfs";
const MODE_A = "ai";
const MODE_REKAP = "rekap";
const MODE_JUMLAH = "jumlah";
const MODE_SHIO = "shio";
const MODE_BASIC_BLOCK = ["ma", "ti"].join("");

export const FREE_ACCESS = {
  ai: {
    scopes: ["2d_belakang"],
    params: [2, 4, 6, 7, 8],
  },
  basicBlock: {
    params: [1, 2, 3],
  },
  statistik: {
    full: false,
  },
  evaluationHistory: {
    full: true,
  },
} as const;

export function isVipRole(role?: string | null) {
  return role === "PRO" || role === "MASTER";
}

export function isModeLockedForRole(role: string | null | undefined, mode: LockableMode) {
  if (isVipRole(role)) return false;
  return mode === MODE_BBFS || mode === MODE_JUMLAH || mode === MODE_SHIO || mode === MODE_REKAP;
}

export function canUseStatistics(role: string | null | undefined) {
  return isVipRole(role);
}

export function canUseEvaluationHistory(role: string | null | undefined) {
  void role;
  return FREE_ACCESS.evaluationHistory.full;
}

export function canUseAnalysisScope(role: string | null | undefined, mode: LockableMode, scope: LockableScope) {
  if (isVipRole(role)) return true;
  if (mode === MODE_A) return FREE_ACCESS.ai.scopes.includes(scope as "2d_belakang");
  if (mode === MODE_BBFS) return false;
  return true;
}

export function canUseTargetPair(
  role: string | null | undefined,
  mode: LockableMode,
  targetPair: LockableTargetPair,
) {
  if (isVipRole(role)) return true;
  void targetPair;
  return mode !== MODE_JUMLAH && mode !== MODE_SHIO;
}

export function canUseParam(
  role: string | null | undefined,
  mode: LockableMode,
  param: number,
  scope: LockableScope = "default",
  targetPair: LockableTargetPair = "belakang",
) {
  if (isVipRole(role)) return true;

  void targetPair;
  if (mode === MODE_A) return scope === "2d_belakang" && FREE_ACCESS.ai.params.includes(param as 2 | 4 | 6 | 7 | 8);
  if (mode === MODE_BASIC_BLOCK) return FREE_ACCESS.basicBlock.params.includes(param as 1 | 2 | 3);
  if (mode === MODE_BBFS || mode === MODE_JUMLAH || mode === MODE_SHIO) return false;

  return false;
}

export function canUseCustomFocus(role: string | null | undefined, focus: LockableCustomFocus) {
  if (isVipRole(role)) return true;
  void focus;
  return false;
}
