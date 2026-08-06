import { tokenizeHistory } from "../shared/history";
import type { Draw } from "./types";

export class HistoryDataFormatError extends Error {
  invalidTokens: string[];

  constructor(invalidTokens: string[]) {
    const shown = invalidTokens.slice(0, 5).join(", ");
    const extra = invalidTokens.length > 5 ? `, dan ${invalidTokens.length - 5} token lain` : "";
    super(`Format history_data salah. Semua result wajib 4 digit. Token salah: ${shown}${extra}.`);
    this.name = "HistoryDataFormatError";
    this.invalidTokens = invalidTokens;
  }
}

export function parseStrictHistory(historyData: string): Draw[] {
  const tokens = tokenizeHistory(historyData);
  if (tokens.length === 0) return [];

  const invalidTokens = tokens
    .map((token, index) => ({ token, index: index + 1 }))
    .filter(({ token }) => !/^\d{4}$/.test(token))
    .map(({ token, index }) => `${token} (urutan ${index})`);

  if (invalidTokens.length > 0) {
    throw new HistoryDataFormatError(invalidTokens);
  }

  return tokens;
}

export function latestStrictHistoryResult(
  historyData: string | null | undefined,
): Draw | null {
  const draws = parseStrictHistory(String(historyData ?? ""));
  return draws.at(-1) ?? null;
}
