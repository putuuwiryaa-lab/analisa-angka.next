"use client";

import { useId, useMemo, useState } from "react";
import { Activity, Database, RefreshCw } from "lucide-react";
import AdaptiveEvaluationPanel from "./AdaptiveEvaluationPanel";
import AdaptiveMarketSelect, {
  type AdaptiveMarketOption,
} from "./_components/AdaptiveMarketSelect";
import type { AdaptiveMethod } from "@/lib/adaptive/types";
import type { Target2D } from "@/lib/engine/types";
import { formatMarketName } from "@/lib/markets/format";
import { useMarketsQuery } from "@/lib/markets/useMarketsQuery";
import { WorkspacePlaceholder } from "@/components/layout/WorkspacePlaceholder";

interface AdaptiveResult {
  source: "published";
  predictionId: string;
  publishedAt: string;
  engineVersion: string;
  configVersion: string;
  target2D: Target2D;
  historyLength: number;
  latestDraw: string;
  digits: number[];
  method: AdaptiveMethod;
  digitCount: number;
  estimatedSuccess: number;
  baselineSuccess: number;
  lift: number;
  selectionMargin: number;
  signalStrength: "low" | "medium" | "high";
  stateRevision: number;
  snapshotComplete: true;
  selectionCount: number;
}

const TARGET_2D: Target2D = "belakang";
const TARGET_LABEL = "2D Belakang";

const METHOD_LABELS: Record<AdaptiveMethod, string> = {
  ai: "AI",
  bbfs: "BBFS",
};

const SIGNAL_LABELS: Record<AdaptiveResult["signalStrength"], string> = {
  low: "Rendah",
  medium: "Moderat",
  high: "Kuat",
};

function digitRange(method: AdaptiveMethod): { min: number; max: number } {
  return method === "ai" ? { min: 1, max: 6 } : { min: 5, max: 9 };
}

function percentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function publishedAtLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "waktu pembaruan tidak tersedia"
    : date.toLocaleString("id-ID", {
        dateStyle: "short",
        timeStyle: "short",
      });
}

