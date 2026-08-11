const DEFAULT_MARKET_NAME = "PASARAN";

function compactMarketName(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/\s+/g, " ").trim();
}

/**
 * Formats a market name for display without changing its identifier.
 *
 * IDs, slugs, lookup keys, and API request values must keep using their
 * original value. This helper is only for user-facing labels.
 */
export function formatMarketName(value: unknown, fallback: unknown = DEFAULT_MARKET_NAME) {
  const name = compactMarketName(value) || compactMarketName(fallback) || DEFAULT_MARKET_NAME;
  return name.toLocaleUpperCase("id-ID");
}
