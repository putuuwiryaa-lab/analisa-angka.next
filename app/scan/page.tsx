"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Clipboard, Save, Trash2, X } from "lucide-react";
import { KOLOM, SHIO_KOLOM } from "@/lib/engine/types";
import type {
  AutoScanItem,
  AutoScanResult,
  BacktestRow,
  Kolom,
  Posisi,
  ScanMode,
  Target2D,
  Target3D,
} from "@/lib/engine/types";
import {
  is3DMode,
  isJumlah2DMode,
  isOffMode,
  isPositionMode,
  isShioMode,
} from "@/lib/shared/scan-mode";

type Market = {
  id: string;
  name: string;
  lastResult?: string;
  updated_at?: string | null;
};

type SavedTrek = {
  id: string;
  createdAt: string;
  marketId: string;
  marketName: string;
  mode: ScanMode;
  formula: string;
  code: string;
  digits: number[];
  offDigits: number[];
};

type FrequencyRow = {
  value: number;
  label: string;
  count: number;
};

const STORAGE_KEY = "analisa_scan_saved_treks_v1";

const POSITION_LABEL: Record<Posisi, string> = {
  A: "AS",
  C: "COP",
  K: "KPL",
  E: "EKR",
};

const MODE_OPTIONS: { value: ScanMode; label: string; digits: number }[] = [
  { value: "posisi", label: "Posisi", digits: 7 },
  { value: "ai_2d_belakang", label: "AI 2D", digits: 4 },
  { value: "bbfs_2d_belakang", label: "BBFS 2D", digits: 7 },
  { value: "jumlah_2d_belakang", label: "Jumlah 2D", digits: 4 },
  { value: "ai_3d", label: "AI 3D", digits: 8 },
  { value: "bbfs_3d", label: "BBFS 3D", digits: 8 },
  { value: "off_posisi", label: "OFF Posisi", digits: 3 },
  { value: "off_2d_belakang", label: "OFF 2D", digits: 3 },
  { value: "off_jumlah_2d_belakang", label: "OFF Jumlah 2D", digits: 3 },
  { value: "off_3d", label: "OFF 3D", digits: 3 },
  { value: "shio", label: "Shio", digits: 6 },
  { value: "off_shio", label: "OFF Shio", digits: 6 },
  { value: "experiment_x7", label: "Experiment X7", digits: 7 },
];

const RESULT_ROLE_STYLES = [
  {
    row: "border-accent/55 bg-accent/[0.09]",
    badge: "border-accent/55 bg-accent text-bg-deep",
  },
  {
    row: "border-primary/50 bg-primary/[0.10]",
    badge: "border-primary/55 bg-primary/25 text-primary-soft",
  },
  {
    row: "border-border bg-white/[0.055]",
    badge: "border-border bg-white/[0.10] text-text-muted",
  },
] as const;

function marketLabel(market: Market) {
  return String(market.name || market.id).toUpperCase();
}

function modeLabel(mode: ScanMode) {
  return MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}

