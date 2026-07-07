"use client";

import { createElement as h, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ClipboardCopy, Loader2, Share2 } from "lucide-react";
import { MODE_LABEL, REKAP_BADGE_OPTION, REKAP_MAX_MARKETS } from "./constants";
import type { MarketOption, PickItem, ShareOption, ShareResponse, ShareRow } from "./types";
import {
  buildPreviewText,
  buildShareText,
  displayMode,
  fetchJson,
  isRekapBadge,
  marketKey,
  marketLabel,
  marketOptionRow,
  optionSort,
  outputKey,
  outputLabel,
  targetKey,
  targetLabel,
  uniqueBy,
} from "./utils";

function optionModeKey(option: ShareOption | null) {
  return option ? displayMode(option) : "";
}

function optionLabelMode(option: ShareOption) {
  const mode = displayMode(option);
  return MODE_LABEL[mode] || mode.toUpperCase();
}

function optionMatchesMode(option: ShareOption, mode: string) {
  return displayMode(option) === mode;
}

function firstSorted(options: ShareOption[]) {
  return [...options].sort(optionSort)[0] || null;
}

export function SharePrediksiClient() {
  const router = useRouter();
  const [markets, setMarkets] = useState<ShareRow[]>([]);
  const [options, setOptions] = useState<ShareOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<ShareOption | null>(REKAP_BADGE_OPTION);
  const [rows, setRows] = useState<ShareRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const allOptions = useMemo(() => uniqueBy([REKAP_BADGE_OPTION, ...options].sort(optionSort), (option) => option.key), [options]);
  const selectedMode = optionModeKey(selectedOption);
  const selectedTarget = selectedOption ? targetKey(selectedOption) : "";
  const selectedOutput = selectedOption ? outputKey(selectedOption) : "";

  const jenisItems = useMemo<PickItem[]>(() => {
    return uniqueBy(allOptions, displayMode).map((option) => ({ key: displayMode(option), label: optionLabelMode(option) }));
  }, [allOptions]);

  const targetItems = useMemo<PickItem[]>(() => {
    return uniqueBy(allOptions.filter((option) => optionMatchesMode(option, selectedMode)), targetKey).map((option) => ({
      key: targetKey(option),
      label: targetLabel(option) || "Semua Posisi",
    }));
  }, [allOptions, selectedMode]);

  const outputItems = useMemo<PickItem[]>(() => {
    return uniqueBy(
      allOptions.filter((option) => optionMatchesMode(option, selectedMode) && targetKey(option) === selectedTarget),
      outputKey,
    ).map((option) => ({ key: outputKey(option), label: outputLabel(option) }));
  }, [allOptions, selectedMode, selectedTarget]);

  const selectedRows = useMemo(() => rows.filter((row) => selected.has(marketKey(row))), [rows, selected]);
  const shareText = useMemo(() => buildShareText(selectedOption, selectedRows), [selectedOption, selectedRows]);
  const previewText = useMemo(() => buildPreviewText(selectedOption, selectedRows), [selectedOption, selectedRows]);

  useEffect(() => {
    let active = true;
    setLoadingMarkets(true);
    setError("");
    fetchJson<MarketOption[]>("/api/markets")
      .then((items) => {
        if (!active) return;
        setMarkets(items.map(marketOptionRow).filter((row) => row.marketId));
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Gagal memuat pasaran.");
      })
      .finally(() => {
        if (active) setLoadingMarkets(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingOptions(true);
    fetchJson<ShareOption[]>("/api/share-predictions/options")
      .then((items) => {
        if (!active) return;
        setOptions(items.sort(optionSort));
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Gagal memuat pilihan prediksi.");
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function resetResult() {
    setRows([]);
    setCopied(false);
  }

  function chooseJenis(key: string) {
    const next = firstSorted(allOptions.filter((option) => optionMatchesMode(option, key)));
    if (!next) return;
    setSelectedOption(next);
    resetResult();
  }

  function chooseTarget(key: string) {
    const next = firstSorted(allOptions.filter((option) => optionMatchesMode(option, selectedMode) && targetKey(option) === key));
    if (!next) return;
    setSelectedOption(next);
    resetResult();
  }

  function chooseOutput(key: string) {
    const next = firstSorted(
      allOptions.filter((option) => optionMatchesMode(option, selectedMode) && targetKey(option) === selectedTarget && outputKey(option) === key),
    );
    if (!next) return;
    setSelectedOption(next);
    resetResult();
  }

  function toggle(row: ShareRow) {
    const key = marketKey(row);
    if (!key) return;
    resetResult();
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else {
        if (next.size >= REKAP_MAX_MARKETS) {
          setError(`Maksimal ${REKAP_MAX_MARKETS} pasaran sekali generate.`);
          return next;
        }
        next.add(key);
      }
      return next;
    });
  }

  function selectFirst() {
    resetResult();
    setSelected(new Set(markets.slice(0, REKAP_MAX_MARKETS).map(marketKey).filter(Boolean)));
  }

  function clearAll() {
    resetResult();
    setSelected(new Set());
  }

  async function generate() {
    if (!selectedOption) return setError("Pilih jenis prediksi dulu.");
    const ids = markets.filter((row) => selected.has(marketKey(row))).map((row) => String(row.marketId)).filter(Boolean);
    if (!ids.length) return setError("Pilih minimal satu pasaran.");
    if (ids.length > REKAP_MAX_MARKETS) return setError(`Maksimal ${REKAP_MAX_MARKETS} pasaran sekali generate.`);

    setLoadingRows(true);
    setRows([]);
    setCopied(false);
    setError("");

    try {
      if (isRekapBadge(selectedOption)) {
        const params = new URLSearchParams({ limit: String(REKAP_MAX_MARKETS), marketIds: ids.join(",") });
        const data = await fetchJson<ShareResponse>(`/api/share-predictions/rekap-badge?${params.toString()}`);
        setRows(data.rows || []);
        return;
      }

      const params = new URLSearchParams({
        mode: selectedOption.mode,
        param: String(selectedOption.param),
        targetPair: selectedOption.targetPair,
        analysisScope: selectedOption.analysisScope,
      });
      const data = await fetchJson<ShareResponse>(`/api/share-predictions?${params.toString()}`);
      const selectedSet = new Set(ids.map((item) => item.toLowerCase()));
      setRows((data.rows || []).filter((row) => selectedSet.has(String(row.marketId || "").toLowerCase())));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal generate share prediksi.");
    } finally {
      setLoadingRows(false);
    }
  }

  async function copyText() {
    if (!shareText) return;
    await navigator.clipboard?.writeText(shareText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function shareNow() {
    if (!shareText) return;
    if (navigator.share) return navigator.share({ text: shareText });
    await copyText();
  }

  const selectedTitle = selectedOption
    ? [optionLabelMode(selectedOption), targetLabel(selectedOption), outputLabel(selectedOption)].filter(Boolean).join(" · ")
    : "Pilih prediksi";
  const fallback = selected.size ? "Klik Generate untuk membuat Share Prediksi." : "Pilih jenis prediksi dan pasaran dulu.";

  return h("div", { className: "animate-rise pb-8" }, [
    h("button", { key: "back", type: "button", onClick: () => router.push("/"), className: "pressable depth-3 mb-3 inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black uppercase tracking-wide text-text-muted hover:border-border hover:bg-white/[0.06]" }, [h(ArrowLeft, { key: "i", size: 15 }), " Beranda"]),
    h("section", { key: "hero", className: "depth-1 mb-4 rounded-3xl border p-4 text-center" }, h("div", { className: "depth-2 rounded-3xl border px-4 py-6" }, [h("div", { key: "title", className: "display text-2xl text-text" }, "Share Prediksi"), h("p", { key: "desc", className: "mt-2 text-xs font-semibold leading-relaxed text-text-muted" }, `Pilih jenis prediksi, target, output, lalu generate maksimal ${REKAP_MAX_MARKETS} pasaran.`), h("p", { key: "active", className: "mt-3 text-[11px] font-black uppercase tracking-wide text-accent" }, selectedTitle)])),
    error ? h("div", { key: "err", className: "mb-4 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-center text-xs font-bold text-danger" }, error) : null,
    h("section", { key: "pickers", className: "depth-1 mb-4 rounded-3xl border p-4" }, [
      h("div", { key: "head", className: "mb-3 flex items-center justify-between gap-3 px-1" }, [h("span", { key: "t", className: "display text-xs text-text" }, "Pilihan Prediksi"), loadingOptions ? h(Loader2, { key: "l", size: 15, className: "animate-spin text-text-soft" }) : null]),
      renderPicker("Jenis", jenisItems, selectedMode, chooseJenis),
      renderPicker("Target", targetItems, selectedTarget, chooseTarget),
      renderPicker("Output", outputItems, selectedOutput, chooseOutput),
    ]),
    h("section", { key: "markets", className: "depth-1 mb-4 rounded-3xl border p-4" }, [h("div", { key: "head", className: "mb-3 flex items-center justify-between gap-3 px-1" }, [h("span", { key: "t", className: "display text-xs text-text" }, "Pilih Pasaran"), h("span", { key: "c", className: "text-[10px] font-black uppercase tracking-wide text-text-soft" }, `${selected.size}/${REKAP_MAX_MARKETS}`)]), renderMarkets()]),
    h("section", { key: "preview", className: "depth-1 rounded-3xl border p-4" }, [h("div", { key: "ph", className: "mb-3 flex items-center justify-between gap-3 px-1" }, [h("span", { key: "t", className: "display text-xs text-text" }, "Preview Singkat"), loadingRows ? h(Loader2, { key: "l", size: 15, className: "animate-spin text-text-soft" }) : null]), h("pre", { key: "pre", className: "depth-2 max-h-[48svh] min-h-[150px] overflow-y-auto whitespace-pre-wrap break-words rounded-3xl border p-4 font-mono text-[12px] font-bold leading-6 text-text" }, loadingRows ? "Memuat preview…" : previewText || fallback), h("div", { key: "actions", className: "mt-3 grid grid-cols-2 gap-2.5" }, [h("button", { key: "copy", type: "button", onClick: copyText, disabled: !shareText || loadingRows, className: "pressable depth-3 flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black uppercase tracking-wide text-text-muted hover:border-border hover:bg-white/[0.06] disabled:opacity-45" }, [h(ClipboardCopy, { key: "i", size: 16 }), copied ? "Tersalin" : "Copy"]), h("button", { key: "share", type: "button", onClick: shareNow, disabled: !shareText || loadingRows, className: "pressable depth-accent accent-text flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black uppercase tracking-wide disabled:opacity-45" }, [h(Share2, { key: "i", size: 16 }), "Share"])])]),
  ]);

  function renderPicker(label: string, items: PickItem[], activeKey: string, onPick: (key: string) => void) {
    if (!items.length) return null;
    return h("div", { key: label, className: "mb-3 last:mb-0" }, [
      h("div", { key: "label", className: "mb-2 px-1 text-[10px] font-black uppercase tracking-[0.18em] text-text-soft" }, label),
      h("div", { key: "items", className: "grid grid-cols-2 gap-2 sm:grid-cols-3" }, items.map((item) => {
        const active = item.key === activeKey;
        return h("button", { key: item.key, type: "button", onClick: () => onPick(item.key), className: active ? "pressable accent-bg-soft accent-border min-h-11 rounded-2xl border px-3 py-2 text-center text-[11px] font-black uppercase tracking-wide text-text" : "pressable depth-3 min-h-11 rounded-2xl border px-3 py-2 text-center text-[11px] font-black uppercase tracking-wide text-text-muted hover:border-border hover:bg-white/[0.06]" }, item.label);
      })),
    ]);
  }

  function renderMarkets() {
    if (loadingMarkets) return h("div", { className: "depth-2 rounded-2xl border p-4 text-center text-[11px] font-black uppercase tracking-wide text-text-muted" }, "Memuat pasaran…");
    if (markets.length === 0) return h("div", { className: "depth-2 rounded-2xl border p-4 text-center text-[11px] font-black uppercase tracking-wide text-text-muted" }, "Belum ada pasaran");
    return h("div", {}, [
      h("div", { key: "tools", className: "mb-3 grid grid-cols-2 gap-2" }, [h("button", { key: "first", type: "button", onClick: selectFirst, className: "pressable depth-3 rounded-2xl border px-3 py-2 text-[11px] font-black uppercase tracking-wide text-text-muted hover:border-border hover:bg-white/[0.06]" }, "Pilih 5 Pertama"), h("button", { key: "clear", type: "button", onClick: clearAll, className: "pressable depth-3 rounded-2xl border px-3 py-2 text-[11px] font-black uppercase tracking-wide text-text-muted hover:border-border hover:bg-white/[0.06]" }, "Kosongkan")]),
      h("div", { key: "grid", className: "grid grid-cols-3 gap-2 sm:grid-cols-4" }, markets.map((row) => {
        const key = marketKey(row);
        const active = selected.has(key);
        return h("button", { key: key || marketLabel(row), type: "button", onClick: () => toggle(row), className: active ? "pressable animate-soft-pop accent-bg-soft accent-border relative flex min-h-[58px] items-center justify-center rounded-2xl border px-2 py-2 text-center" : "pressable animate-soft-pop depth-1 relative flex min-h-[58px] items-center justify-center rounded-2xl border px-2 py-2 text-center hover:border-border hover:bg-surface-2" }, [active ? h("span", { key: "check", className: "absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white" }, h(Check, { size: 11, strokeWidth: 3.2 })) : null, h("span", { key: "label", className: "line-clamp-2 text-[9px] font-black leading-3 tracking-wide text-text" }, marketLabel(row))]);
      })),
      h("button", { key: "generate", type: "button", onClick: generate, disabled: loadingRows || selected.size === 0 || !selectedOption, className: "pressable depth-accent accent-text mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black uppercase tracking-wide disabled:opacity-45" }, [loadingRows ? h(Loader2, { key: "l", size: 15, className: "animate-spin" }) : null, "Generate"]),
    ]);
  }
}
