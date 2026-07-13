"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Binary,
  Boxes,
  Check,
  ChevronRight,
  ClipboardCopy,
  Combine,
  Eraser,
  Gauge,
  Grid3X3,
  Hash,
  Layers3,
  ListChecks,
  Loader2,
  MoveHorizontal,
  PanelLeft,
  PanelRight,
  Scale,
  Search,
  Share2,
  ShieldAlert,
  TextCursorInput,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { MODE_LABEL, REKAP_BADGE_OPTION, REKAP_MAX_MARKETS, SEPARATOR } from "./constants";
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

type Step = 1 | 2 | 3;

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

function pickerIcon(group: string, item: PickItem): LucideIcon {
  const key = item.key.toLowerCase();
  const label = item.label.toLowerCase();

  if (group === "Jenis") {
    if (key === "rekap_badge") return BadgeCheck;
    if (key === "ai") return Activity;
    if (key === "bbfs") return Grid3X3;
    if (key === "mati") return ShieldAlert;
    if (key === "jumlah") return Hash;
    if (key === "shio") return Gauge;
  }

  if (group === "Target") {
    if (label.includes("depan")) return PanelLeft;
    if (label.includes("tengah")) return MoveHorizontal;
    if (label.includes("belakang")) return PanelRight;
    if (label.includes("3d")) return Layers3;
    if (label.includes("4d")) return Boxes;
    return BadgeCheck;
  }

  if (label.includes("ganjil") || label.includes("genap")) return Binary;
  if (label.includes("besar") || label.includes("kecil")) return Scale;
  if (label.includes("ggbk")) return Combine;
  if (label.includes("badge")) return BadgeCheck;
  return Hash;
}

