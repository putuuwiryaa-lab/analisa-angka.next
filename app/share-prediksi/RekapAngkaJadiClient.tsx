"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Binary,
  Check,
  ChevronRight,
  ClipboardCopy,
  Eraser,
  Grid3X3,
  Hash,
  Layers2,
  ListChecks,
  Loader2,
  Search,
  Share2,
  ShieldAlert,
  WandSparkles,
  X,
} from "lucide-react";
import type { PositionKey, TargetPair } from "@/lib/analysis/customDigit";
import type { MarketOption, ShareOption, ShareRow } from "./types";
import { fetchJson, marketKey, marketLabel, marketOptionRow } from "./utils";
import {
  POSITION_LABELS,
  REKAP_ANGKA_JADI_FOCUS_OPTIONS,
  REKAP_ANGKA_JADI_MAX_MARKETS,
  buildRekapAngkaJadiPreviewText,
  buildRekapAngkaJadiShareText,
  emptyRekapAngkaJadiConfig,
  focusLabel,
  focusPositions,
  hasAiDigitOption,
  hasBbfsOption,
  hasJumlahOption,
  hasMatiOption,
  hasParityOption,
  hasShioOption,
  hasSizeOption,
  rekapAngkaJadiMethodCount,
  type RekapAngkaJadiAiDigit,
  type RekapAngkaJadiBbfsDigit,
  type RekapAngkaJadiConfig,
  type RekapAngkaJadiCount,
  type RekapAngkaJadiResponse,
  type RekapAngkaJadiRow,
} from "./rekapAngkaJadi";

type Step = 1 | 2 | 3;

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

function ActionButton({
  children,
  primary,
  disabled,
  onClick,
}: {
  children: ReactNode;
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`pressable flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-[11px] font-black uppercase tracking-wide disabled:pointer-events-none disabled:opacity-45 ${
        primary
          ? "depth-accent accent-border accent-text"
          : "depth-3 border-border-soft text-text-muted hover:border-border"
      }`}
    >
      {children}
    </button>
  );
}

function ChoiceChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`pressable min-h-11 rounded-2xl border px-3 text-[10px] font-black uppercase tracking-wide disabled:pointer-events-none disabled:opacity-25 ${
        active
          ? "accent-bg-soft accent-border accent-text"
          : "depth-3 border-border-soft text-text-muted hover:border-border"
      }`}
    >
      {active ? <Check size={12} className="mr-1 inline" strokeWidth={3} /> : null}
      {label}
    </button>
  );
}

function MethodGroup({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-black uppercase tracking-[0.16em] text-text-soft">
        {icon} {label}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>
    </div>
  );
}

function selectedMethodLabels(focus: TargetPair, config: RekapAngkaJadiConfig) {
  const labels: string[] = [];
  if (config.aiDigit) labels.push(`AI ${config.aiDigit}`);
  if (config.parity) labels.push("Ganjil Genap");
  if (config.size) labels.push("Besar Kecil");
  if (config.bbfsDigit) labels.push(config.bbfsDigit === 10 ? "GGBK 8" : `BBFS ${config.bbfsDigit}`);
  for (const position of focusPositions(focus)) {
    const count = config.offPositions[position];
    if (count) labels.push(`OFF ${POSITION_LABELS[position]} ${count}`);
  }
  if (config.offJumlah) labels.push(`OFF Jumlah ${config.offJumlah}`);
  if (config.offShio) labels.push(`OFF Shio ${config.offShio}`);
  return labels;
}