export default function AdaptivePageClient() {
  const digitCountId = useId();
  const {
    data: sharedMarkets = [],
    isPending: marketsPending,
    error: marketsQueryError,
  } = useMarketsQuery();
  const markets = sharedMarkets as AdaptiveMarketOption[];
  const loadingMarkets = marketsPending && markets.length === 0;
  const [marketId, setMarketId] = useState("");
  const [method, setMethod] = useState<AdaptiveMethod>("bbfs");
  const [digitCount, setDigitCount] = useState(7);
  const [result, setResult] = useState<AdaptiveResult | null>(null);
  const [marketName, setMarketName] = useState("");
  const [evaluationRefresh, setEvaluationRefresh] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const defaultMarket = useMemo(
    () =>
      markets.find((market) => /singapore|sgp/i.test(`${market.id} ${market.name}`)) ??
      markets[0] ??
      null,
    [markets],
  );
  const activeMarketId = marketId || defaultMarket?.id || "";
  const selectedMarket = useMemo(
    () => markets.find((market) => market.id === activeMarketId) ?? null,
    [activeMarketId, markets],
  );
  const range = digitRange(method);
  const marketsError =
    marketsQueryError instanceof Error
      ? marketsQueryError.message
      : marketsQueryError
        ? "Gagal memuat pasaran."
        : "";
  const visibleError = error || marketsError;

  function resetSnapshot() {
    setResult(null);
    setMarketName("");
    setError("");
  }

  function changeMarket(value: string) {
    if (value === activeMarketId) return;
    setMarketId(value);
    resetSnapshot();
  }

  function changeMethod(value: AdaptiveMethod) {
    if (value === method) return;
    const nextRange = digitRange(value);
    setMethod(value);
    setDigitCount((current) => Math.max(nextRange.min, Math.min(nextRange.max, current)));
    resetSnapshot();
  }

  function changeDigitCount(value: number) {
    const bounded = Math.max(range.min, Math.min(range.max, value));
    if (bounded === digitCount) return;
    setDigitCount(bounded);
    resetSnapshot();
  }

  async function loadSnapshot() {
    if (!activeMarketId) return;
    setRunning(true);
    setError("");

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adaptive",
          marketId: activeMarketId,
          method,
          digitCount,
          target2D: TARGET_2D,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Hasil terbaru gagal dimuat.");
      setResult(payload.result);
      setMarketName(payload.market);
      setEvaluationRefresh((value) => value + 1);
    } catch (loadError) {
      setResult(null);
      setError(loadError instanceof Error ? loadError.message : "Hasil terbaru gagal dimuat.");
    } finally {
      setRunning(false);
    }
  }

  const busy = running;

  return (
    <div className="desktop-workspace space-y-3 px-1 sm:px-0">
      <div className="desktop-controls space-y-3">
        <section className="animate-fade-in rounded-2xl border border-border-soft bg-surface/75 p-4 backdrop-blur-md sm:backdrop-blur-xl">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary-soft">
              <Activity size={21} />
            </div>
            <div>
              <p className="text-[10px] lg:text-xs font-black uppercase tracking-[0.16em] text-primary-soft">
                Adaptive Intelligence
              </p>
              <h2 className="display text-xl text-text">Adaptive Intelligence</h2>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                Fokus 2D belakang dengan pembelajaran dari histori hingga 170 result.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <AdaptiveMarketSelect
              markets={markets}
              value={activeMarketId}
              selectedMarket={selectedMarket}
              disabled={loadingMarkets || busy}
              loading={loadingMarkets}
              onChange={changeMarket}
            />

            <div>
              <span className="mb-1.5 block text-[10px] lg:text-xs font-black uppercase tracking-[0.13em] text-text-muted">
                Mode Analisis
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(["ai", "bbfs"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => changeMethod(value)}
                    disabled={busy}
                    className={`pressable h-11 rounded-xl border text-xs font-black uppercase tracking-wide transition-colors ${
                      method === value
                        ? "border-primary/50 bg-primary/20 text-primary-soft"
                        : "border-border-soft bg-bg-deep/60 text-text-muted hover:text-text"
                    }`}
                  >
                    {METHOD_LABELS[value]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor={digitCountId}
                  className="text-[10px] lg:text-xs font-black uppercase tracking-[0.13em] text-text-muted"
                >
                  Jumlah Digit
                </label>
                <span className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-black text-primary-soft">
                  {digitCount}
                </span>
              </div>
              <input
                id={digitCountId}
                name="digitCount"
                type="range"
                min={range.min}
                max={range.max}
                step={1}
                value={digitCount}
                onChange={(event) => changeDigitCount(Number(event.target.value))}
                disabled={busy}
                className="w-full accent-[var(--color-primary)]"
              />
              <div className="mt-1 flex justify-between text-[9px] lg:text-xs font-bold text-text-muted">
                <span>{range.min}</span>
                <span>{range.max}</span>
              </div>
              <p className="mt-1.5 text-[9px] lg:text-xs text-text-muted">
                {method === "ai" ? "AI tersedia 1–6 digit." : "BBFS tersedia 5–9 digit."}
              </p>
            </div>

            <div className="rounded-xl border border-border-soft bg-bg-deep/55 px-3 py-2.5">
              <p className="text-[9px] lg:text-xs font-black uppercase tracking-[0.13em] text-text-muted">
                Fokus Analisis
              </p>
              <p className="mt-1 text-xs font-black text-primary-soft">{TARGET_LABEL}</p>
            </div>

            <button
              type="button"
              onClick={loadSnapshot}
              disabled={!activeMarketId || busy || loadingMarkets}
              className="pressable flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary/55 bg-primary/25 text-sm font-black uppercase tracking-wide text-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={running ? "animate-spin" : ""} size={18} />
              {running ? "Menyelaraskan" : "Buka Analisis"}
            </button>
          </div>
        </section>

        {visibleError && (
          <section className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
            {visibleError}
          </section>
        )}
      </div>
      <div className="desktop-results space-y-3">
        {!result && (
          <WorkspacePlaceholder
            title="Hasil Adaptive"
            description="Pilih pasaran, metode, dan jumlah digit. Hasil serta evaluasi tampil di panel ini."
            busy={running}
          />
        )}
        {result && (
          <section className="animate-fade-in rounded-2xl border border-primary/30 bg-surface/80 p-4 backdrop-blur-md sm:backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] lg:text-xs font-black uppercase tracking-[0.15em] text-primary-soft">
                  Pilihan Utama · {METHOD_LABELS[result.method]} {result.digitCount} Digit ·{" "}
                  {TARGET_LABEL}
                </p>
                <h3 className="display mt-1 text-xl text-text">
                  {formatMarketName(marketName, selectedMarket?.name || selectedMarket?.id)}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-border-soft bg-bg-deep/60 px-2.5 py-1.5 text-[9px] lg:text-xs font-black uppercase tracking-wide text-text-muted">
                <Database size={13} />
                Terkalibrasi
              </div>
            </div>

            <div
              className="my-5 flex w-full flex-nowrap justify-center gap-1.5 sm:gap-2"
              aria-label={`${result.digitCount} digit hasil Adaptive`}
            >
              {result.digits.map((digit, index) => (
                <div
                  key={`${digit}-${index}`}
                  className="desktop-digit-enter flex aspect-square min-w-0 max-w-12 flex-1 items-center justify-center rounded-lg border border-primary/45 bg-primary/20 text-base font-black text-primary-soft shadow-lg shadow-black/10 sm:rounded-xl sm:text-xl"
                  style={{ animationDelay: `${Math.min(index, 9) * 24}ms` }}
                >
                  {digit}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Confidence" value={percentage(result.estimatedSuccess)} />
              <Metric label="Reference" value={percentage(result.baselineSuccess)} />
              <Metric
                label="Edge"
                value={`${result.lift >= 0 ? "+" : ""}${percentage(result.lift)}`}
              />
              <Metric label="Signal" value={SIGNAL_LABELS[result.signalStrength]} />
            </div>

            <div className="mt-3 rounded-xl border border-border-soft bg-bg-deep/45 p-3 text-[10px] lg:text-xs leading-relaxed text-text-muted">
              <p>
                Basis {result.historyLength} result · data terakhir {result.latestDraw} · diperbarui{" "}
                {publishedAtLabel(result.publishedAt)}.
              </p>
              <p className="mt-1 text-[9px] lg:text-xs opacity-80">
                Berbasis analisis data, bukan kepastian hasil.
              </p>
            </div>
          </section>
        )}

        <AdaptiveEvaluationPanel
          marketId={activeMarketId}
          target2D={TARGET_2D}
          method={method}
          digitCount={digitCount}
          refreshKey={evaluationRefresh}
        />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-soft bg-bg-deep/55 p-3 text-center">
      <p className="text-[9px] lg:text-xs font-black uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-text">{value}</p>
    </div>
  );
}
