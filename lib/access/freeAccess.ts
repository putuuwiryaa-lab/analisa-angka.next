export type AccessRole = "FREE" | "TRIAL" | "PRO" | "MASTER";
export type LockableMode = "ai" | "bbfs" | "mati" | "jumlah" | "shio" | "rekap";
export type LockableScope = "default" | "2d_depan" | "2d_tengah" | "2d_belakang" | "3d" | "4d";
export type LockableTargetPair = "depan" | "tengah" | "belakang";
export type LockableCustomFocus = LockableTargetPair | "3d" | "4d";

export const FREE_ACCESS = {
  ai: {
    scopes: ["2d_belakang"],
    params: [2, 4, 6, 7, 8],
  },
  bbfs: {
    scopes: ["2d_belakang"],
    params: [7, 8, 9],
  },
  mati: {
    params: [1, 2, 3],
  },
  jumlah: {
    targetPairs: ["belakang"],
    params: [1, 2, 3],
  },
  shio: {
    targetPairs: ["belakang"],
    params: [1, 2, 3],
  },
  statistik: {
    full: false,
  },
  evaluationHistory: {
    full: false,
  },
} as const;

export function isVipRole(role?: string | null) {
  return role === "PRO" || role === "MASTER";
}

export function isModeLockedForRole(role: string | null | undefined, mode: LockableMode) {
  if (isVipRole(role)) return false;
  return mode === "rekap";
}

export function canUseStatistics(role: string | null | undefined) {
  return isVipRole(role);
}

export function canUseEvaluationHistory(role: string | null | undefined) {
  return isVipRole(role);
}

export function canUseAnalysisScope(role: string | null | undefined, mode: LockableMode, scope: LockableScope) {
  if (isVipRole(role)) return true;
  if (mode === "ai") return FREE_ACCESS.ai.scopes.includes(scope as "2d_belakang");
  if (mode === "bbfs") return FREE_ACCESS.bbfs.scopes.includes(scope as "2d_belakang");
  return true;
}

export function canUseTargetPair(
  role: string | null | undefined,
  mode: LockableMode,
  targetPair: LockableTargetPair,
) {
  if (isVipRole(role)) return true;
  if (mode === "jumlah") return FREE_ACCESS.jumlah.targetPairs.includes(targetPair as "belakang");
  if (mode === "shio") return FREE_ACCESS.shio.targetPairs.includes(targetPair as "belakang");
  return true;
}

export function canUseParam(
  role: string | null | undefined,
  mode: LockableMode,
  param: number,
  scope: LockableScope = "default",
  targetPair: LockableTargetPair = "belakang",
) {
  if (isVipRole(role)) return true;

  if (mode === "ai") return scope === "2d_belakang" && FREE_ACCESS.ai.params.includes(param as 2 | 4 | 6 | 7 | 8);
  if (mode === "bbfs") return scope === "2d_belakang" && FREE_ACCESS.bbfs.params.includes(param as 7 | 8 | 9);
  if (mode === "mati") return FREE_ACCESS.mati.params.includes(param as 1 | 2 | 3);
  if (mode === "jumlah") return targetPair === "belakang" && FREE_ACCESS.jumlah.params.includes(param as 1 | 2 | 3);
  if (mode === "shio") return targetPair === "belakang" && FREE_ACCESS.shio.params.includes(param as 1 | 2 | 3);

  return false;
}

export function canUseCustomFocus(role: string | null | undefined, focus: LockableCustomFocus) {
  if (isVipRole(role)) return true;
  void focus;
  return false;
}
