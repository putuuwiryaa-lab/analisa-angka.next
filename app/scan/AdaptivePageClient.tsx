"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Database, RefreshCw } from "lucide-react";
import AdaptiveEvaluationPanel from "./AdaptiveEvaluationPanel";
import AdaptiveMarketSelect, {
  type AdaptiveMarketOption,
} from "./_components/AdaptiveMarketSelect";
import type { AdaptiveMethod } from "@/lib/adaptive/types";
import type { Target2D } from "@/lib/engine/types";

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
  selectionCount: 18;
}

const TARGET_LABELS: Record<Target2D, string> = {
  depan: "2D Depan",
  tengah: "2D Tengah",
  belakang: "2D Belakang",
};

const METHOD_LABELS: Record<AdaptiveMethod, string> = {
  ai: "AI",
  bbfs: "BBFS",
};

const SIGNAL_LABELS: Record<AdaptiveResult["signalStrength"], string> = {
  low: "Rendah",
  medium: "Moderat",
  high: "Kuat",
};

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
  const [markets, setMarkets] = useState<AdaptiveMarketOption[]>([]);
  const [marketId, setMarketId] = useState("");
  const [method, setMethod] = useState<AdaptiveMethod>("bbfs");
  const [digitCount, setDigitCount] = useState(7);
  const [target2D, setTarget2D] = useState<Target2D>("belakang");
  const [result, setResult] = useState<AdaptiveResult | null>(null);
  const [marketName, setMarketName] = useState("");
  const [evaluationRefresh, setEvaluationRefresh] = useState(0);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMarkets() {
      try {
        const response = await fetch("/api/markets", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Gagal memuat pasaran.");
        if (cancelled) return;
        const rows: AdaptiveMarketOption[] = Array.isArray(payload) ? payload : [];
        setMarkets(rows);
        const defaultMarket = rows.find((market) =>
          /singapore|sgp/i.test(`${market.id} ${market.name}`)
        ) ?? rows[0];
        if (defaultMarket) setMarketId(defaultMarket.id);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Gagal memuat pasaran.");
        }
      } finally {
        if (!cancelled) setLoadingMarkets(false);
      }
    }

    void loadMarkets();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedMarket = useMemo(
    () => markets.find((market) => market.id === marketId),
    [marketId, markets],
  );

  function resetSnapshot() {
    setResult(null);
    setMarketName("");
    setError("");
  }

  function changeMarket(value: string) {
    if (value === marketId) return;
    setMarketId(value);
    resetSnapshot();
  }

  function changeMethod(value: AdaptiveMethod) {
    if (value === method) return;
    setMethod(value);
    resetSnapshot();
  }

  function changeTarget(value: Target2D) {
    if (value === target2D) return;
    setTarget2D(value);
    resetSnapshot();
  }

  function changeDigitCount(value: number) {
    if (value === digitCount) return;
    setDigitCount(value);
    resetSnapshot();
  }

  async function loadSnapshot() {
    if (!marketId) return;
    setRunning(true);
    setError("");

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adaptive", marketId, method, digitCount, target2D }),
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
    <main className="space-y-3 px-1 sm:px-0">
      <section className="animate-fade-in rounded-2xl border border-border-soft bg-surface/75 p-4 backdrop-blur-xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary-soft">
            <Activity size={21} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary-soft">
              Adaptive Intelligence
            </p>
            <h2 className="display text-xl text-text">Adaptive Intelligence</h2>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              Bukan sekadar membaca data. Sistem mengikuti perubahannya.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <AdaptiveMarketSelect
            markets={markets}
            value={marketId}
            selectedMarket={selectedMarket ?? null}
            disabled={loadingMarkets || busy}
            loading={loadingMarkets}
            onChange={changeMarket}
          />

          <div>
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.13em] text-text-muted">
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
              <span className="text-[10px] font-black uppercase tracking-[0.13em] text-text-muted">
                Jumlah Digit
              </span>
              <span className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-black text-primary-soft">
                {digitCount}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={9}
              step={1}
              value={digitCount}
              onChange={(event) => changeDigitCount(Number(event.target.value))}
              disabled={busy}
              className="w-full accent-[var(--color-primary)]"
            />
            <div className="mt-1 flex justify-between text-[9px] font-bold text-text-muted">
              <span>1</span>
              <span>9</span>
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.13em] text-text-muted">
              Fokus Analisis
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(["depan", "tengah", "belakang"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeTarget(value)}
                  disabled={busy}
                  className={`pressable min-h-11 rounded-xl border px-2 text-[10px] font-black uppercase tracking-wide transition-colors ${
                    target2D === value
                      ? "border-primary/50 bg-primary/20 text-primary-soft"
                      : "border-border-soft bg-bg-deep/60 text-text-muted hover:text-text"
                  }`}
                >
                  {TARGET_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={loadSnapshot}
            disabled={!marketId || busy || loadingMarkets}
            className="pressable flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary/55 bg-primary/25 text-sm font-black uppercase tracking-wide text-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={running ? "animate-spin" : ""} size={18} />
            {running ? "Menyelaraskan" : "Buka Analisis"}
          </button>
        </div>
      </section>

      {error && (
        <section className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
          {error}
        </section>
      )}

      {result && (
        <section className="animate-fade-in rounded-2xl border border-primary/30 bg-surface/80 p-4 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary-soft">
                Pilihan Utama · {METHOD_LABELS[result.method]} {result.digitCount} Digit · {TARGET_LABELS[result.target2D]}
              </p>
              <h3 className="display mt-1 text-xl text-text">
                {marketName || selectedMarket?.name}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-border-soft bg-bg-deep/60 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wide text-text-muted">
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
                className="flex aspect-square min-w-0 max-w-12 flex-1 items-center justify-center rounded-lg border border-primary/45 bg-primary/20 text-base font-black text-primary-soft shadow-lg shadow-black/10 sm:rounded-xl sm:text-xl"
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

          <div className="mt-3 rounded-xl border border-border-soft bg-bg-deep/45 p-3 text-[10px] leading-relaxed text-text-muted">
            <p>
              Basis {result.historyLength} result · data terakhir {result.latestDraw} · diperbarui {publishedAtLabel(result.publishedAt)}.
            </p>
            <p className="mt-1 text-[9px] opacity-80">
              Berbasis analisis data, bukan kepastian hasil.
            </p>
          </div>
        </section>
      )}

      <AdaptiveEvaluationPanel
        marketId={marketId}
        target2D={target2D}
        method={method}
        digitCount={digitCount}
        refreshKey={evaluationRefresh}
      />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-soft bg-bg-deep/55 p-3 text-center">
      <p className="text-[9px] font-black uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-black text-text">{value}</p>
    </div>
  );
}
