"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-context";
import { bbfsScopeToTargetPair, type CustomFocus, type TargetPair } from "@/lib/analysis/customDigit";
import {
  MARKETS_QUERY_KEY,
  MARKETS_STALE_TIME,
  extractHistoryData,
  fetchMarkets,
  findMarketByIdOrName,
  parseHistoryTokens,
  type Market,
} from "@/lib/markets/client";
import { BBFS_SCOPE_OPTIONS, type AnalysisScope } from "./ScopeSelectors";
import {
  hasAnyCustomFilter,
  runCustomDigitGenerate,
  type PairAiMap,
  type PairBoolMap,
  type PairCountMap,
  type PostAnalyze,
} from "./customDigitGenerate";

const VALID_TARGET_PAIRS: TargetPair[] = ["depan", "tengah", "belakang"];
type ResultData = Record<string, any>;

function parseTargetPair(value: string | null): TargetPair {
  return VALID_TARGET_PAIRS.includes(value as TargetPair) ? (value as TargetPair) : "belakang";
}
function parseAnalysisScope(value: string | null): AnalysisScope {
  return BBFS_SCOPE_OPTIONS.some((item) => item.key === value) ? (value as AnalysisScope) : "default";
}
function targetPairFromScope(scope: AnalysisScope): TargetPair {
  return scope === "default" ? "belakang" : bbfsScopeToTargetPair(scope);
}
function isAi2DScope(scope: AnalysisScope | null): boolean {
  return scope === "2d_depan" || scope === "2d_tengah" || scope === "2d_belakang";
}
function requestScopeForAnalyze(type: string, scope: AnalysisScope): AnalysisScope {
  if (type === "ai" && isAi2DScope(scope)) return "default";
  return scope;
}

