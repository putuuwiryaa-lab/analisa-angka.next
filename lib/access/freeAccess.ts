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
  return isVipRole(role);
}

export function canUseEvaluationHistory(role: string | null | undefined) {
  return isVipRole(role);
}

export function canUseAnalysisScope(role: string | null | undefined, mode: LockableMode, scope: LockableScope) {
  void mode;
  void scope;
  return isVipRole(role);
}

export function canUseTargetPair(
  role: string | null | undefined,
  mode: LockableMode,
  targetPair: LockableTargetPair,
) {
  void mode;
  void targetPair;
  return isVipRole(role);
}

export function canUseParam(
  role: string | null | undefined,
  mode: LockableMode,
  param: number,
  scope: LockableScope = "default",
  targetPair: LockableTargetPair = "belakang",
) {
  void mode;
  void param;
  void scope;
  void targetPair;
  return isVipRole(role);
}

export function canUseCustomFocus(role: string | null | undefined, focus: LockableCustomFocus) {
  void focus;
  return isVipRole(role);
}
