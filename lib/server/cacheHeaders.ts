import "server-only";

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

export const PRIVATE_SHORT_CACHE_HEADERS = {
  "Cache-Control": "private, max-age=30",
} as const;

export const PRIVATE_MEDIUM_CACHE_HEADERS = {
  "Cache-Control": "private, max-age=60",
} as const;
