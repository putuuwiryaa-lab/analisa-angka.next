const SAFE_NEXT_BASE = "https://safe-next.invalid";
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

export function safeNextPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  const candidate = typeof value === "string" ? value.trim() : "";

  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    CONTROL_CHARACTER_PATTERN.test(candidate)
  ) {
    return fallback;
  }

  try {
    const resolved = new URL(candidate, SAFE_NEXT_BASE);
    if (resolved.origin !== SAFE_NEXT_BASE) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
