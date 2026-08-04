const HISTORY_SEPARATOR_PATTERN = /[\s,;|]+/;

export function parseStrictHistory(historyData: string): string[] {
  const raw = historyData.trim();
  if (!raw) return [];

  const tokens = raw.split(HISTORY_SEPARATOR_PATTERN).filter(Boolean);
  const invalid = tokens
    .map((token, index) => ({ token, index: index + 1 }))
    .filter(({ token }) => !/^\d{4}$/.test(token))
    .map(({ token, index }) => `${token} (urutan ${index})`);

  if (invalid.length > 0) {
    const shown = invalid.slice(0, 5).join(", ");
    const extra = invalid.length > 5 ? `, dan ${invalid.length - 5} token lain` : "";
    throw new Error(`Format history_data salah. Semua result wajib 4 digit. Token salah: ${shown}${extra}.`);
  }

  return tokens;
}
