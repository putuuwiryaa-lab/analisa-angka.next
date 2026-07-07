import "server-only";

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

export const SHORT_PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
} as const;

export const MEDIUM_PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
} as const;
