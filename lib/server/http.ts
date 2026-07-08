import "server-only";

function cleanIp(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw || raw.toLowerCase() === "unknown") return "";

  const withoutQuotes = raw.replace(/^"|"$/g, "");
  const withoutBrackets = withoutQuotes.startsWith("[") ? withoutQuotes.slice(1).split("]")[0] : withoutQuotes;

  // Strip IPv4 ports. Keep IPv6 values intact.
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(withoutBrackets)) {
    return withoutBrackets.split(":")[0];
  }

  return withoutBrackets;
}

function firstHeaderIp(value: string | null) {
  return cleanIp(value?.split(",")[0]);
}

function lastHeaderIp(value: string | null) {
  const parts = String(value || "").split(",").map((part) => cleanIp(part)).filter(Boolean);
  return parts.at(-1) || "";
}

export function getClientIp(headers: Headers): string {
  return (
    firstHeaderIp(headers.get("x-vercel-forwarded-for")) ||
    firstHeaderIp(headers.get("x-real-ip")) ||
    firstHeaderIp(headers.get("cf-connecting-ip")) ||
    firstHeaderIp(headers.get("true-client-ip")) ||
    lastHeaderIp(headers.get("x-forwarded-for")) ||
    "unknown"
  );
}
