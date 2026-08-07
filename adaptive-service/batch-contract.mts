import { isAdaptiveSelection } from "./core/types.mts";

export type AdaptiveBatchTarget = "belakang";
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
  if (target2D !== "belakang") {
    return { ok: false, error: "Adaptive V2 hanya menyediakan target 2D belakang." };
  }
  if (method !== "ai" && method !== "bbfs") {
    return { ok: false, error: "Metode Adaptive tidak valid." };
  }
  if (!Number.isInteger(digitCount) || !isAdaptiveSelection(method, digitCount)) {
    return { ok: false, error: "Kombinasi metode dan jumlah digit Adaptive V2 tidak tersedia." };
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
