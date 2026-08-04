"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Database, Play, RefreshCw, ShieldCheck } from "lucide-react";
import AdaptiveEvaluationPanel from "./AdaptiveEvaluationPanel";
import type { AdaptiveMethod } from "@/lib/adaptive/types";
import type { Target2D } from "@/lib/engine/types";

interface MarketOption {
  id: string;
  name: string;
  lastResult?: string;
}

interface AdaptiveResult {
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
  replayMode: "full" | "incremental" | "noop";
  processedSteps: number;
  meanEnsembleLoss: number;
  stateRevision: number;
  settledPredictionId: string | null;
  persistence:
    | {
      status: "stored";
      predictionId: string;
      stateRevision: number;
      settledPredictionId: string | null;
    }
    | { status: "not_configured" };
}

interface ReconciliationSummary {
  status: "success" | "partial" | "failed";
  marketsProcessed: number;
  targetsProcessed: number;
  fullReplayTargets: number;
  incrementalTargets: number;
  noopTargets: number;
  settledPredictions: number;
  errorCount: number;
  remainingMarkets: number;
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

const REPLAY_LABELS: Record<AdaptiveResult["replayMode"], string> = {
  full: "Full replay",
  incremental: "Incremental",
  noop: "State terbaru",
};

function percentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function AdaptivePageClient() {
  const [markets, setMarkets] = useState<MarketOption[]>([]);
  const [marketId, setMarketId] = useState("");
  const [method, setMethod] = useState<AdaptiveMethod>("bbfs");
  const [digitCount, setDigitCount] = useState(7);
  const [target2D, setTarget2D] = useState<Target2D>("belakang");
  const [result, setResult] = useState<AdaptiveResult | null>(null);
  const [marketName, setMarketName] = useState("");
  const [reconciliation, setReconciliation] = useState<ReconciliationSummary | null>(null);
  const [evaluationRefresh, setEvaluationRefresh] = useState(0);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [running, setRunning] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMarkets() {
      try {
        const response = await fetch("/api/markets", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Gagal memuat pasaran.");
        if (cancelled) return;
        const rows = Array.isArray(payload) ? payload : [];
        setMarkets(rows);
        const defaultMarket = rows.find((market: MarketOption) => market.name.toUpperCase() === "SGP") ?? rows[0];
        if (defaultMarket) setMarketId(defaultMarket.id);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Gagal memuat pasaran.");
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

  async function runAdaptive() {
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
      if (!response.ok) throw new Error(payload?.error || "Adaptive gagal dijalankan.");
      setResult(payload.result);
      setMarketName(payload.market);
      setEvaluationRefresh((value) => value + 1);
    } catch (runError) {
      setResult(null);
      setError(runError instanceof Error ? runError.message : "Adaptive gagal dijalankan.");
    } finally {
      setRunning(false);
    }
  }

  async function runReconciliation() {
    setReconciling(true);
    setError("");

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adaptive-reconcile", marketLimit: 6 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Reconciliation Adaptive gagal.");
      setReconciliation(payload.summary);
      setEvaluationRefresh((value) => value + 1);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Reconciliation Adaptive gagal.");
    } finally {
      setReconciling(false);
    }
  }

  const busy = running || reconciling;

  return (
    <main className="space-y-3 px-1 sm:px-0">
      <section className="animate-fade-in rounded-2xl border border-border-soft bg-surface/75 p-4 backdrop-blur-xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary-soft">
            <Activity size={21} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary-soft">HF-APIE</p>
            <h2 className="display text-xl text-text">Adaptive Engine</h2>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              Probabilitas 2D dengan replay histori dan bobot online terpisah untuk setiap market serta target.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.13em] text-text-muted">Pasaran</span>
            <select
              value={marketId}
              onChange={(event) => setMarketId(event.target.value)}
              disabled={loadingMarkets || busy}
              className="h-12 w-full rounded-xl border border-border-soft bg-bg-deep/70 px-3 text-sm font-bold text-text outline-none focus:border-primary/60"
            >
              {loadingMarkets && <option value="">Memuat pasaran...</option>}
              {!loadingMarkets && markets.length === 0 && <option value="">Tidak ada pasaran</option>}
              {markets.map((market) => (
                <option key={market.id} value={market.id}>
                  {market.name} · {market.lastResult || "----"}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.13em] text-text-muted">Metode</span>
            <div className="grid grid-cols-2 gap-2">
              {(["ai", "bbfs"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMethod(value)}
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
              <span className="text-[10px] font-black uppercase tracking-[0.13em] text-text-muted">Jumlah Digit</span>
              <span className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-black text-primary-soft">{digitCount}</span>
            </div>
            <input
              type="range"
              min={1}
              max={9}
              step={1}
              value={digitCount}
              onChange={(event) => setDigitCount(Number(event.target.value))}
              disabled={busy}
              className="w-full accent-[var(--color-primary)]"
            />
            <div className="mt-1 flex justify-between text-[9px] font-bold text-text-muted"><span>1</span><span>9</span></div>
          </div>

          <div>
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.13em] text-text-muted">Target Analisa</span>
            <div className="grid grid-cols-3 gap-2">
              {(["depan", "tengah", "belakang"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTarget2D(value)}
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
            onClick={runAdaptive}
            disabled={!marketId || busy || loadingMarkets}
            className="pressable flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary/55 bg-primary/25 text-sm font-black uppercase tracking-wide text-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? <RefreshCw className="animate-spin" size={18} /> : <Play size={18} />}
            {running ? "Memproses" : "Proses Adaptive"}
          </button>

          <button
            type="button"
            onClick={runReconciliation}
            disabled={busy || loadingMarkets}
            className="pressable flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border-soft bg-bg-deep/55 text-[10px] font-black uppercase tracking-wide text-text-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {reconciling ? <RefreshCw className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
            {reconciling ? "Reconcile berjalan" : "Reconcile 6 Market · Admin"}
          </button>
        </div>
      </section>

      {error && (
        <section className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
          {error}
        </section>
      )}

      {reconciliation && (
        <section className="rounded-2xl border border-border-soft bg-surface/75 p-4 text-xs text-text-muted">
          <div className="flex items-center justify-between gap-3">
            <p className="font-black uppercase tracking-wide text-text">Reconciliation {reconciliation.status}</p>
            <span>{reconciliation.remainingMarkets} market tersisa</span>
          </div>
          <p className="mt-2 leading-relaxed">
            {reconciliation.marketsProcessed} market · {reconciliation.targetsProcessed} target · {reconciliation.settledPredictions} prediction di-settle · {reconciliation.errorCount} error.
          </p>
          <p className="mt-1 text-[10px]">
            Full {reconciliation.fullReplayTargets} · incremental {reconciliation.incrementalTargets} · state terbaru {reconciliation.noopTargets}.
          </p>
        </section>
      )}

      {result && (
        <section className="animate-fade-in rounded-2xl border border-primary/30 bg-surface/80 p-4 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary-soft">
                {METHOD_LABELS[result.method]} {result.digitCount} Digit · {TARGET_LABELS[result.target2D]}
              </p>
              <h3 className="display mt-1 text-xl text-text">{marketName || selectedMarket?.name}</h3>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-border-soft bg-bg-deep/60 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wide text-text-muted">
              <Database size={13} />
              {result.persistence.status === "stored" ? "Neon tersimpan" : "Preview"}
            </div>
          </div>

          <div className="my-5 flex flex-wrap justify-center gap-2">
            {result.digits.map((digit, index) => (
              <div
                key={`${digit}-${index}`}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/45 bg-primary/20 text-xl font-black text-primary-soft shadow-lg shadow-black/10"
              >
                {digit}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label={result.method === "ai" ? "Minimal 1 Hit" : "Full Cover"} value={percentage(result.estimatedSuccess)} />
            <Metric label="Baseline" value={percentage(result.baselineSuccess)} />
            <Metric label="Lift" value={`${result.lift >= 0 ? "+" : ""}${percentage(result.lift)}`} />
            <Metric label="Signal" value={result.signalStrength.toUpperCase()} />
          </div>

          <div className="mt-3 rounded-xl border border-border-soft bg-bg-deep/45 p-3 text-[10px] leading-relaxed text-text-muted">
            Engine {result.engineVersion} · histori {result.historyLength} result · cutoff {result.latestDraw} · bobot revision {result.stateRevision} · {REPLAY_LABELS[result.replayMode]}
            {result.processedSteps > 0 ? ` (${result.processedSteps} settlement replay)` : ""}
            {result.settledPredictionId ? " · prediction sebelumnya sudah di-settle" : ""}.
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