export function useAnalysisController({ type, marketId }: { type: string; marketId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const autoStartedRef = useRef(false);

  const isAI = type === "ai";
  const needsTargetPair = ["jumlah", "shio"].includes(type);
  const isBBFS = type === "bbfs";

  const autoMode = searchParams.get("auto") === "1";
  const autoParam = Number(searchParams.get("param"));
  const autoTargetPair = parseTargetPair(searchParams.get("target_pair"));
  const autoAnalysisScope = parseAnalysisScope(searchParams.get("analysis_scope"));
  const initialParam =
    autoMode && Number.isFinite(autoParam) && autoParam > 0 ? autoParam : type === "rekap" ? 3 : 0;

  const [param, setParam] = useState<number | null>(initialParam);
  const [targetPair, setTargetPair] = useState<TargetPair | null>(
    needsTargetPair ? (autoMode ? autoTargetPair : null) : "belakang",
  );
  const [analysisScope, setAnalysisScope] = useState<AnalysisScope | null>(
    isAI || isBBFS ? (autoMode ? autoAnalysisScope : null) : "default",
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState("");
  const [detailValidationOpen, setDetailValidationOpen] = useState(false);
  const [angkaJadiOpen, setAngkaJadiOpen] = useState(false);
  const [customFocus, setCustomFocus] = useState<CustomFocus | null>(type === "rekap" ? null : "belakang");
  const [customAiDigitByPair, setCustomAiDigitByPair] = useState<PairAiMap>({});
  const [customAiParityByPair, setCustomAiParityByPair] = useState<PairBoolMap>({});
  const [customAiSizeByPair, setCustomAiSizeByPair] = useState<PairBoolMap>({});
  const [customAi3dDigit, setCustomAi3dDigit] = useState<1 | 3 | 5 | null>(null);
  const [customAi3dParity, setCustomAi3dParity] = useState(false);
  const [customAi3dSize, setCustomAi3dSize] = useState(false);
  const [customAi4dDigit, setCustomAi4dDigit] = useState<1 | 2 | 4 | null>(null);
  const [customBBFSDigit, setCustomBBFSDigit] = useState<7 | 8 | 9 | null>(null);
  const [customOffAsCount, setCustomOffAsCount] = useState<number | null>(null);
  const [customOffKopCount, setCustomOffKopCount] = useState<number | null>(null);
  const [customOffKepalaCount, setCustomOffKepalaCount] = useState<number | null>(null);
  const [customOffEkorCount, setCustomOffEkorCount] = useState<number | null>(null);
  const [customOffJumlahCountByPair, setCustomOffJumlahCountByPair] = useState<PairCountMap>({});
  const [customOffShioCountByPair, setCustomOffShioCountByPair] = useState<PairCountMap>({});

  const isRekapCustom = type === "rekap" && param === 3;

  const setCustomAiDigitForPair = (pair: TargetPair, value: 2 | 4 | 6 | null) =>
    setCustomAiDigitByPair((prev) => ({ ...prev, [pair]: value }));
  const setCustomAiParityForPair = (pair: TargetPair, value: boolean) =>
    setCustomAiParityByPair((prev) => ({ ...prev, [pair]: value }));
  const setCustomAiSizeForPair = (pair: TargetPair, value: boolean) =>
    setCustomAiSizeByPair((prev) => ({ ...prev, [pair]: value }));
  const setCustomOffJumlahCountForPair = (pair: TargetPair, value: number | null) =>
    setCustomOffJumlahCountByPair((prev) => ({ ...prev, [pair]: value }));
  const setCustomOffShioCountForPair = (pair: TargetPair, value: number | null) =>
    setCustomOffShioCountByPair((prev) => ({ ...prev, [pair]: value }));

  const resetBeforeAnalyze = () => {
    setLoading(true);
    setError("");
    setResult(null);
    setDetailValidationOpen(false);
    setAngkaJadiOpen(false);
  };

  const getMarkets = async () => {
    const cached = queryClient.getQueryData<Market[]>(MARKETS_QUERY_KEY);
    if (cached?.length) return cached;
    return queryClient.fetchQuery({
      queryKey: MARKETS_QUERY_KEY,
      queryFn: fetchMarkets,
      staleTime: MARKETS_STALE_TIME,
    });
  };

  const getMarketData = async () => {
    const markets = await getMarkets();
    const current = findMarketByIdOrName(markets, marketId);

    if (!current) throw new Error(`Data histori ${decodeURIComponent(marketId)} belum disetup oleh Admin!`);

    const data = parseHistoryTokens(extractHistoryData(current));
    if (data.length < 17) {
      throw new Error(`Data ${current.name || current.id || marketId} kurang. Minimal 17 result, terbaca ${data.length}.`);
    }
    return data;
  };

  const postAnalyze: PostAnalyze = async (
    analysisType,
    data,
    analysisParam,
    analysisTargetPair = "belakang",
    scope = "default",
  ) => {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        type: analysisType,
        data,
        param: analysisParam,
        target_pair: analysisTargetPair,
        analysis_scope: scope,
      }),
    });
    const json = await res.json();
    if (json.success || json.data) {
      return { ...(json.data || json), target_pair: json.target_pair, analysis_scope: json.analysis_scope };
    }
    throw new Error(json.error || "Gagal memproses analisa");
  };

  const handleTargetPairSelect = (pair: TargetPair) => {
    setTargetPair(pair);
    setParam(0);
    setResult(null);
    setError("");
  };
  const handleScopeSelect = (scope: Exclude<AnalysisScope, "default">) => {
    setAnalysisScope(scope);
    setTargetPair(targetPairFromScope(scope));
    setParam(0);
    setResult(null);
    setError("");
  };
  const resetScope = () => {
    setAnalysisScope(null);
    setParam(0);
    setResult(null);
    setError("");
  };
  const handleTargetPairReset = () => {
    setTargetPair(null);
    setParam(0);
    setResult(null);
    setError("");
  };
  const handleCustomFocusReset = () => {
    setCustomFocus(null);
    setCustomAi3dDigit(null);
    setCustomAi3dParity(false);
    setCustomAi3dSize(false);
    setCustomAi4dDigit(null);
    setCustomBBFSDigit(null);
    setResult(null);
    setError("");
  };
  const selectCustomFocus = (focus: CustomFocus) => {
    setCustomFocus(focus);
    setCustomAi3dDigit(null);
    setCustomAi3dParity(false);
    setCustomAi3dSize(false);
    setCustomAi4dDigit(null);
    setCustomBBFSDigit(null);
    setError("");
  };

  const stepBack = () => {
    if (loading) return true;
    if (result) {
      setResult(null);
      setError("");
      if (needsTargetPair) {
        setTargetPair(null);
        setParam(0);
      }
      if (isAI || isBBFS) {
        setAnalysisScope(null);
        setParam(0);
      }
      if (isRekapCustom) setCustomFocus(null);
      return true;
    }
    if (isRekapCustom && customFocus) {
      setCustomFocus(null);
      setError("");
      return true;
    }
    if ((isAI || isBBFS) && analysisScope) {
      setAnalysisScope(null);
      setParam(0);
      setError("");
      return true;
    }
    if (needsTargetPair && targetPair) {
      setTargetPair(null);
      setParam(0);
      setError("");
      return true;
    }
    return false;
  };

  const handleBack = () => {
    if (!stepBack()) router.push(`/analyze/${encodeURIComponent(marketId)}`);
  };

  const handleAnalyze = async (selectedParam: number, selectedTargetPair?: TargetPair) => {
    const selectedScope = analysisScope || "default";
    if (isAI && !analysisScope) return setError("Pilih jenis Angka Ikut dulu.");
    if (isBBFS && selectedScope === "default") return setError("Pilih jenis BBFS dulu.");
    const requestScope = requestScopeForAnalyze(type, selectedScope);
    const finalTargetPair =
      isBBFS || isAI ? targetPairFromScope(selectedScope) : selectedTargetPair || targetPair || "belakang";
    if (needsTargetPair && !finalTargetPair) return setError("Pilih fokus 2D dulu.");
    setTargetPair(finalTargetPair);
    setParam(selectedParam);
    resetBeforeAnalyze();
    try {
      const data = await getMarketData();
      setResult(await postAnalyze(type, data, selectedParam, finalTargetPair, requestScope));
      setDetailValidationOpen(false);
    } catch (e: any) {
      setError(e.message || "Error koneksi server");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!autoMode || autoStartedRef.current || type === "rekap") return;
    if (!Number.isFinite(autoParam) || autoParam <= 0) return;
    autoStartedRef.current = true;
    handleAnalyze(autoParam, autoTargetPair);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, autoParam, autoTargetPair, type]);

  const handleCustomDigitGenerate = async () => {
    if (!customFocus) return setError("Pilih jenis rekap dulu.");
    const state = {
      customFocus,
      customAiDigitByPair,
      customAiParityByPair,
      customAiSizeByPair,
      customAi3dDigit,
      customAi3dParity,
      customAi3dSize,
      customAi4dDigit,
      customBBFSDigit,
      customOffAsCount,
      customOffKopCount,
      customOffKepalaCount,
      customOffEkorCount,
      customOffJumlahCountByPair,
      customOffShioCountByPair,
    };
    if (!hasAnyCustomFilter(state)) return setError("Pilih minimal satu filter dulu.");
    resetBeforeAnalyze();
    try {
      const data = await getMarketData();
      setResult(await runCustomDigitGenerate(postAnalyze, data, state));
    } catch (e: any) {
      setError(e.message || "Gagal generate custom digit");
    }
    setLoading(false);
  };

  return {
    state: {
      param,
      targetPair,
      analysisScope,
      loading,
      result,
      error,
      customFocus,
      detailValidationOpen,
      setDetailValidationOpen,
      angkaJadiOpen,
      setAngkaJadiOpen,
    },
    flags: {
      isAI,
      isBBFS,
      isRekapCustom,
      needsTargetPair,
      autoMode,
      showAIScopeSelector: isAI && !analysisScope && !result && !loading,
      showTargetPairSelector: needsTargetPair && !targetPair && !result && !loading,
      showBBFSScopeSelector: isBBFS && !analysisScope && !result && !loading,
      showRekapFocusSelector: isRekapCustom && !customFocus && !result && !loading,
      showCustomDigitBuilder: isRekapCustom && Boolean(customFocus) && !result,
      get showParamSelector() {
        return (
          !this.showAIScopeSelector &&
          !this.showTargetPairSelector &&
          !this.showBBFSScopeSelector &&
          !this.showRekapFocusSelector
        );
      },
      canStartAnalyze: !result && !loading && param !== 0 && !isRekapCustom && !autoMode,
    },
    handlers: {
      handleBack,
      handleAnalyze,
      handleScopeSelect,
      handleTargetPairSelect,
      selectCustomFocus,
      resetScope,
      handleTargetPairReset,
      handleCustomFocusReset,
      handleCustomDigitGenerate,
    },
    custom: {
      customAiDigitByPair,
      setCustomAiDigitForPair,
      customAiParityByPair,
      setCustomAiParityForPair,
      customAiSizeByPair,
      setCustomAiSizeForPair,
      customAi3dDigit,
      setCustomAi3dDigit,
      customAi3dParity,
      setCustomAi3dParity,
      customAi3dSize,
      setCustomAi3dSize,
      customAi4dDigit,
      setCustomAi4dDigit,
      customBBFSDigit,
      setCustomBBFSDigit,
      customOffAsCount,
      setCustomOffAsCount,
      customOffKopCount,
      setCustomOffKopCount,
      customOffKepalaCount,
      setCustomOffKepalaCount,
      customOffEkorCount,
      setCustomOffEkorCount,
      customOffJumlahCountByPair,
      setCustomOffJumlahCountForPair,
      customOffShioCountByPair,
      setCustomOffShioCountForPair,
    },
  };
}
