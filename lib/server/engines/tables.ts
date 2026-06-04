import "server-only";
export const TBL_I: Record<string, number> = { "0": 5, "1": 6, "2": 7, "3": 8, "4": 9, "5": 0, "6": 1, "7": 2, "8": 3, "9": 4 };
export const TBL_L: Record<string, number> = { "0": 1, "1": 0, "2": 5, "5": 2, "3": 8, "8": 3, "4": 7, "7": 4, "6": 9, "9": 6 };
export const TBL_B: Record<string, number> = { "0": 8, "8": 0, "1": 7, "7": 1, "2": 6, "6": 2, "3": 9, "9": 3, "4": 5, "5": 4 };
export const TBL_T: Record<string, number> = { "0": 7, "1": 4, "2": 9, "3": 6, "4": 1, "5": 8, "6": 3, "7": 0, "8": 5, "9": 2 };

export const AI_I = TBL_I;
export const AI_L = TBL_L;
export const AI_B = TBL_B;
export const AI_T = TBL_T;
export const AI_P: Record<string, number> = { "0": 2, "1": 2, "2": 3, "3": 5, "4": 5, "5": 7, "6": 7, "7": 2, "8": 2, "9": 2 };

export function _0xc3c54e(x: number) { return ((x % 10) + 10) % 10; }
export function _0xJ2d(a: string | number, b: string | number) {
  const s = parseInt(a as string) + parseInt(b as string);
  return s >= 10 ? s - 9 : s;
}
