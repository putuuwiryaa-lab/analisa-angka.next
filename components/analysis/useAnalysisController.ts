"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import type { CustomFocus, TargetPair } from "@/lib/analysis/customDigit";
import { analysisCacheKey, readAnalysisCache, writeAnalysisCache } from "@/lib/analysis/sessionCache";
import type { AnalysisScope } from "./ScopeSelectors";
import { postAnalyzeRequest } from "./analysisApiClient";
import { buildAnalysisControllerFlags } from "./analysisControllerFlags";
import {
  type FlowUrlState,
  parseAnalysisScope,
  parseCustomFocus,
  parseTargetPair,
  readParamFromUrl,
  requestScopeForAnalyze,
  targetPairFromScope,
} from "./analysisFlowUrl";
import { buildInvestPreset } from "./buildInvestPreset";
import {
  hasAnyCustomFilter,
  runCustomDigitGenerate,
  type PostAnalyze,
} from "./customDigitGenerate";
import { useCustomRekapState } from "./useCustomRekapState";
import { useMarketHistoryData } from "./useMarketHistoryData";

type ResultData = Record<string, any>;

export function useAnalysisController({ type, marketId }: { type: string; marketId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token } = useAuth();
  const { getMarketData } = useMarketHistoryData(marketId);
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const autoStartedRef = useRef(false);
  const investStartedRef = useRef(false);

  const autoMode = searchParams.get("auto") === "1";
  const autoParam = Number(searchParams.get("param"));
  const autoTargetPair = parseTargetPair(searchParams.get("target_pair"));
  const autoAnalysisScope = parseAnalysisScope(searchParams.get("analysis_scope"));
  const investPreset = searchParams.get("invest") === "1";
  const urlParam = readParamFromUrl(searchParams.get("param"));
  const urlScope = searchParams.has("analysis_scope") ? parseAnalysisScope(searchParams.get("analysis_scope")) : null;
  const urlTargetPair = searchParams.has("target_pair") ? parseTargetPair(searchParams.get("target_pair")) : null;
  const urlCustomFocus = parseCustomFocus(searchParams.get("custom_focus"));

  const initialFlags = buildAnalysisControllerFlags({
    type,
    param: autoMode && Number.isFinite(autoParam) && autoParam > 0 ? autoParam : type === "rekap" ? 3 : urlParam,
    targetPair: null,
    analysisScope: null,
    customFocus: urlCustomFocus,
    loading: false,
    result: null,
    autoMode,
  });

  const isAI = initialFlags.isAI;
  const isBBFS = initialFlags.isBBFS;
  const needsTargetPair = initialFlags.needsTargetPair;
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

  const rekap = useCustomRekapState(type === "rekap" ? urlCustomFocus : "belakang");
  const {
    customFocus,
    customAiDigitByPair,
    customAiParityByPair,
    customAiSizeByPair,
    customAi3dDigit,
    customAi3dParity,
    customAi3dSize,
    customAi4dDigit,
    customBBFSDigit,
    customBBFSDigitByPair,
    customOffAsCount,
    customOffKopCount,
    customOffKepalaCount,
    customOffEkorCount,
    customOffJumlahCountByPair,
    customOffShioCountByPair,
  } = rekap.state;

  const flags = buildAnalysisControllerFlags({
    type,
    param,
    targetPair,
    analysisScope,
    customFocus,
    loading,
    result,
    autoMode,
  });

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

  const resetBeforeAnalyze = () => {
    setLoading(true);
    setError("");
    setDetailValidationOpen(false);
    setAngkaJadiOpen(false);
  };

  const postAnalyze: PostAnalyze = (
    analysisType,
    data,
    analysisParam,
    analysisTargetPair = "belakang",
    scope = "default",
  ) =>
    postAnalyzeRequest({
      token,
      type: analysisType,
      data,
      param: analysisParam,
      targetPair: analysisTargetPair,
      scope,
    });

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
    rekap.setters.setCustomFocus(null);
    rekap.handlers.resetCustomRekapSelections();
    setResult(null);
    setError("");
    pushFlowUrl({});
  };

  const selectCustomFocus = (focus: CustomFocus) => {
    rekap.setters.setCustomFocus(focus);
    rekap.handlers.resetCustomRekapSelections();
    setResult(null);
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
    if (investPreset) return;

    const nextParam = readParamFromUrl(searchParams.get("param"));
    const nextScope = searchParams.has("analysis_scope") ? parseAnalysisScope(searchParams.get("analysis_scope")) : null;
    const nextTargetPair = searchParams.has("target_pair") ? parseTargetPair(searchParams.get("target_pair")) : null;
    const nextCustomFocus = parseCustomFocus(searchParams.get("custom_focus"));
    const hasResult = searchParams.get("result") === "1";
    const finalScope = nextScope || "default";
    const finalTargetPair = isAI || isBBFS ? targetPairFromScope(finalScope) : nextTargetPair || "belakang";

    if (type === "rekap") {
      rekap.setters.setCustomFocus(nextCustomFocus);
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

  const runCustomGenerate = async (genState: any) => {
    if (!genState.customFocus) return setError("Pilih jenis rekap dulu.");
    if (!hasAnyCustomFilter(genState)) return setError("Pilih minimal satu filter dulu.");

    pushFlowUrl({ customFocus: genState.customFocus, param: 3, result: true });
    resetBeforeAnalyze();

    try {
      const data = await getMarketData();
      setResult(await runCustomDigitGenerate(postAnalyze, data, genState));
    } catch (e: any) {
      setError(e.message || "Gagal generate custom digit");
    }

    setLoading(false);
  };

  const handleCustomDigitGenerate = () => runCustomGenerate(rekap.state);

  useEffect(() => {
    if (type !== "rekap" || !investPreset || investStartedRef.current) return;

    const focus = parseCustomFocus(searchParams.get("custom_focus"));
    if (!focus) return;

    investStartedRef.current = true;

    const preset = buildInvestPreset(searchParams, focus);
    rekap.handlers.applyCustomRekapState(preset);

    void runCustomGenerate(preset);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investPreset, type]);

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
    flags,
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
      setCustomAiDigitForPair: rekap.handlers.setCustomAiDigitForPair,
      customAiParityByPair,
      setCustomAiParityForPair: rekap.handlers.setCustomAiParityForPair,
      customAiSizeByPair,
      setCustomAiSizeForPair: rekap.handlers.setCustomAiSizeForPair,
      customAi3dDigit,
      setCustomAi3dDigit: rekap.setters.setCustomAi3dDigit,
      customAi3dParity,
      setCustomAi3dParity: rekap.setters.setCustomAi3dParity,
      customAi3dSize,
      setCustomAi3dSize: rekap.setters.setCustomAi3dSize,
      customAi4dDigit,
      setCustomAi4dDigit: rekap.setters.setCustomAi4dDigit,
      customBBFSDigit,
      setCustomBBFSDigit: rekap.setters.setCustomBBFSDigit,
      customBBFSDigitByPair,
      setCustomBBFSDigitForPair: rekap.handlers.setCustomBBFSDigitForPair,
      customOffAsCount,
      setCustomOffAsCount: rekap.setters.setCustomOffAsCount,
      customOffKopCount,
      setCustomOffKopCount: rekap.setters.setCustomOffKopCount,
      customOffKepalaCount,
      setCustomOffKepalaCount: rekap.setters.setCustomOffKepalaCount,
      customOffEkorCount,
      setCustomOffEkorCount: rekap.setters.setCustomOffEkorCount,
      customOffJumlahCountByPair,
      setCustomOffJumlahCountForPair: rekap.handlers.setCustomOffJumlahCountForPair,
      customOffShioCountByPair,
      setCustomOffShioCountForPair: rekap.handlers.setCustomOffShioCountForPair,
    },
  };
}
