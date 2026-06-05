type AnalysisCachePayload = {
  result: Record<string, any>;
  savedAt: number;
};

const PREFIX = "analysis-result";
const TTL_MS = 30 * 60 * 1000;

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

export function readAnalysisCache(key: string): Record<string, any> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnalysisCachePayload;
    if (!parsed?.result || !parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed.result;
  } catch {
    return null;
  }
}

export function writeAnalysisCache(key: string, result: Record<string, any>) {
  if (typeof window === "undefined") return;
  try {
    const payload: AnalysisCachePayload = { result, savedAt: Date.now() };
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Storage can fail in private mode or when quota is full. Ignore safely.
  }
}
