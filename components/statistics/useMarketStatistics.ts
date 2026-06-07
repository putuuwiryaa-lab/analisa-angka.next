"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  type AiStatScope,
  type AnalysisScope,
  type MarketStatistic,
  type RelatedStatsMap,
  type TargetPair,
  type VisibleCategoryKey,
} from "@/lib/analysis/statistics";

const STATISTICS_STALE_TIME = 5 * 60 * 1000;
const STATISTICS_GC_TIME = 30 * 60 * 1000;

export function aiParamOptions(scope: AiStatScope) {
  if (scope === "3d") return [1, 3, 5, 7, 8];
  if (scope === "4d") return [1, 2, 4];
  return [2, 4, 6, 7, 8];
}

async function fetchStatistics(args: {
  category: VisibleCategoryKey;
  targetPair: TargetPair;
  aiScope: AiStatScope;
  bbfsScope: AnalysisScope;
  param: number;
}): Promise<{ items: MarketStatistic[]; relatedStats: RelatedStatsMap }> {
  const params = new URLSearchParams({
    category: args.category,
    targetPair: args.targetPair,
    aiScope: args.aiScope,
    bbfsScope: args.bbfsScope,
    param: String(args.param),
  });

  const token = typeof window !== "undefined" ? localStorage.getItem("supreme_token") || "" : "";
  const response = await fetch(`/api/statistics?${params.toString()}`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const json = await response.json();

  if (!response.ok) throw new Error(json?.error || "Gagal memuat statistik pasaran");
  if (!json || !Array.isArray(json.items) || typeof json.relatedStats !== "object") {
    throw new Error("Format statistik dari server tidak valid");
  }

  return json;
}

export function useMarketStatistics() {
  const [category, setCategory] = useState<VisibleCategoryKey>("ai");
  const [targetPair, setTargetPair] = useState<TargetPair>("belakang");
  const [aiScope, setAiScope] = useState<AiStatScope>("2d_belakang");
  const [bbfsScope, setBbfsScope] = useState<AnalysisScope>("2d_belakang");
  const [param, setParam] = useState<number>(4);

  useEffect(() => {
    if (category === "ai" && !aiParamOptions(aiScope).includes(param)) setParam(aiParamOptions(aiScope)[0]);
    if (category === "bbfs" && ![7, 8, 9].includes(param)) setParam(8);
    if (!["ai", "bbfs"].includes(category) && ![1, 2, 3].includes(param)) setParam(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, aiScope]);

  const query = useQuery({
    queryKey: ["marketStatistics", category, targetPair, aiScope, bbfsScope, param],
    queryFn: () => fetchStatistics({ category, targetPair, aiScope, bbfsScope, param }),
    staleTime: STATISTICS_STALE_TIME,
    gcTime: STATISTICS_GC_TIME,
    placeholderData: keepPreviousData,
  });

  return {
    category,
    setCategory,
    targetPair,
    setTargetPair,
    aiScope,
    setAiScope,
    bbfsScope,
    setBbfsScope,
    param,
    setParam,
    items: query.data?.items ?? [],
    relatedStats: query.data?.relatedStats ?? {},
    loading: query.isPending && !query.data,
    error: query.error instanceof Error ? query.error.message : query.error ? "Belum bisa memuat statistik." : "",
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}
