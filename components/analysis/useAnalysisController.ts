"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-context";
import { bbfsScopeToTargetPair, type CustomFocus, type TargetPair } from "@/lib/analysis/customDigit";
import { analysisCacheKey, readAnalysisCache, writeAnalysisCache } from "@/lib/analysis/sessionCache";
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
const VALID_CUSTOM_FOCUS: CustomFocus[] = ["depan", "tengah", "belakang", "3d", "4d"];
type ResultData = Record<string, any>;

type FlowUrlState = {
  analysisScope?: AnalysisScope | null;
  targetPair?: TargetPair | null;
  customFocus?: CustomFocus | null;
  param?: number | null;
  result?: boolean;
};

function parseTargetPair(value: string | null): TargetPair {
  return VALID_TARGET_PAIRS.includes(value as TargetPair) ? (value as TargetPair) : "belakang";
}
function parseAnalysisScope(value: string | null): AnalysisScope {
  return BBFS_SCOPE_OPTIONS.some((item) => item.key === value) ? (value as AnalysisScope) : "default";
}
function parseCustomFocus(value: string | null): CustomFocus | null {
  return VALID_CUSTOM_FOCUS.includes(value as CustomFocus) ? (value as CustomFocus) : null;
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
function readParamFromUrl(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function useAnalysisController({ type, marketId }: { type: string; marketId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const autoStartedRef = useRef(false);

  const isAI = type === "ai";
  const needsTargetPair = ["jumlah", "shio"].includes(type);
  const isBBFS = type === "bbfs";

  const autoMode = searchParams.get("auto") === "1";
  const autoParam = Number(searchParams.get("param"));
  const autoTargetPair = parseTargetPair(searchParams.get("target_pair"));
  const autoAnalysisScope = parseAnalysisScope(searchParams.get("analysis_scope"));
  const urlParam = readParamFromUrl(searchParams.get("param"));
  const urlScope = searchParams.has("analysis_scope") ? parseAnalysisScope(searchParams.get("analysis_scope")) : null;
  const urlTargetPair = searchParams.has("target_pair") ? parseTargetPair(searchParams.get("target_pair")) : null;
  const urlCustomFocus = parseCustomFocus(searchParams.get("custom_focus"));
  const initialParam = autoMode && Number.isFinite(autoParam) && autoParam > 0 ? autoParam : type === "rekap" ? 3 : urlParam;

  const [param, setParam] = useState<number | null>(initialParam);
  const [targetPair, setTargetPair] = useState<TargetPair | null>(
    needsTargetPair ? (autoMode ? autoTargetPair : urlTargetPair) : "belakang",
  );
  const [analysisScope, setAnalysisScope] = useState<AnalysisScope | null>(
    isAI || isBBFS ? (autoMode ? autoAnalysisScope : urlScope) : "default",
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState("");
  const [detailValidationOpen, setDetailValidationOpen] = useState(false);
  const [angkaJadiOpen, setAngkaJadiOpen] = useState(false);
  const [customFocus, setCustomFocus] = useState<CustomFocus | null>(type === "rekap" ? urlCustomFocus : "belakang");
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

  const pushFlowUrl = (state: FlowUrlState) => {
    const params = new URLSearchParams();
    if (state.analysisScope && state.analysisScope !== "default") params.set("analysis_scope", state.analysisScope);
    if (state.targetPair) params.set("target_pair", state.targetPair);
    if (state.customFocus) params.set("custom_focus", state.customFocus);
    if (state.param && state.param > 0) params.set("param", String(state.param));
    if (state.result) params.set("result", "1");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

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
    pushFlowUrl({ targetPair: pair });
  };
  const handleScopeSelect = (scope: Exclude<AnalysisScope, "default">) => {
    const pair = targetPairFromScope(scope);
    setAnalysisScope(scope);
    setTargetPair(pair);
    setParam(0);
    setResult(null);
    setError("");
    pushFlowUrl({ analysisScope: scope, targetPair: pair });
  };
  const resetScope = () => {
    setAnalysisScope(null);
    setParam(0);
    setResult(null);
    setError("");
    pushFlowUrl({});
  };
  const handleTargetPairReset = () => {
    setTargetPair(null);
    setParam(0);
    setResult(null);
    setError("");
    pushFlowUrl({});
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
    pushFlowUrl({});
  };
  const selectCustomFocus = (focus: CustomFocus) => {
    setCustomFocus(focus);
    setCustomAi3dDigit(null);
    setCustomAi3dParity(false);
    setCustomAi3dSize(false);
    setCustomAi4dDigit(null);
    setCustomBBFSDigit(null);
    setError("");
    pushFlowUrl({ customFocus: focus, param: 3 });
  };

  const handleBack = () => {
    if (loading) return;
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(`/analyze/${encodeURIComponent(marketId)}`);
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
    setError("");
    pushFlowUrl({ analysisScope: selectedScope, targetPair: finalTargetPair, param: selectedParam, result: true });

    const cacheKey = analysisCacheKey({
      marketId,
      type,
      param: selectedParam,
      targetPair: finalTargetPair,
      analysisScope: selectedScope,
    });
    const cached = result ? null : readAnalysisCache(cacheKey);
    if (cached) {
      setResult(cached);
      setDetailValidationOpen(false);
      setAngkaJadiOpen(false);
      return;
    }

    resetBeforeAnalyze();
    try {
      const data = await getMarketData();
      const nextResult = await postAnalyze(type, data, selectedParam, finalTargetPair, requestScope);
      setResult(nextResult);
      writeAnalysisCache(cacheKey, nextResult);
      setDetailValidationOpen(false);
    } catch (e: any) {
      setError(e.message || "Error koneksi server");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (autoMode) return;
    const nextParam = readParamFromUrl(searchParams.get("param"));
    const nextScope = searchParams.has("analysis_scope") ? parseAnalysisScope(searchParams.get("analysis_scope")) : null;
    const nextTargetPair = searchParams.has("target_pair") ? parseTargetPair(searchParams.get("target_pair")) : null;
    const nextCustomFocus = parseCustomFocus(searchParams.get("custom_focus"));
    const hasResult = searchParams.get("result") === "1";
    const finalScope = nextScope || "default";
    const finalTargetPair = isAI || isBBFS ? targetPairFromScope(finalScope) : nextTargetPair || "belakang";

    if (type === "rekap") {
      setCustomFocus(nextCustomFocus);
    } else if (isAI || isBBFS) {
      setAnalysisScope(nextScope);
      setTargetPair(nextScope ? targetPairFromScope(nextScope) : "belakang");
    } else if (needsTargetPair) {
      setTargetPair(nextTargetPair);
    }

    setParam(type === "rekap" ? 3 : nextParam);

    if (hasResult && nextParam > 0 && type !== "rekap") {
      const cached = readAnalysisCache(
        analysisCacheKey({
          marketId,
          type,
          param: nextParam,
          targetPair: finalTargetPair,
          analysisScope: finalScope,
        }),
      );
      if (cached) {
        setResult(cached);
        setError("");
        setDetailValidationOpen(false);
        setAngkaJadiOpen(false);
        return;
      }
    }

    if (!hasResult || (hasResult && !result)) {
      setResult(null);
      setError("");
      setDetailValidationOpen(false);
      setAngkaJadiOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey, type]);

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
    pushFlowUrl({ customFocus, param: 3, result: true });
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
