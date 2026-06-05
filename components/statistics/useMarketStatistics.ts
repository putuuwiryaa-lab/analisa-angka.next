"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import {
  MARKET_STAT_SELECT,
  MAX_LOSS_STREAK_ALLOWED,
  MIN_WINS_15,
  MIN_WINS_LAST_5,
  aiParamGroupKey,
  aiParamStatParam,
  aiScopeMeta,
  bbfsScopeMeta,
  type AiStatScope,
  type AnalysisScope,
  type MarketStatistic,
  type RelatedStatsMap,
  type TargetPair,
  type VisibleCategoryKey,
} from "@/lib/analysis/statistics";

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
  const { category, targetPair, aiScope, bbfsScope, param } = args;
  const isPositionCategory = category === "off_digit";
  const isBBFSCategory = category === "bbfs";
  const isAICategory = category === "ai";
  const isPairCategory = category === "off_digit" || category === "off_jumlah" || category === "off_shio";

  const selectedBBFS = bbfsScopeMeta(bbfsScope);
  const selectedAI = aiScopeMeta(aiScope);
  const queryGroupKey = isAICategory ? aiParamGroupKey(param) : category;
  const queryParam = isAICategory ? aiParamStatParam(param) : param;

  let query = supabase
    .from("market_statistics")
    .select(MARKET_STAT_SELECT)
    .eq("is_active", true)
    .eq("group_key", queryGroupKey)
    .gte("wins_15", MIN_WINS_15)
    .gte("wins_last_5", MIN_WINS_LAST_5)
    .lte("max_loss_streak", MAX_LOSS_STREAK_ALLOWED)
    .order("score", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(200);

  if (isPositionCategory) {
    query = query.eq("mode", "mati_2d").eq("param", queryParam).eq("target_pair", targetPair).eq("analysis_scope", "default");
  } else if (isBBFSCategory) {
    query = query.eq("mode", "bbfs").eq("param", queryParam).eq("target_pair", selectedBBFS.targetPair).eq("analysis_scope", bbfsScope);
  } else if (isAICategory) {
    query = query.eq("param", queryParam).eq("target_pair", selectedAI.targetPair).eq("analysis_scope", selectedAI.analysisScope);
  } else {
    query = query.eq("param", queryParam).eq("analysis_scope", "default");
  }
  if (isPairCategory) query = query.eq("target_pair", targetPair);

  const { data, error } = await query;
  if (error) throw error;

  const rankingRows = (data || []) as MarketStatistic[];
  const marketIds = Array.from(new Set(rankingRows.map((item) => item.market_id).filter(Boolean)));
  if (!marketIds.length) return { items: rankingRows, relatedStats: {} };

  const { data: relatedData, error: relatedError } = await supabase
    .from("market_statistics")
    .select(MARKET_STAT_SELECT)
    .eq("is_active", true)
    .in("market_id", marketIds)
    .gte("wins_15", MIN_WINS_15)
    .gte("wins_last_5", MIN_WINS_LAST_5)
    .lte("max_loss_streak", MAX_LOSS_STREAK_ALLOWED)
    .order("score", { ascending: false })
    .limit(1000);
  if (relatedError) throw relatedError;

  const relatedStats = ((relatedData || []) as MarketStatistic[])
    .filter((row) => row.group_key !== "off_digit" || row.mode === "mati_2d")
    .reduce<RelatedStatsMap>((acc, row) => {
      (acc[row.market_id] ||= []).push(row);
      return acc;
    }, {});

  return { items: rankingRows, relatedStats };
}

export function useMarketStatistics() {
  const [category, setCategory] = useState<VisibleCategoryKey>("ai");
  const [targetPair, setTargetPair] = useState<TargetPair>("belakang");
  const [aiScope, setAiScope] = useState<AiStatScope>("2d_belakang");
  const [bbfsScope, setBbfsScope] = useState<AnalysisScope>("2d_belakang");
  const [param, setParam] = useState<number>(4);

  // Auto-koreksi param ketika kategori / scope AI berubah (sama seperti lama).
  useEffect(() => {
    if (category === "ai" && !aiParamOptions(aiScope).includes(param)) setParam(aiParamOptions(aiScope)[0]);
    if (category === "bbfs" && ![7, 8, 9].includes(param)) setParam(8);
    if (!["ai", "bbfs"].includes(category) && ![1, 2, 3].includes(param)) setParam(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, aiScope]);

  const query = useQuery({
    queryKey: ["marketStatistics", category, targetPair, aiScope, bbfsScope, param],
    queryFn: () => fetchStatistics({ category, targetPair, aiScope, bbfsScope, param }),
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
    loading: query.isLoading,
    error: query.error ? "Belum bisa memuat statistik." : "",
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
                                                                                                 }
         