export function RekapAngkaJadiClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [focus, setFocus] = useState<TargetPair>("belakang");
  const [config, setConfig] = useState<RekapAngkaJadiConfig>(() => emptyRekapAngkaJadiConfig());
  const [markets, setMarkets] = useState<ShareRow[]>([]);
  const [options, setOptions] = useState<ShareOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [marketSearch, setMarketSearch] = useState("");
  const [rows, setRows] = useState<RekapAngkaJadiRow[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  const methodCount = rekapAngkaJadiMethodCount(config);
  const methods = useMemo(() => selectedMethodLabels(focus, config), [config, focus]);
  const [firstPosition, secondPosition] = focusPositions(focus);

  const filteredMarkets = useMemo(() => {
    const query = marketSearch.trim().toLowerCase();
    if (!query) return markets;
    return markets.filter((row) => {
      const id = String(row.marketId || "").toLowerCase();
      return id.includes(query) || marketLabel(row).toLowerCase().includes(query);
    });
  }, [marketSearch, markets]);

  const selectedMarketRows = useMemo(() => {
    const byKey = new Map(markets.map((row) => [marketKey(row), row]));
    return Array.from(selected).map((key) => byKey.get(key)).filter(Boolean) as ShareRow[];
  }, [markets, selected]);

  const selectedIds = useMemo(
    () => selectedMarketRows.map((row) => String(row.marketId || "")).filter(Boolean),
    [selectedMarketRows],
  );

  const shareText = useMemo(() => buildRekapAngkaJadiShareText(rows), [rows]);
  const previewText = useMemo(() => buildRekapAngkaJadiPreviewText(rows), [rows]);

  useEffect(() => {
    let active = true;
    setLoadingMarkets(true);
    fetchJson<MarketOption[]>("/api/markets")
      .then((items) => {
        if (active) setMarkets(items.map(marketOptionRow).filter((row) => row.marketId));
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
        if (active) setOptions(items);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Gagal memuat pilihan metode.");
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
    setNotice("");
  }

  function chooseFocus(next: TargetPair) {
    setFocus(next);
    setConfig(emptyRekapAngkaJadiConfig());
    setSelected(new Set());
    setMarketSearch("");
    setError("");
    resetResult();
  }

  function toggleAiDigit(value: RekapAngkaJadiAiDigit) {
    setConfig((current) => ({ ...current, aiDigit: current.aiDigit === value ? null : value }));
    resetResult();
  }

  function toggleBbfsDigit(value: RekapAngkaJadiBbfsDigit) {
    setConfig((current) => ({ ...current, bbfsDigit: current.bbfsDigit === value ? null : value }));
    resetResult();
  }

  function toggleBoolean(key: "parity" | "size") {
    setConfig((current) => ({ ...current, [key]: !current[key] }));
    resetResult();
  }

  function toggleOffPosition(position: PositionKey, count: RekapAngkaJadiCount) {
    setConfig((current) => {
      const offPositions = { ...current.offPositions };
      if (offPositions[position] === count) delete offPositions[position];
      else offPositions[position] = count;
      return { ...current, offPositions };
    });
    resetResult();
  }

  function toggleCount(key: "offJumlah" | "offShio", count: RekapAngkaJadiCount) {
    setConfig((current) => ({ ...current, [key]: current[key] === count ? null : count }));
    resetResult();
  }

  function toggleMarket(row: ShareRow) {
    const key = marketKey(row);
    if (!key) return;
    resetResult();
    setError("");
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else if (next.size < REKAP_ANGKA_JADI_MAX_MARKETS) next.add(key);
      else setError(`Maksimal ${REKAP_ANGKA_JADI_MAX_MARKETS} pasaran sekali generate.`);
      return next;
    });
  }

  function selectQuick() {
    resetResult();
    setError("");
    setSelected(new Set(filteredMarkets.slice(0, REKAP_ANGKA_JADI_MAX_MARKETS).map(marketKey).filter(Boolean)));
  }

  function clearMarkets() {
    resetResult();
    setSelected(new Set());
    setError("");
  }

  function openMarketsStep() {
    if (methodCount < 1) {
      setError("Pilih minimal satu metode.");
      return;
    }
    setError("");
    setStep(2);
  }

  async function generate() {
    if (methodCount < 1) return setError("Pilih minimal satu metode.");
    if (!selectedIds.length) return setError("Pilih minimal satu pasaran.");

    setLoadingRows(true);
    setRows([]);
    setError("");
    setNotice("");
    setCopied(false);

    try {
      const response = await fetch("/api/share-predictions/angka-jadi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus, config, marketIds: selectedIds }),
      });
      const json = await response.json().catch(() => ({})) as Partial<RekapAngkaJadiResponse>;
      if (!response.ok || !json.success) throw new Error(json.error || "Gagal membuat angka jadi.");

      const generatedRows = Array.isArray(json.rows) ? json.rows : [];
      if (!generatedRows.length) throw new Error("Tidak ada pasaran yang berhasil dibuat.");
      setRows(generatedRows);

      const failed = Array.isArray(json.failed) ? json.failed : [];
      if (failed.length) {
        const details = failed.slice(0, 5).map((item) => `${item.marketName}: ${item.reason}`).join("; ");
        const suffix = failed.length > 5 ? `; dan ${failed.length - 5} lainnya` : "";
        setNotice(`${generatedRows.length} berhasil, ${failed.length} gagal. ${details}${suffix}`);
      }
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat angka jadi.");
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
    try {
      if (navigator.share) await navigator.share({ text: shareText });
      else await copyText();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError("Gagal membuka menu share.");
    }
  }

  const quickLabel = marketSearch ? "Pilih Hasil Cari" : "Pilih Semua";
  const selectedSummary = methods.length ? methods.join(" + ") : "Belum ada metode";

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
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-text-soft">Rekap Angka Jadi</span>
      </div>

      <section className="depth-accent mb-4 rounded-3xl border p-4">
        <div className="flex items-center gap-3">
          <span className="depth-3 accent-text flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border">
            <Layers2 size={20} strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="display text-xl text-text">Gabungkan Metode</h1>
            <p className="mt-1 text-[10px] font-semibold leading-4 text-text-soft">
              Pilih beberapa metode, lalu sistem membuat angka jadi setiap pasaran secara otomatis.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <StepButton number={1} title="Metode" active={step === 1} complete={step > 1} onClick={() => setStep(1)} />
          <StepButton
            number={2}
            title="Pasaran"
            active={step === 2}
            complete={step > 2}
            disabled={methodCount < 1}
            onClick={openMarketsStep}
          />
          <StepButton
            number={3}
            title="Hasil"
            active={step === 3}
            complete={false}
            disabled={!rows.length}
            onClick={() => setStep(3)}
          />
        </div>
      </section>

      {error ? (
        <div className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 p-3.5 text-center text-xs font-bold text-danger">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mb-4 rounded-2xl border border-warning/30 bg-warning/10 p-3.5 text-center text-xs font-bold text-warning">
          {notice}
        </div>
      ) : null}

      {step === 1 ? (
        <section className="animate-soft-pop depth-1 rounded-3xl border p-4">
          <SectionHeading
            number={1}
            title="Target & Metode"
            subtitle="Metode berbeda digabung sebagai filter AND. Satu pilihan aktif per kelompok."
          />

          <div className="mb-5">
            <div className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.16em] text-text-soft">Target</div>
            <div className="grid grid-cols-3 gap-2">
              {REKAP_ANGKA_JADI_FOCUS_OPTIONS.map((item) => {
                const active = item.key === focus;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => chooseFocus(item.key)}
                    className={`pressable min-h-[62px] rounded-2xl border px-2 py-2 text-center ${
                      active ? "accent-bg-soft accent-border" : "depth-3 border-border-soft hover:border-border"
                    }`}
                  >
                    <span className={`block text-[10px] font-black uppercase ${active ? "accent-text" : "text-text"}`}>
                      {item.label}
                    </span>
                    <span className="mt-1 block text-[8px] font-bold text-text-soft">{item.subtitle}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {loadingOptions ? (
            <div className="depth-3 flex min-h-28 items-center justify-center rounded-2xl border text-text-soft">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : (
            <>
              <MethodGroup icon={<WandSparkles size={13} />} label="AI Digit">
                {([2, 4, 6] as RekapAngkaJadiAiDigit[]).map((value) => (
                  <ChoiceChip
                    key={value}
                    label={`${value} Digit`}
                    active={config.aiDigit === value}
                    disabled={!hasAiDigitOption(options, focus, value)}
                    onClick={() => toggleAiDigit(value)}
                  />
                ))}
              </MethodGroup>

              <MethodGroup icon={<Binary size={13} />} label="Filter AI">
                <ChoiceChip
                  label="Ganjil Genap"
                  active={config.parity}
                  disabled={!hasParityOption(options, focus)}
                  onClick={() => toggleBoolean("parity")}
                />
                <ChoiceChip
                  label="Besar Kecil"
                  active={config.size}
                  disabled={!hasSizeOption(options, focus)}
                  onClick={() => toggleBoolean("size")}
                />
              </MethodGroup>

              <MethodGroup icon={<Grid3X3 size={13} />} label="BBFS">
                {([7, 8, 9, 10] as RekapAngkaJadiBbfsDigit[]).map((value) => (
                  <ChoiceChip
                    key={value}
                    label={value === 10 ? "GGBK 8" : `${value} Digit`}
                    active={config.bbfsDigit === value}
                    disabled={!hasBbfsOption(options, focus, value)}
                    onClick={() => toggleBbfsDigit(value)}
                  />
                ))}
              </MethodGroup>

              {[firstPosition, secondPosition].map((position) => (
                <MethodGroup
                  key={position}
                  icon={<ShieldAlert size={13} />}
                  label={`OFF ${POSITION_LABELS[position]}`}
                >
                  {([1, 2, 3] as RekapAngkaJadiCount[]).map((count) => (
                    <ChoiceChip
                      key={count}
                      label={`${count} Digit`}
                      active={config.offPositions[position] === count}
                      disabled={!hasMatiOption(options, count)}
                      onClick={() => toggleOffPosition(position, count)}
                    />
                  ))}
                </MethodGroup>
              ))}

              <MethodGroup icon={<Hash size={13} />} label="OFF Jumlah">
                {([1, 2, 3] as RekapAngkaJadiCount[]).map((count) => (
                  <ChoiceChip
                    key={count}
                    label={`${count} Jumlah`}
                    active={config.offJumlah === count}
                    disabled={!hasJumlahOption(options, focus, count)}
                    onClick={() => toggleCount("offJumlah", count)}
                  />
                ))}
              </MethodGroup>

              <MethodGroup icon={<ShieldAlert size={13} />} label="OFF Shio">
                {([1, 2, 3] as RekapAngkaJadiCount[]).map((count) => (
                  <ChoiceChip
                    key={count}
                    label={`${count} Shio`}
                    active={config.offShio === count}
                    disabled={!hasShioOption(options, focus, count)}
                    onClick={() => toggleCount("offShio", count)}
                  />
                ))}
              </MethodGroup>
            </>
          )}

          <div className="accent-bg-soft accent-border mt-4 rounded-2xl border px-3 py-3 text-center">
            <p className="text-[9px] font-black uppercase tracking-wide text-text-soft">
              {focusLabel(focus)} · {methodCount} metode
            </p>
            <p className="accent-text mt-1 text-[10px] font-black uppercase leading-5">{selectedSummary}</p>
          </div>

          <button
            type="button"
            onClick={openMarketsStep}
            disabled={methodCount < 1 || loadingOptions}
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
              subtitle={`${focusLabel(focus)} · ${methodCount} metode · ${selected.size} dipilih`}
            />

            <div className="relative mb-3">
              <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-soft" />
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
              <ActionButton onClick={clearMarkets} disabled={selected.size === 0}>
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
                      onClick={() => toggleMarket(row)}
                      className={`pressable relative flex min-h-[60px] items-center justify-center rounded-2xl border px-3 py-2.5 text-center ${
                        active ? "accent-bg-soft accent-border" : "depth-3 border-border-soft hover:border-border"
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
            subtitle={`${focusLabel(focus)} · ${rows.length} pasaran berhasil`}
          />

          <pre className="depth-2 max-h-[52svh] min-h-[180px] overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border p-4 font-mono text-[12px] font-bold leading-6 text-text">
            {loadingRows ? "Memuat hasil…" : previewText || "Belum ada hasil."}
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
