export type AccessRole = "TRIAL" | "PRO" | "MASTER";
export type LockableMode = string;
export type LockableScope = "default" | "2d_depan" | "2d_tengah" | "2d_belakang" | "3d" | "4d";
export type LockableTargetPair = "depan" | "tengah" | "belakang";
export type LockableCustomFocus = LockableTargetPair | "3d" | "4d";

export function isVipRole(role?: string | null) {
  return role === "TRIAL" || role === "PRO" || role === "MASTER";
}

export function isModeLockedForRole(role: string | null | undefined, mode: LockableMode) {
  void role;
  void mode;
  return false;
}

export function canUseStatistics(role: string | null | undefined) {
  void role;
  return true;
}

export function canUseEvaluationHistory(role: string | null | undefined) {
  void role;
  return true;
}

export function canUseAnalysisScope(role: string | null | undefined, mode: LockableMode, scope: LockableScope) {
  void role;
  void mode;
  void scope;
  return true;
}

export function canUseTargetPair(
  role: string | null | undefined,
  mode: LockableMode,
  targetPair: LockableTargetPair,
) {
  void role;
  void mode;
  void targetPair;
  return true;
}

export function canUseParam(
  role: string | null | undefined,
  mode: LockableMode,
  param: number,
  scope: LockableScope = "default",
  targetPair: LockableTargetPair = "belakang",
) {
  void role;
  void mode;
  void param;
  void scope;
  void targetPair;
  return true;
}

export function canUseCustomFocus(role: string | null | undefined, focus: LockableCustomFocus) {
  void role;
  void focus;
  return true;
}
