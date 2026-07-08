"use client";

import { createElement as h, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ClipboardCopy, Loader2, Share2 } from "lucide-react";
import { MODE_LABEL, REKAP_BADGE_OPTION, REKAP_MAX_MARKETS, SEPARATOR, SEPARATOR_OPTIONS } from "./constants";
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

function rowId(row: ShareRow) {
  return String(row.marketId || "").toLowerCase();
}

function orderRowsByIds(rows: ShareRow[], ids: string[]) {
  const byId = new Map(rows.map((row) => [rowId(row), row]));
  return ids.map((id) => byId.get(id.toLowerCase())).filter(Boolean) as ShareRow[];
}

export function SharePrediksiClient() {
  const router = useRouter();
  const [markets, setMarkets] = useState<ShareRow[]>([]);
  const [options, setOptions] = useState<ShareOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<ShareOption | null>(REKAP_BADGE_OPTION);
  const [selectedSeparator, setSelectedSeparator] = useState(SEPARATOR);
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
  const rekapBadgeSelected = isRekapBadge(selectedOption);

  const selectedMarketRows = useMemo(() => {
    const byKey = new Map(markets.map((row) => [marketKey(row), row]));
    return Array.from(selected).map((key) => byKey.get(key)).filter(Boolean) as ShareRow[];
  }, [markets, selected]);

  const selectedIds = useMemo(() => selectedMarketRows.map((row) => String(row.marketId)).filter(Boolean), [selectedMarketRows]);

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
  const shareText = useMemo(() => buildShareText(selectedOption, selectedRows, selectedSeparator), [selectedOption, selectedRows, selectedSeparator]);
  const previewText = useMemo(() => buildPreviewText(selectedOption, selectedRows, selectedSeparator), [selectedOption, selectedRows, selectedSeparator]);

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

  function chooseOption(next: ShareOption) {
    setSelectedOption(next);
    resetResult();

    if (isRekapBadge(next) && selected.size > REKAP_MAX_MARKETS) {
      setSelected((current) => new Set(Array.from(current).slice(0, REKAP_MAX_MARKETS)));
      setError(`Rekap Badge maksimal ${REKAP_MAX_MARKETS} pasaran sekali generate.`);
    }
  }

  function chooseJenis(key: string) {
    const next = firstSorted(allOptions.filter((option) => optionMatchesMode(option, key)));
    if (!next) return;
    chooseOption(next);
  }

  function chooseTarget(key: string) {
    const next = firstSorted(allOptions.filter((option) => optionMatchesMode(option, selectedMode) && targetKey(option) === key));
    if (!next) return;
    chooseOption(next);
  }

  function chooseOutput(key: string) {
    const next = firstSorted(
      allOptions.filter((option) => optionMatchesMode(option, selectedMode) && targetKey(option) === selectedTarget && outputKey(option) === key),
    );
    if (!next) return;
    chooseOption(next);
  }

  function chooseSeparator(key: string) {
    setSelectedSeparator(key || SEPARATOR);
    setCopied(false);
  }

  function toggle(row: ShareRow) {
    const key = marketKey(row);
    if (!key) return;
    resetResult();
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else {
        if (rekapBadgeSelected && next.size >= REKAP_MAX_MARKETS) {
          setError(`Rekap Badge maksimal ${REKAP_MAX_MARKETS} pasaran sekali generate.`);
          return next;
        }
        next.add(key);
      }
      return next;
    });
  }

  function selectQuick() {
    resetResult();
    const limit = rekapBadgeSelected ? REKAP_MAX_MARKETS : markets.length;
    setSelected(new Set(markets.slice(0, limit).map(marketKey).filter(Boolean)));
  }

  function clearAll() {
    resetResult();
    setSelected(new Set());
  }

  async function generate() {
    if (!selectedOption) return setError("Pilih jenis prediksi dulu.");
    if (!selectedIds.length) return setError("Pilih minimal satu pasaran.");
    if (isRekapBadge(selectedOption) && selectedIds.length > REKAP_MAX_MARKETS) {
      return setError(`Rekap Badge maksimal ${REKAP_MAX_MARKETS} pasaran sekali generate.`);
    }

    setLoadingRows(true);
    setRows([]);
    setCopied(false);
    setError("");

    try {
      if (isRekapBadge(selectedOption)) {
        const params = new URLSearchParams({ limit: String(REKAP_MAX_MARKETS), marketIds: selectedIds.join(",") });
        const data = await fetchJson<ShareResponse>(`/api/share-predictions/rekap-badge?${params.toString()}`);
        setRows(orderRowsByIds(data.rows || [], selectedIds));
        return;
      }

      const params = new URLSearchParams({
        mode: selectedOption.mode,
        param: String(selectedOption.param),
        targetPair: selectedOption.targetPair,
        analysisScope: selectedOption.analysisScope,
      });
      const data = await fetchJson<ShareResponse>(`/api/share-predictions?${params.toString()}`);
      setRows(orderRowsByIds(data.rows || [], selectedIds));
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
  const countLabel = rekapBadgeSelected ? `${selected.size}/${REKAP_MAX_MARKETS}` : `${selected.size}`;
  const quickLabel = rekapBadgeSelected ? `Pilih ${REKAP_MAX_MARKETS} Pertama` : "Pilih Semua";
  const description = rekapBadgeSelected
    ? `Rekap Badge maksimal ${REKAP_MAX_MARKETS} pasaran sekali generate.`
    : "Pilih separator dulu, lalu generate. Hasil copy mengikuti separator pilihan.";

  return h("div", { className: "animate-rise pb-8" }, [
    h("button", { key: "back", type: "button", onClick: () => router.push("/"), className: "pressable depth-3 mb-3 inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black uppercase tracking-wide text-text-muted hover:border-border hover:bg-white/[0.06]" }, [h(ArrowLeft, { key: "i", size: 15 }), " Beranda"]),
    h("section", { key: "hero", className: "depth-1 mb-4 rounded-3xl border p-4 text-center" }, h("div", { className: "depth-2 rounded-3xl border px-4 py-6" }, [h("div", { key: "title", className: "display text-2xl text-text" }, "Share Prediksi"), h("p", { key: "desc", className: "mt-2 text-xs font-semibold leading-relaxed text-text-muted" }, description), h("p", { key: "active", className: "mt-3 text-[11px] font-black uppercase tracking-wide text-accent" }, selectedTitle)])),
    error ? h("div", { key: "err", className: "mb-4 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-center text-xs font-bold text-danger" }, error) : null,
    h("section", { key: "pickers", className: "depth-1 mb-4 rounded-3xl border p-4" }, [
      h("div", { key: "head", className: "mb-3 flex items-center justify-between gap-3 px-1" }, [h("span", { key: "t", className: "display text-xs text-text" }, "Pilihan Prediksi"), loadingOptions ? h(Loader2, { key: "l", size: 15, className: "animate-spin text-text-soft" }) : null]),
      renderPicker("Jenis", jenisItems, selectedMode, chooseJenis),
      renderPicker("Target", targetItems, selectedTarget, chooseTarget),
      renderPicker("Output", outputItems, selectedOutput, chooseOutput),
      rekapBadgeSelected ? null : renderPicker("Separator", SEPARATOR_OPTIONS, selectedSeparator, chooseSeparator),
    ]),
    h("section", { key: "markets", className: "depth-1 mb-4 rounded-3xl border p-4" }, [h("div", { key: "head", className: "mb-3 flex items-center justify-between gap-3 px-1" }, [h("span", { key: "t", className: "display text-xs text-text" }, "Pilih Pasaran"), h("span", { key: "c", className: "text-[10px] font-black uppercase tracking-wide text-text-soft" }, countLabel)]), renderMarkets()]),
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
      h("div", { key: "tools", className: "mb-3 grid grid-cols-2 gap-2" }, [h("button", { key: "first", type: "button", onClick: selectQuick, className: "pressable depth-3 rounded-2xl border px-3 py-2 text-[11px] font-black uppercase tracking-wide text-text-muted hover:border-border hover:bg-white/[0.06]" }, quickLabel), h("button", { key: "clear", type: "button", onClick: clearAll, className: "pressable depth-3 rounded-2xl border px-3 py-2 text-[11px] font-black uppercase tracking-wide text-text-muted hover:border-border hover:bg-white/[0.06]" }, "Kosongkan")]),
      h("div", { key: "grid", className: "grid grid-cols-3 gap-2 sm:grid-cols-4" }, markets.map((row) => {
        const key = marketKey(row);
        const active = selected.has(key);
        return h("button", { key: key || marketLabel(row), type: "button", onClick: () => toggle(row), className: active ? "pressable animate-soft-pop accent-bg-soft accent-border relative flex min-h-[58px] items-center justify-center rounded-2xl border px-2 py-2 text-center" : "pressable animate-soft-pop depth-1 relative flex min-h-[58px] items-center justify-center rounded-2xl border px-2 py-2 text-center hover:border-border hover:bg-surface-2" }, [active ? h("span", { key: "check", className: "absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white" }, h(Check, { size: 11, strokeWidth: 3.2 })) : null, h("span", { key: "label", className: "line-clamp-2 text-[9px] font-black leading-3 tracking-wide text-text" }, marketLabel(row))]);
      })),
      h("button", { key: "generate", type: "button", onClick: generate, disabled: loadingRows || selected.size === 0 || !selectedOption, className: "pressable depth-accent accent-text mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black uppercase tracking-wide disabled:opacity-45" }, [loadingRows ? h(Loader2, { key: "l", size: 15, className: "animate-spin" }) : null, "Generate"]),
    ]);
  }
}