function StepButton({
  number,
  title,
  active,
  complete,
  disabled,
  onClick,
}: {
  number: Step;
  title: string;
  active: boolean;
  complete: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`pressable min-w-0 flex-1 rounded-2xl border px-2 py-2.5 text-center disabled:pointer-events-none disabled:opacity-40 ${
        active ? "accent-bg-soft accent-border" : "depth-3 border-border-soft"
      }`}
    >
      <span
        className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-black ${
          active || complete ? "accent-bg-soft accent-border accent-text" : "border-border-soft text-text-soft"
        }`}
      >
        {complete && !active ? <Check size={12} strokeWidth={3} /> : number}
      </span>
      <span className={`mt-1.5 block truncate text-[9px] font-black uppercase tracking-wide ${active ? "text-text" : "text-text-soft"}`}>
        {title}
      </span>
    </button>
  );
}

function SectionHeading({ number, title, subtitle }: { number: Step; title: string; subtitle: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="accent-bg-soft accent-border accent-text flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-black">
        {number}
      </span>
      <div className="min-w-0">
        <h2 className="display text-sm text-text">{title}</h2>
        <p className="mt-1 text-[10px] font-semibold leading-4 text-text-soft">{subtitle}</p>
      </div>
    </div>
  );
}

function ActionButton({ children, primary, disabled, onClick }: { children: ReactNode; primary?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`pressable flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-[11px] font-black uppercase tracking-wide disabled:pointer-events-none disabled:opacity-45 ${
        primary ? "depth-accent accent-border accent-text" : "depth-3 border-border-soft text-text-muted hover:border-border"
      }`}
    >
      {children}
    </button>
  );
}

export function SharePrediksiClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [markets, setMarkets] = useState<ShareRow[]>([]);
  const [options, setOptions] = useState<ShareOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<ShareOption | null>(REKAP_BADGE_OPTION);
  const [selectedSeparator, setSelectedSeparator] = useState(SEPARATOR);
  const [marketSearch, setMarketSearch] = useState("");
  const [rows, setRows] = useState<ShareRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const allOptions = useMemo(
    () => uniqueBy([REKAP_BADGE_OPTION, ...options].sort(optionSort), (option) => option.key),
    [options],
  );
  const selectedMode = optionModeKey(selectedOption);
  const selectedTarget = selectedOption ? targetKey(selectedOption) : "";
  const selectedOutput = selectedOption ? outputKey(selectedOption) : "";
  const rekapBadgeSelected = isRekapBadge(selectedOption);

  const selectedMarketRows = useMemo(() => {
    const byKey = new Map(markets.map((row) => [marketKey(row), row]));
    return Array.from(selected).map((key) => byKey.get(key)).filter(Boolean) as ShareRow[];
  }, [markets, selected]);

  const selectedIds = useMemo(
    () => selectedMarketRows.map((row) => String(row.marketId)).filter(Boolean),
    [selectedMarketRows],
  );

  const filteredMarkets = useMemo(() => {
    const query = marketSearch.trim().toLowerCase();
    if (!query) return markets;
    return markets.filter((row) => {
      const id = String(row.marketId || "").toLowerCase();
      const label = marketLabel(row).toLowerCase();
      return id.includes(query) || label.includes(query);
    });
  }, [marketSearch, markets]);

  const jenisItems = useMemo<PickItem[]>(() => {
    return uniqueBy(allOptions, displayMode).map((option) => ({
      key: displayMode(option),
      label: optionLabelMode(option),
    }));
  }, [allOptions]);

  const targetItems = useMemo<PickItem[]>(() => {
    return uniqueBy(allOptions.filter((option) => optionMatchesMode(option, selectedMode)), targetKey).map((option) => ({
      key: targetKey(option),
      label: targetLabel(option) || "Semua Posisi",
    }));
  }, [allOptions, selectedMode]);

  const outputItems = useMemo<PickItem[]>(() => {
    return uniqueBy(
      allOptions.filter(
        (option) => optionMatchesMode(option, selectedMode) && targetKey(option) === selectedTarget,
      ),
      outputKey,
    ).map((option) => ({ key: outputKey(option), label: outputLabel(option) }));
  }, [allOptions, selectedMode, selectedTarget]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selected.has(marketKey(row))),
    [rows, selected],
  );
  const shareText = useMemo(
    () => buildShareText(selectedOption, selectedRows, selectedSeparator || SEPARATOR),
    [selectedOption, selectedRows, selectedSeparator],
  );
  const previewText = useMemo(
    () => buildPreviewText(selectedOption, selectedRows, selectedSeparator || SEPARATOR),
    [selectedOption, selectedRows, selectedSeparator],
  );

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
    setError("");

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
    const next = firstSorted(
      allOptions.filter(
        (option) => optionMatchesMode(option, selectedMode) && targetKey(option) === key,
      ),
    );
    if (!next) return;
    chooseOption(next);
  }

  function chooseOutput(key: string) {
    const next = firstSorted(
      allOptions.filter(
        (option) =>
          optionMatchesMode(option, selectedMode) &&
          targetKey(option) === selectedTarget &&
          outputKey(option) === key,
      ),
    );
    if (!next) return;
    chooseOption(next);
  }

  function chooseSeparator(value: string) {
    setSelectedSeparator(value);
    setCopied(false);
  }

  function toggle(row: ShareRow) {
    const key = marketKey(row);
    if (!key) return;
    resetResult();
    setError("");
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
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
    setError("");
    const limit = rekapBadgeSelected ? REKAP_MAX_MARKETS : filteredMarkets.length;
    setSelected(new Set(filteredMarkets.slice(0, limit).map(marketKey).filter(Boolean)));
  }

  function clearAll() {
    resetResult();
    setSelected(new Set());
    setError("");
  }

  function openMarketsStep() {
    if (!selectedOption) {
      setError("Pilih jenis prediksi dulu.");
      return;
    }
    setError("");
    setStep(2);
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
        const params = new URLSearchParams({
          limit: String(REKAP_MAX_MARKETS),
          marketIds: selectedIds.join(","),
        });
        const data = await fetchJson<ShareResponse>(
          `/api/share-predictions/rekap-badge?${params.toString()}`,
        );
        setRows(orderRowsByIds(data.rows || [], selectedIds));
        setStep(3);
        return;
      }

      const params = new URLSearchParams({
        mode: selectedOption.mode,
        param: String(selectedOption.param),
        targetPair: selectedOption.targetPair,
        analysisScope: selectedOption.analysisScope,
      });
      const data = await fetchJson<ShareResponse>(
        `/api/share-predictions?${params.toString()}`,
      );
      setRows(orderRowsByIds(data.rows || [], selectedIds));
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal generate share prediksi.");
    } finally {
      setLoadingRows(false);
    }
  }

  async function copyText() {
    if (!shareText) return;
    try {
      await navigator.clipboard?.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Gagal menyalin. Tekan lama preview lalu salin manual.");
    }
  }

  async function shareNow() {
    if (!shareText) return;
    if (navigator.share) {
      await navigator.share({ text: shareText });
      return;
    }
    await copyText();
  }

  const selectedTitle = selectedOption
    ? [optionLabelMode(selectedOption), targetLabel(selectedOption), outputLabel(selectedOption)]
        .filter(Boolean)
        .join(" · ")
    : "Pilih prediksi";
  const fallback = selected.size
    ? "Belum ada hasil. Kembali ke pilihan pasaran lalu tekan Generate."
    : "Belum ada pasaran yang dipilih.";
  const countLabel = rekapBadgeSelected
    ? `${selected.size}/${REKAP_MAX_MARKETS}`
    : `${selected.size}`;
  const quickLabel = rekapBadgeSelected
    ? `Pilih ${REKAP_MAX_MARKETS} Pertama`
    : marketSearch
      ? "Pilih Hasil Cari"
      : "Pilih Semua";
  const description = rekapBadgeSelected
    ? `Maksimal ${REKAP_MAX_MARKETS} pasaran sekali generate.`
    : "Pilih format, pasaran, lalu buat teks siap dibagikan.";
  const canOpenResult = Boolean(shareText || rows.length);

  function renderPicker(
    label: string,
    items: PickItem[],
    activeKey: string,
    onPick: (key: string) => void,
  ) {
    if (!items.length) return null;

    return (
      <div className="mb-4 last:mb-0">
        <div className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.18em] text-text-soft">
          {label}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((item) => {
            const active = item.key === activeKey;
            const Icon = pickerIcon(label, item);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onPick(item.key)}
                className={`pressable flex min-h-[58px] items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-center text-[11px] font-black uppercase tracking-wide ${
                  active
                    ? "accent-bg-soft accent-border text-text"
                    : "depth-3 border-border-soft text-text-muted hover:border-border"
                }`}
              >
                <Icon size={15} strokeWidth={1.9} className={active ? "text-accent" : "text-text-soft"} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderSeparatorInput() {
    return (
      <div className="mb-4 last:mb-0">
        <div className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-black uppercase tracking-[0.18em] text-text-soft">
          <TextCursorInput size={13} /> Separator
        </div>
        <input
          type="text"
          value={selectedSeparator}
          maxLength={16}
          placeholder={SEPARATOR}
          onChange={(event: ChangeEvent<HTMLInputElement>) => chooseSeparator(event.target.value)}
          className="depth-3 min-h-12 w-full rounded-2xl border bg-transparent px-4 text-center text-sm font-black text-text outline-none transition-colors placeholder:text-text-soft focus:border-border-strong focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="Separator share prediksi"
        />
        <p className="mt-2 px-1 text-center text-[10px] font-bold text-text-soft">
          Bisa memakai simbol, emoji, koma, titik, slash, atau teks pendek.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-rise pb-24">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="pressable depth-3 inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 text-xs font-black uppercase tracking-wide text-text-muted hover:border-border"
        >
          <ArrowLeft size={15} /> Beranda
        </button>
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-text-soft">
          Share Prediksi
        </span>
      </div>

      <section className="depth-accent mb-4 rounded-3xl border p-4">
        <div className="flex items-center gap-3">
          <span className="depth-3 accent-text flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border">
            <Share2 size={20} strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="display text-xl text-text">Buat & Bagikan</h1>
            <p className="mt-1 text-[10px] font-semibold leading-4 text-text-soft">{description}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <StepButton
            number={1}
            title="Prediksi"
            active={step === 1}
            complete={step > 1}
            onClick={() => setStep(1)}
          />
          <StepButton
            number={2}
            title="Pasaran"
            active={step === 2}
            complete={step > 2}
            disabled={!selectedOption}
            onClick={() => setStep(2)}
          />
          <StepButton
            number={3}
            title="Hasil"
            active={step === 3}
            complete={false}
            disabled={!canOpenResult}
            onClick={() => setStep(3)}
          />
        </div>
      </section>

      {error ? (
        <div className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 p-3.5 text-center text-xs font-bold text-danger">
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <section className="animate-soft-pop depth-1 rounded-3xl border p-4">
          <SectionHeading
            number={1}
            title="Pilih Prediksi"
            subtitle="Tentukan jenis, target, dan output yang akan dibagikan."
          />

          {loadingOptions ? (
            <div className="depth-3 flex min-h-24 items-center justify-center rounded-2xl border text-text-soft">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : (
            <>
              {renderPicker("Jenis", jenisItems, selectedMode, chooseJenis)}
              {renderPicker("Target", targetItems, selectedTarget, chooseTarget)}
              {renderPicker("Output", outputItems, selectedOutput, chooseOutput)}
              {rekapBadgeSelected ? null : renderSeparatorInput()}
            </>
          )}

          <div className="accent-bg-soft accent-border mt-4 rounded-2xl border px-3 py-3 text-center">
            <p className="text-[9px] font-black uppercase tracking-wide text-text-soft">Pilihan aktif</p>
            <p className="accent-text mt-1 text-[11px] font-black uppercase tracking-wide">{selectedTitle}</p>
          </div>

          <button
            type="button"
            onClick={openMarketsStep}
            disabled={!selectedOption || loadingOptions}
            className="pressable depth-accent accent-border accent-text mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border px-4 text-xs font-black uppercase tracking-wide disabled:opacity-45"
          >
            Lanjut Pilih Pasaran <ChevronRight size={16} />
          </button>
        </section>
      ) : null}

      {step === 2 ? (
        <>
          <section className="animate-soft-pop depth-1 rounded-3xl border p-4">
            <SectionHeading
              number={2}
              title="Pilih Pasaran"
              subtitle={`${selectedTitle} · ${countLabel} dipilih`}
            />

            <div className="relative mb-3">
              <Search
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-soft"
              />
              <input
                type="text"
                value={marketSearch}
                onChange={(event) => setMarketSearch(event.target.value)}
                placeholder="Cari pasaran…"
                className="depth-3 h-12 w-full rounded-2xl border bg-transparent pl-11 pr-11 text-sm font-bold text-text outline-none placeholder:text-text-soft focus:border-border-strong focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              {marketSearch ? (
                <button
                  type="button"
                  onClick={() => setMarketSearch("")}
                  className="pressable absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-text-soft hover:bg-white/[0.06]"
                  aria-label="Hapus pencarian pasaran"
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <ActionButton onClick={selectQuick} disabled={loadingMarkets || filteredMarkets.length === 0}>
                <ListChecks size={15} /> {quickLabel}
              </ActionButton>
              <ActionButton onClick={clearAll} disabled={selected.size === 0}>
                <Eraser size={15} /> Kosongkan
              </ActionButton>
            </div>

            {loadingMarkets ? (
              <div className="depth-3 flex min-h-32 items-center justify-center rounded-2xl border text-text-soft">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : filteredMarkets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-soft px-4 py-10 text-center text-xs font-bold text-text-muted">
                Pasaran tidak ditemukan.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {filteredMarkets.map((row) => {
                  const key = marketKey(row);
                  const active = selected.has(key);
                  return (
                    <button
                      key={key || marketLabel(row)}
                      type="button"
                      onClick={() => toggle(row)}
                      className={`pressable relative flex min-h-[60px] items-center justify-center rounded-2xl border px-3 py-2.5 text-center ${
                        active
                          ? "accent-bg-soft accent-border"
                          : "depth-3 border-border-soft hover:border-border"
                      }`}
                    >
                      {active ? (
                        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white">
                          <Check size={10} strokeWidth={3.2} />
                        </span>
                      ) : null}
                      <span className="line-clamp-2 text-[10px] font-black leading-4 tracking-wide text-text">
                        {marketLabel(row)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <div className="sticky bottom-3 z-30 mt-3 grid grid-cols-[0.8fr_1.2fr] gap-2 rounded-3xl border border-border-soft bg-bg-deep/90 p-2.5 shadow-2xl backdrop-blur-xl">
            <ActionButton onClick={() => setStep(1)}>
              <ArrowLeft size={15} /> Ubah
            </ActionButton>
            <ActionButton primary onClick={() => void generate()} disabled={loadingRows || selected.size === 0}>
              {loadingRows ? <Loader2 size={15} className="animate-spin" /> : <WandSparkles size={16} />}
              {loadingRows ? "Membuat…" : `Generate (${selected.size})`}
            </ActionButton>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <section className="animate-soft-pop depth-1 rounded-3xl border p-4">
          <SectionHeading
            number={3}
            title="Hasil & Bagikan"
            subtitle={`${selectedTitle} · ${selected.size} pasaran`}
          />

          <pre className="depth-2 max-h-[52svh] min-h-[180px] overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border p-4 font-mono text-[12px] font-bold leading-6 text-text">
            {loadingRows ? "Memuat hasil…" : previewText || fallback}
          </pre>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <ActionButton onClick={() => void copyText()} disabled={!shareText || loadingRows}>
              {copied ? <Check size={16} /> : <ClipboardCopy size={16} />}
              {copied ? "Tersalin" : "Copy"}
            </ActionButton>
            <ActionButton primary onClick={() => void shareNow()} disabled={!shareText || loadingRows}>
              <Share2 size={16} /> Share
            </ActionButton>
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="pressable mt-3 min-h-10 w-full rounded-2xl text-[10px] font-black uppercase tracking-wide text-text-soft hover:bg-white/[0.04] hover:text-text"
          >
            Ubah Pilihan Pasaran
          </button>
        </section>
      ) : null}
    </div>
  );
}