function capitalized(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function analysisTitle(mode: ScanMode, targetPos: Posisi, target2D: Target2D, target3D: Target3D) {
  const label = modeLabel(mode);
  if (mode === "experiment_x7" || isShioMode(mode)) return label;
  if (isPositionMode(mode)) return `${label} ${POSITION_LABEL[targetPos]}`;
  if (is3DMode(mode)) return `${label} ${capitalized(target3D)}`;
  return `${label} ${capitalized(target2D)}`;
}

function scanDescription(item: AutoScanItem, count: number) {
  const unit = isShioMode(item.scanMode) ? "shio" : "digit";
  return `${analysisTitle(item.scanMode, item.targetPos, item.target2D, item.target3D)} ${count} ${unit}`;
}

function labelValue(value: number, mode: ScanMode) {
  return isShioMode(mode) ? String(value + 1).padStart(2, "0") : String(value);
}

function labelsFromValues(values: number[], mode: ScanMode) {
  return values.map((value) => labelValue(value, mode));
}

function displayDigits(values: number[], mode: ScanMode) {
  return labelsFromValues(values, mode).join(isShioMode(mode) ? "-" : "");
}

function pickColumns(columns: Kolom[], deret: number[]) {
  const source: readonly string[] = deret.length === 12 ? SHIO_KOLOM : KOLOM;
  return columns
    .map((column) => deret[source.indexOf(column)])
    .filter((digit): digit is number => Number.isFinite(digit));
}

function targetDigits(row: BacktestRow) {
  return row.targetDigits?.length ? row.targetDigits : [row.targetDigit];
}

function rowValues(item: AutoScanItem, row: BacktestRow) {
  const targets = targetDigits(row);
  return pickColumns(item.kolomHidup, row.deret).map((digit) => ({
    digit,
    hit: targets.includes(digit),
  }));
}

function rowStatus(item: AutoScanItem, row: BacktestRow) {
  const targets = targetDigits(row);
  const values = rowValues(item, row).map(({ digit }) => digit);
  const hitCount = targets.filter((digit) => values.includes(digit)).length;

  if (isOffMode(item.scanMode)) return values.some((digit) => targets.includes(digit)) ? "❌" : "✅";
  if (item.scanMode === "bbfs_2d_belakang" || item.scanMode === "bbfs_3d") {
    return targets.every((digit) => values.includes(digit)) ? "✅" : "❌";
  }
  if (item.scanMode === "ai_3d") {
    return hitCount >= Math.min(2, targets.length) ? "✅" : "❌";
  }
  return values.some((digit) => targets.includes(digit)) ? "✅" : "❌";
}

function predictionValues(item: AutoScanItem) {
  if (item.scanMode === "experiment_x7") return item.angkaHidup;
  const values = pickColumns(item.kolomHidup, item.result.deretLive);
  return isJumlah2DMode(item.scanMode) ? values.filter((digit) => digit !== 0) : values;
}

function rowText(item: AutoScanItem, row: BacktestRow) {
  return rowValues(item, row)
    .map(({ digit }) => labelValue(digit, item.scanMode))
    .join(isShioMode(item.scanMode) ? "-" : "");
}

function buildFrequencyRows(result: AutoScanResult): FrequencyRow[] {
  const maximum = isShioMode(result.config.scanMode) ? 12 : 10;
  const counts = Array.from({ length: maximum }, () => 0);

  for (const item of result.items) {
    for (const value of item.angkaHidup) {
      if (Number.isInteger(value) && value >= 0 && value < counts.length) counts[value] += 1;
    }
  }

  return counts
    .map((count, value) => ({
      value,
      label: labelValue(value, result.config.scanMode),
      count,
    }))
    .sort((left, right) => right.count - left.count || left.value - right.value);
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

export default function ScanPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketId, setMarketId] = useState("");
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [scanMode, setScanMode] = useState<ScanMode>("ai_2d_belakang");
  const [targetPos, setTargetPos] = useState<Posisi>("K");
  const [target2D, setTarget2D] = useState<Target2D>("belakang");
  const [target3D, setTarget3D] = useState<Target3D>("belakang");
  const [rounds, setRounds] = useState(14);
  const [patah, setPatah] = useState(0);
  const [digitCount, setDigitCount] = useState(4);
  const [stopScan, setStopScan] = useState(3);
  const [marketName, setMarketName] = useState("");
  const [result, setResult] = useState<AutoScanResult | null>(null);
  const [viewItem, setViewItem] = useState<AutoScanItem | null>(null);
  const [savedTreks, setSavedTreks] = useState<SavedTrek[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState("");
  const [savedCode, setSavedCode] = useState("");

  useEffect(() => {
    fetch("/api/markets")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Gagal memuat pasaran.");
        return Array.isArray(data) ? data : [];
      })
      .then((data: Market[]) => {
        setMarkets(data);
        const defaultMarket = data.find((market) => /singapore|sgp/i.test(`${market.id} ${market.name}`)) ?? data[0];
        if (defaultMarket) setMarketId(defaultMarket.id);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Gagal memuat pasaran."))
      .finally(() => setMarketsLoading(false));

    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(stored)) setSavedTreks(stored);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!viewItem) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewItem(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [viewItem]);

  const selectedMarket = markets.find((market) => market.id === marketId) ?? null;
  const digitMaximum = isShioMode(scanMode) ? 12 : 10;
  const frequencyRows = useMemo(() => result ? buildFrequencyRows(result) : [], [result]);

  function changeMode(mode: ScanMode) {
    setScanMode(mode);
    const option = MODE_OPTIONS.find((item) => item.value === mode);
    setDigitCount(option?.digits ?? 7);
    if (mode === "experiment_x7") {
      setRounds(7);
      setPatah(0);
      setStopScan(1);
    }
  }

  async function runScan() {
    if (!marketId) {
      setError("Pilih pasaran terlebih dahulu.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setViewItem(null);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId,
          scanMode,
          targetPos,
          target2D,
          target3D,
          L: rounds,
          patah,
          digitCount,
          stopScan,
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.error) throw new Error(data?.error || "Scan gagal.");
      setMarketName(String(data.market || selectedMarket?.name || selectedMarket?.id || "Pasaran"));
      setResult(data.result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Scan gagal.");
    } finally {
      setLoading(false);
    }
  }

  function persistSaved(next: SavedTrek[]) {
    setSavedTreks(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function saveTrek(item: AutoScanItem) {
    const trek: SavedTrek = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      createdAt: new Date().toISOString(),
      marketId,
      marketName: marketName || selectedMarket?.name || selectedMarket?.id || marketId,
      mode: item.scanMode,
      formula: item.formula,
      code: item.code,
      digits: item.angkaHidup,
      offDigits: item.angkaMati,
    };
    persistSaved([trek, ...savedTreks].slice(0, 100));
    setSavedCode(item.code);
    window.setTimeout(() => setSavedCode(""), 1400);
  }

  function deleteTrek(id: string) {
    persistSaved(savedTreks.filter((item) => item.id !== id));
  }

  async function copyTrek(item: AutoScanItem) {
    const title = String(marketName || selectedMarket?.name || selectedMarket?.id || "Pasaran").toUpperCase();
    const description = scanDescription(item, result?.config.digitCount ?? digitCount);
    const history = item.result.rows.map((row) => `${row.displayDraw} ➜ ${rowText(item, row)} ${rowStatus(item, row)}`);
    const prediction = predictionValues(item).map((value) => labelValue(value, item.scanMode)).join(isShioMode(item.scanMode) ? "-" : "");
    const next = `${item.result.latestDraw} ➜ ${prediction} ??`;

    await copyText([`*${title}*`, description, "", ...history, next].join("\n"));
    setCopiedCode(item.code);
    window.setTimeout(() => setCopiedCode(""), 1400);
  }

  return (
    <div className="animate-rise space-y-4">
      <section className="depth-1 rounded-3xl border p-4 sm:p-5">
        <div className="space-y-4">
          <MarketSelectField
            markets={markets}
            value={marketId}
            selectedMarket={selectedMarket}
            disabled={marketsLoading}
            onChange={setMarketId}
          />

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Data uji"
              value={rounds}
              min={1}
              max={100}
              hint="maks. 100"
              disabled={scanMode === "experiment_x7"}
              onChange={setRounds}
            />
            <NumberField
              label="Patah"
              value={patah}
              min={0}
              max={rounds}
              hint={`maks. ${rounds}`}
              disabled={scanMode === "experiment_x7"}
              onChange={setPatah}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Jenis" value={scanMode} onChange={(value) => changeMode(value as ScanMode)}>
              {MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>

            {isPositionMode(scanMode) ? (
              <SelectField label="Target" value={targetPos} onChange={(value) => setTargetPos(value as Posisi)}>
                <option value="A">AS</option>
                <option value="C">COP</option>
                <option value="K">KPL</option>
                <option value="E">EKR</option>
              </SelectField>
            ) : is3DMode(scanMode) ? (
              <SelectField label="Target" value={target3D} onChange={(value) => setTarget3D(value as Target3D)}>
                <option value="depan">Depan</option>
                <option value="belakang">Belakang</option>
              </SelectField>
            ) : scanMode !== "experiment_x7" ? (
              <SelectField label="Target" value={target2D} onChange={(value) => setTarget2D(value as Target2D)}>
                <option value="depan">Depan</option>
                <option value="tengah">Tengah</option>
                <option value="belakang">Belakang</option>
              </SelectField>
            ) : (
              <SelectField label="Target" value="otomatis" disabled onChange={() => undefined}>
                <option value="otomatis">Otomatis</option>
              </SelectField>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Jumlah digit"
              value={String(digitCount)}
              disabled={scanMode === "experiment_x7"}
              onChange={(value) => setDigitCount(Number(value))}
            >
              {Array.from({ length: digitMaximum }, (_, index) => index + 1).map((digit) => (
                <option key={digit} value={digit}>{digit} digit</option>
              ))}
            </SelectField>
            <NumberField
              label="Batas hasil"
              value={stopScan}
              min={1}
              max={5}
              disabled={scanMode === "experiment_x7"}
              onChange={setStopScan}
            />
          </div>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-sm font-bold text-danger">{error}</div> : null}

        <button
          type="button"
          onClick={runScan}
          disabled={loading || marketsLoading || !marketId}
          className="pressable mt-5 flex h-16 w-full items-center justify-center rounded-2xl border border-primary/70 bg-primary px-4 text-base font-black text-bg-deep shadow-[0_12px_30px_rgba(105,151,255,0.18)] transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Memproses Scan…" : "Scan Sekarang"}
        </button>
      </section>

      {result ? (
        <section className="depth-1 rounded-3xl border p-4 sm:p-5">
          <p className="mb-4 text-sm font-bold leading-relaxed text-text-soft">
            <strong className="text-text">{String(marketName || selectedMarket?.name || selectedMarket?.id || "Pasaran").toUpperCase()}</strong>
            {" · "}
            <strong className="text-text">{analysisTitle(result.config.scanMode, result.config.targetPos, result.config.target2D, result.config.target3D)}</strong>
            {` · ${result.config.digitCount} ${isShioMode(result.config.scanMode) ? "shio" : "digit"} · ${result.config.L} data · patah ${result.config.patah} · ${result.totalMatched} hasil`}
          </p>

          <div className="space-y-2.5">
            {result.items.length ? result.items.map((item, index) => {
              const style = RESULT_ROLE_STYLES[index] ?? RESULT_ROLE_STYLES[2];
              return (
                <article key={`${item.code}-${index}`} className={`rounded-2xl border p-3 ${style.row}`}>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`max-w-[7.5rem] shrink-0 truncate rounded-xl border px-3 py-2 text-sm font-black ${style.badge}`}>
                        {item.formula}
                      </span>
                      <div className="num flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-black tracking-[0.06em] text-accent">
                        {labelsFromValues(item.angkaHidup, item.scanMode).map((digit, digitIndex) => (
                          <span key={`${digit}-${digitIndex}`}>{digit}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => saveTrek(item)}
                        className="pressable h-11 rounded-xl border border-primary/40 bg-primary/10 px-3 text-xs font-black text-primary-soft"
                      >
                        {savedCode === item.code ? "Tersimpan" : "Simpan"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewItem(item)}
                        className="pressable h-11 rounded-xl border border-primary/40 bg-primary/10 px-3 text-xs font-black text-primary-soft"
                      >
                        Lihat
                      </button>
                    </div>
                  </div>
                </article>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-border-soft p-7 text-center text-sm font-bold text-text-muted">
                Belum ada trek yang cocok.
              </div>
            )}
          </div>

          {result.items.length ? (
            <div className="mt-4 rounded-3xl border border-border-soft bg-surface/75 p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="display text-xl text-text">Frekuensi {isShioMode(result.config.scanMode) ? "Shio" : "Digit"}</h2>
                <span className="rounded-full border border-primary/35 bg-primary/10 px-3 py-1.5 text-xs font-black text-primary-soft">
                  {result.items.length} hasil scan
                </span>
              </div>
              <p className="mt-2 text-xs font-bold leading-relaxed text-text-soft">
                Dihitung dari semua angka hidup yang tampil pada hasil scan.
              </p>
              <div className="mt-4 space-y-2">
                {frequencyRows.map((row) => (
                  <div
                    key={row.value}
                    className={`flex h-12 items-center rounded-xl border border-accent/20 bg-bg-deep/25 px-4 ${row.count === 0 ? "opacity-25" : ""}`}
                  >
                    <b className="num w-12 text-2xl text-accent">{row.label}</b>
                    <span className="mr-3 font-black text-text-soft">×</span>
                    <span className="font-mono text-base font-bold text-text">{row.count} kali muncul</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="depth-1 rounded-3xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-text-soft">Penyimpanan lokal</p>
            <h2 className="display text-lg text-text">Saved Trek</h2>
          </div>
          <span className="rounded-full border border-border-soft px-3 py-1 text-xs font-black text-text-muted">{savedTreks.length}</span>
        </div>

        {savedTreks.length ? (
          <div className="space-y-2">
            {savedTreks.map((trek) => (
              <div key={trek.id} className="flex items-center gap-3 rounded-2xl border border-border-soft bg-white/[0.025] p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black uppercase text-text">{trek.marketName}</p>
                  <p className="num mt-1 truncate text-xl font-black tracking-[0.1em] text-accent">{displayDigits(trek.digits, trek.mode)}</p>
                  <p className="mt-1 truncate font-mono text-[9px] text-text-soft">{trek.formula} · {trek.code}</p>
                </div>
                <button onClick={() => deleteTrek(trek.id)} className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-danger/25 bg-danger/10 text-danger" aria-label="Hapus trek">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border-soft p-5 text-center text-xs font-bold text-text-soft">Belum ada trek tersimpan pada domain Analisa Angka.</p>
        )}
      </section>

      {viewItem ? (
        <TrekDetailModal
          item={viewItem}
          marketName={String(marketName || selectedMarket?.name || selectedMarket?.id || "Pasaran")}
          digitCount={result?.config.digitCount ?? digitCount}
          copied={copiedCode === viewItem.code}
          onCopy={() => copyTrek(viewItem)}
          onClose={() => setViewItem(null)}
        />
      ) : null}
    </div>
  );
}

function TrekDetailModal({ item, marketName, digitCount, copied, onCopy, onClose }: {
  item: AutoScanItem;
  marketName: string;
  digitCount: number;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  const prediction = predictionValues(item);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-5">
      <button type="button" aria-label="Tutup detail trek" onClick={onClose} className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Detail trek ${marketName}`}
        className="relative flex max-h-[90svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.75rem] border border-border-soft bg-bg-deep shadow-2xl sm:rounded-[1.75rem]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border-soft bg-surface/95 p-5">
          <div className="min-w-0 flex-1">
            <h2 className="display truncate text-2xl text-text">{marketName.toUpperCase()}</h2>
            <p className="mt-2 font-mono text-base font-black tracking-[0.08em] text-secondary">
              {scanDescription(item, digitCount)}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="pressable flex h-12 items-center gap-2 rounded-xl border border-border-soft bg-white/[0.05] px-3 text-xs font-black text-text-muted"
            >
              {copied ? <Check size={16} /> : <Clipboard size={16} />}
              {copied ? "Tersalin" : "Salin Trek"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="pressable flex h-12 w-12 items-center justify-center rounded-xl border border-border-soft bg-white/[0.05] text-text"
              aria-label="Tutup"
            >
              <X size={22} />
            </button>
          </div>
        </header>

        <div className="overflow-y-auto px-4 py-5 sm:px-5">
          {item.result.rows.length ? (
            <div>
              {item.result.rows.map((row, index) => (
                <div
                  key={`${row.displayDraw}-${index}`}
                  className="grid min-h-15 grid-cols-[4.5rem_1.75rem_minmax(0,1fr)_2rem] items-center gap-2 border-b border-border-soft/70 px-1 py-2"
                >
                  <span className="num text-lg font-black text-text">{row.displayDraw}</span>
                  <span className="text-xl font-black text-secondary">➜</span>
                  <div className="num flex min-w-0 flex-wrap items-center gap-2 text-lg font-black text-text">
                    {rowValues(item, row).map(({ digit, hit }, digitIndex) => (
                      <span
                        key={`${digit}-${digitIndex}`}
                        className={hit ? "rounded-lg border border-accent/60 bg-accent px-2 py-1 text-bg-deep shadow-[0_0_0_1px_rgba(255,193,59,0.18)]" : "px-0.5 py-1"}
                      >
                        {labelValue(digit, item.scanMode)}
                      </span>
                    ))}
                  </div>
                  <span className="text-right text-base">{rowStatus(item, row)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-3 rounded-2xl border border-dashed border-border-soft p-4 text-center text-xs font-bold text-text-soft">
              Mode ini tidak memiliki baris backtest terperinci.
            </p>
          )}

          <div className="mt-4 grid min-h-17 grid-cols-[4.5rem_1.75rem_minmax(0,1fr)_2rem] items-center gap-2 rounded-2xl border border-accent/35 bg-accent/[0.045] px-3 py-2">
            <span className="num text-lg font-black text-accent">{item.result.latestDraw}</span>
            <span className="text-xl font-black text-secondary">➜</span>
            <div className="num flex min-w-0 flex-wrap items-center gap-3 text-lg font-black text-accent">
              {prediction.map((digit, index) => <span key={`${digit}-${index}`}>{labelValue(digit, item.scanMode)}</span>)}
            </div>
            <span className="text-right font-black text-accent">??</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-text-muted">{children}</span>;
}

function MarketSelectField({ markets, value, selectedMarket, disabled, onChange }: {
  markets: Market[];
  value: string;
  selectedMarket: Market | null;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <FieldLabel>Pasaran</FieldLabel>
      <div className="relative">
        <div className="flex h-[4.5rem] items-center gap-3 rounded-2xl border border-border-soft bg-surface px-4 shadow-inner shadow-black/10">
          <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-primary shadow-[0_0_0_6px_rgba(105,151,255,0.12)]" />
          <span className="min-w-0 flex-1 truncate text-base font-black text-text">
            {selectedMarket ? marketLabel(selectedMarket) : disabled ? "MEMUAT PASARAN…" : "PILIH PASARAN"}
          </span>
          <span className="num shrink-0 rounded-xl border border-accent/30 bg-accent/10 px-3 py-1.5 text-base font-black tracking-[0.08em] text-accent">
            {selectedMarket?.lastResult || "----"}
          </span>
          <ChevronDown size={18} className="shrink-0 text-text-soft" />
        </div>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-label="Pilih pasaran"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        >
          <option value="">Pilih pasaran</option>
          {markets.map((market) => (
            <option key={market.id} value={market.id}>{marketLabel(market)} · {market.lastResult || "----"}</option>
          ))}
        </select>
      </div>
    </label>
  );
}

function SelectField({ label, value, onChange, disabled, children }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-[4.5rem] w-full appearance-none rounded-2xl border border-border-soft bg-surface px-4 pr-10 text-base font-black text-text outline-none shadow-inner shadow-black/10 focus:border-primary/50 disabled:opacity-55"
        >
          {children}
        </select>
        <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-soft" />
      </div>
    </label>
  );
}

function NumberField({ label, value, min, max, hint, disabled, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  hint?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))}
          className="h-[4.5rem] w-full rounded-2xl border border-border-soft bg-surface px-4 pr-20 text-base font-black text-text outline-none shadow-inner shadow-black/10 focus:border-primary/50 disabled:opacity-55"
        />
        {hint ? <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-text-soft/55">{hint}</span> : null}
      </div>
    </label>
  );
}
