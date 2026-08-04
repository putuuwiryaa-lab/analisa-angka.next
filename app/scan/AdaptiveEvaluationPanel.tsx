"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Gauge,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import AdaptiveGuardrailHealthCard from "./AdaptiveGuardrailHealthCard";
import type { AdaptiveEvaluationDashboard, AdaptiveEvaluationStage } from "@/lib/adaptive/evaluation-types";
import type { AdaptiveMethod } from "@/lib/adaptive/types";
import type { Target2D } from "@/lib/engine/types";

interface AdaptiveEvaluationPanelProps {
  marketId: string;
  target2D: Target2D;
  method: AdaptiveMethod;
  digitCount: number;
  refreshKey: number;
}

const STAGE_LABELS: Record<AdaptiveEvaluationStage, string> = {
  empty: "Belum ada data",
  warmup: "Warmup",
  shadow: "Shadow",
  monitoring: "Monitoring",
  evidence: "Evidence",
};

function percentage(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

function decimal(value: number | null, digits = 4): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function compactExpertName(value: string): string {
  return value
    .replaceAll("positional-frequency", "Posisi")
    .replaceAll("direct-pair-frequency", "Pair")
    .replaceAll("decayed-pair-frequency", "Decay")
    .replaceAll("pair-transition", "Transisi")
    .replaceAll("-h", " · H");
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AdaptiveEvaluationPanel({
  marketId,
  target2D,
  method,
  digitCount,
  refreshKey,
}: AdaptiveEvaluationPanelProps) {
  const [dashboard, setDashboard] = useState<AdaptiveEvaluationDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manualRefresh, setManualRefresh] = useState(0);

  useEffect(() => {
    if (!marketId) {
      setDashboard(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");

    void fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "adaptive-evaluation",
        marketId,
        target2D,
        method,
        digitCount,
        window: 100,
      }),
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || "Gagal memuat evaluasi Adaptive.");
        setDashboard(payload.dashboard);
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setDashboard(null);
        setError(loadError instanceof Error ? loadError.message : "Gagal memuat evaluasi Adaptive.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [digitCount, manualRefresh, marketId, method, refreshKey, target2D]);

  const selectedMetric = useMemo(
    () => dashboard?.selectionMetrics.find(
      (metric) => metric.method === method && metric.digitCount === digitCount,
    ) ?? null,
    [dashboard, digitCount, method],
  );

  const progress = dashboard
    ? Math.min(100, (dashboard.readiness.settlements / dashboard.readiness.targetSettlements) * 100)
    : 0;
  const trend = dashboard?.overview.lossTrend ?? null;

  return (
    <section className="animate-fade-in rounded-2xl border border-border-soft bg-surface/75 p-4 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary-soft">
            <BarChart3 size={19} />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-primary-soft">Audit Neon</p>
            <h3 className="display text-lg text-text">Evaluasi Produksi</h3>
            <p className="mt-1 text-[10px] leading-relaxed text-text-muted">
              Loss, hit rate, calibration, dan perubahan bobot dari settlement nyata.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setManualRefresh((value) => value + 1)}
          disabled={loading || !marketId}
          className="pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-soft bg-bg-deep/55 text-text-muted disabled:opacity-50"
          aria-label="Muat ulang evaluasi"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-xs text-red-200">
          <CircleAlert size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!error && loading && !dashboard && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-border-soft bg-bg-deep/45 py-8 text-xs font-bold text-text-muted">
          <RefreshCw size={15} className="animate-spin" />
          Membaca evaluasi Neon
        </div>
      )}

      {marketId && (
        <div className="mt-4">
          <AdaptiveGuardrailHealthCard
            marketId={marketId}
            target2D={target2D}
            refreshKey={refreshKey + manualRefresh}
          />
        </div>
      )}

      {dashboard && (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-border-soft bg-bg-deep/45 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-wide text-text-muted">Status Bukti</p>
                <p className="mt-0.5 text-sm font-black text-text">{STAGE_LABELS[dashboard.readiness.stage]}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-primary-soft">
                  {dashboard.readiness.settlements}/{dashboard.readiness.targetSettlements}
                </p>
                <p className="text-[9px] uppercase tracking-wide text-text-muted">settlement</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-text-muted">
              Calibration formal dibuka setelah minimal 30 sampel untuk kombinasi {method.toUpperCase()} {digitCount} digit.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <AuditMetric label="Combined Loss" value={decimal(dashboard.overview.meanCombinedLoss)} />
            <AuditMetric label="Pair Brier" value={decimal(dashboard.overview.meanPairBrier)} />
            <AuditMetric label="Recent 10" value={decimal(dashboard.overview.recent10Loss)} />
            <AuditMetric label="Pending" value={String(dashboard.overview.pendingPredictions)} />
          </div>

          <div className="rounded-xl border border-border-soft bg-bg-deep/45 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Gauge size={15} className="text-primary-soft" />
                <p className="text-[10px] font-black uppercase tracking-wide text-text">Performa Selection</p>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wide text-text-muted">
                {method.toUpperCase()} {digitCount}
              </span>
            </div>

            {selectedMetric ? (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <AuditMetric label="Hit Rate" value={percentage(selectedMetric.hitRate)} />
                <AuditMetric label="Estimasi" value={percentage(selectedMetric.averageEstimated)} />
                <AuditMetric label="Baseline" value={percentage(selectedMetric.averageBaseline)} />
                <AuditMetric label="Sampel" value={String(selectedMetric.samples)} />
              </div>
            ) : (
              <p className="mt-3 rounded-lg border border-border-soft bg-surface/40 p-3 text-[10px] leading-relaxed text-text-muted">
                Belum ada selection {method.toUpperCase()} {digitCount} digit yang sudah di-settle. Prediction yang sekarang masih menjadi data pending pertama.
              </p>
            )}

            {selectedMetric && (
              <div className="mt-3 flex items-center justify-between gap-3 text-[10px]">
                <span className="text-text-muted">Gap aktual − estimasi</span>
                <span className={`font-black ${Math.abs(selectedMetric.calibrationGap) <= 0.05 ? "text-emerald-300" : "text-amber-300"}`}>
                  {selectedMetric.calibrationGap >= 0 ? "+" : ""}{percentage(selectedMetric.calibrationGap)}
                </span>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border-soft bg-bg-deep/45 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-text">Trend Loss</p>
              {trend === null ? (
                <span className="text-[9px] text-text-muted">Butuh 20 settlement</span>
              ) : trend <= 0 ? (
                <span className="flex items-center gap-1 text-[10px] font-black text-emerald-300"><TrendingDown size={13} /> membaik {decimal(Math.abs(trend))}</span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-black text-amber-300"><TrendingUp size={13} /> memburuk {decimal(trend)}</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border-soft bg-bg-deep/45 p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-text">Calibration Bucket</p>
            {dashboard.calibration.length === 0 ? (
              <p className="mt-2 text-[10px] leading-relaxed text-text-muted">
                Belum ada bucket untuk selection ini. Data akan muncul setelah prediction pertama di-settle.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {dashboard.calibration.map((bucket) => (
                  <div key={`${bucket.lower}-${bucket.upper}`}>
                    <div className="mb-1 flex items-center justify-between text-[9px] text-text-muted">
                      <span>{percentage(bucket.lower, 0)}–{percentage(bucket.upper, 0)} · n={bucket.samples}</span>
                      <span>aktual {percentage(bucket.hitRate)}</span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-surface">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-primary/40" style={{ width: `${Math.min(100, bucket.averageEstimated * 100)}%` }} />
                      <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${Math.min(100, bucket.hitRate * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {dashboard.expertPerformance.length > 0 && (
            <div className="rounded-xl border border-border-soft bg-bg-deep/45 p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-text">Expert Loss Terendah</p>
              <div className="mt-3 space-y-2">
                {dashboard.expertPerformance.slice(0, 5).map((expert, index) => (
                  <div key={expert.expertId} className="flex items-center justify-between gap-3 text-[10px]">
                    <span className="min-w-0 truncate text-text-muted">#{index + 1} {compactExpertName(expert.expertId)}</span>
                    <span className="shrink-0 font-black text-text">{decimal(expert.meanLoss)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dashboard.weightChanges.length > 0 && (
            <div className="rounded-xl border border-border-soft bg-bg-deep/45 p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-text">Perubahan Bobot Terakhir</p>
              <div className="mt-3 space-y-2">
                {dashboard.weightChanges.slice(0, 5).map((change) => (
                  <div key={change.expertId} className="flex items-center justify-between gap-3 text-[10px]">
                    <span className="min-w-0 truncate text-text-muted">{compactExpertName(change.expertId)}</span>
                    <span className={`shrink-0 font-black ${change.delta >= 0 ? "text-emerald-300" : "text-amber-300"}`}>
                      {change.delta >= 0 ? "+" : ""}{percentage(change.delta, 2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border-soft bg-bg-deep/45 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-text">Settlement Terbaru</p>
              <span className="text-[9px] text-text-muted">maks. 20</span>
            </div>
            {dashboard.recentSettlements.length === 0 ? (
              <p className="mt-2 text-[10px] leading-relaxed text-text-muted">
                Belum ada settlement. Setelah result berikutnya masuk melalui scraper, baris pertama akan muncul di sini.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {dashboard.recentSettlements.slice(0, 8).map((settlement) => (
                  <div key={settlement.predictionId} className="flex items-center justify-between gap-3 rounded-lg border border-border-soft bg-surface/35 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {settlement.hit === true ? (
                        <CheckCircle2 size={14} className="shrink-0 text-emerald-300" />
                      ) : settlement.hit === false ? (
                        <CircleAlert size={14} className="shrink-0 text-amber-300" />
                      ) : (
                        <Gauge size={14} className="shrink-0 text-text-muted" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-black text-text">Result {settlement.actualPair}</p>
                        <p className="truncate text-[9px] text-text-muted">{formatTime(settlement.createdAt)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-text">loss {decimal(settlement.combinedLoss)}</p>
                      <p className="text-[9px] text-text-muted">est. {percentage(settlement.estimatedSuccess)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {dashboard.state && (
            <p className="px-1 text-[9px] leading-relaxed text-text-muted">
              State revision {dashboard.state.stateRevision} · histori {dashboard.state.processedHistoryLength} · replay {dashboard.state.replayCount} · drift {dashboard.state.driftState}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function AuditMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-soft bg-surface/45 p-3 text-center">
      <p className="text-[8px] font-black uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-black text-text">{value}</p>
    </div>
  );
}
