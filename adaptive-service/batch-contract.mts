export type AdaptiveBatchTarget = "depan" | "tengah" | "belakang";
export type AdaptiveBatchMethod = "ai" | "bbfs";

export interface AdaptiveBatchRequest {
  marketIds: string[];
  target2D: AdaptiveBatchTarget;
  method: AdaptiveBatchMethod;
  digitCount: number;
  engineVersion: string;
  configVersion: string;
}

export type AdaptiveBatchRequestResult =
  | { ok: true; value: AdaptiveBatchRequest }
  | { ok: false; error: string };

const TARGETS = new Set<AdaptiveBatchTarget>(["depan", "tengah", "belakang"]);
const METHODS = new Set<AdaptiveBatchMethod>(["ai", "bbfs"]);
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:+/-]{0,127}$/;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseVersion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return VERSION_PATTERN.test(normalized) ? normalized : null;
}

export function parseAdaptiveBatchRequest(input: unknown): AdaptiveBatchRequestResult {
  const body = asRecord(input);
  const marketIds = Array.isArray(body.marketIds)
    ? [...new Set(body.marketIds.map((value) => String(value).trim()).filter(Boolean))]
    : [];
  const target2D = String(body.target2D ?? "") as AdaptiveBatchTarget;
  const method = String(body.method ?? "") as AdaptiveBatchMethod;
  const digitCount = Number(body.digitCount);
  const engineVersion = parseVersion(body.engineVersion);
  const configVersion = parseVersion(body.configVersion);

  if (!marketIds.length || marketIds.length > 35) {
    return { ok: false, error: "Pasaran harus berisi 1 sampai 35 item." };
  }
  if (!TARGETS.has(target2D)) {
    return { ok: false, error: "Target Adaptive tidak valid." };
  }
  if (!METHODS.has(method)) {
    return { ok: false, error: "Metode Adaptive tidak valid." };
  }
  if (!Number.isInteger(digitCount) || digitCount < 1 || digitCount > 9) {
    return { ok: false, error: "Jumlah digit Adaptive harus antara 1 dan 9." };
  }
  if (!engineVersion || !configVersion) {
    return { ok: false, error: "Versi engine dan konfigurasi Adaptive tidak valid." };
  }

  return {
    ok: true,
    value: {
      marketIds,
      target2D,
      method,
      digitCount,
      engineVersion,
      configVersion,
    },
  };
}
