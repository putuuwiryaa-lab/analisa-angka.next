const HISTORY_SEPARATOR_PATTERN = /[\s,;|]+/;

export function tokenizeHistory(historyData: string): string[] {
  const raw = historyData.trim();
  if (!raw) return [];

  return raw.split(HISTORY_SEPARATOR_PATTERN).filter(Boolean);
}
