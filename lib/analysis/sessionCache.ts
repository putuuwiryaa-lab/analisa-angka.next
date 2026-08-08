type AnalysisCachePayload = {
  result: Record<string, any>;
  savedAt: number;
  revision?: string;
};

const PREFIX = "analysis-result";
const TTL_MS = 30 * 60 * 1000;
const UNVERIFIED_TTL_MS = 60 * 1000;

function safePart(value: unknown) {
  return encodeURIComponent(String(value ?? "default"));
}

export function analysisCacheKey(args: {
  marketId: string;
  type: string;
  param: number | null;
  targetPair?: string | null;
  analysisScope?: string | null;
}) {
  return [
    PREFIX,
    safePart(args.marketId),
    safePart(args.type),
    safePart(args.param ?? 0),
    safePart(args.targetPair || "belakang"),
    safePart(args.analysisScope || "default"),
  ].join(":");
}

export function readAnalysisCache(key: string, expectedRevision?: string): Record<string, any> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnalysisCachePayload;
    if (!parsed?.result || !parsed.savedAt) return null;

    const age = Date.now() - parsed.savedAt;
    if (age > TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    if (expectedRevision !== undefined) {
      return parsed.revision === expectedRevision ? parsed.result : null;
    }

    // Without a current market revision we only trust a very recent result.
    // This keeps back/forward navigation instant while bounding stale data to the
    // same one-minute freshness window used by market history queries.
    return age <= UNVERIFIED_TTL_MS ? parsed.result : null;
  } catch {
    return null;
  }
}

export function writeAnalysisCache(key: string, result: Record<string, any>, revision?: string) {
  if (typeof window === "undefined") return;
  try {
    const payload: AnalysisCachePayload = { result, savedAt: Date.now(), revision };
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Storage can fail in private mode or when quota is full. Ignore safely.
  }
}
