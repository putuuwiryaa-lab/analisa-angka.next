"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  MARKETS_GC_TIME,
  MARKETS_QUERY_KEY,
  MARKETS_STALE_TIME,
  fetchMarkets,
} from "./client";

export function useMarketsQuery() {
  return useQuery({
    queryKey: MARKETS_QUERY_KEY,
    queryFn: fetchMarkets,
    staleTime: MARKETS_STALE_TIME,
    gcTime: MARKETS_GC_TIME,
    placeholderData: keepPreviousData,
    // The global provider disables mount/reconnect refetches. Markets are different:
    // reuse the shared cache while fresh, then refresh only after the 60s stale window.
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
}
