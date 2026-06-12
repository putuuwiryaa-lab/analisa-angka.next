import { deviceAuthHeader } from "@/lib/auth/device";
import type { CustomFocus } from "./customDigit";

/** Badge rekomendasi. Didefinisikan di sini; komponen mengimpor dari modul ini. */
export type RecommendationBadge = "thumb" | "fire";
export type RecommendedMap = Record<string, RecommendationBadge>;

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getStoredToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("aa_token") || "";
}

export async function loadCustomDigitRecommendations(
  marketId: string,
  customFocus: CustomFocus,
): Promise<RecommendedMap> {
  const params = new URLSearchParams({
    marketId: safeDecode(marketId).trim(),
    customFocus,
  });

  const token = getStoredToken();
  const response = await fetch(`/api/recommendations?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...deviceAuthHeader(),
    },
    cache: "no-store",
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json?.error || "Gagal memuat rekomendasi");
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};

  return json as RecommendedMap;
}
