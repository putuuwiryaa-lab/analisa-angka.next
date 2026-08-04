"use client";

import { useEffect, useState } from "react";
import { CircleAlert, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import type {
  AdaptiveGuardrailHealth,
  AdaptiveGuardrailOperationalStatus,
} from "@/lib/adaptive/guardrail-health-types";
import type { Target2D } from "@/lib/engine/types";

interface AdaptiveGuardrailHealthCardProps {
  marketId: string;
  target2D: Target2D;
  refreshKey: number;
}

const STATUS_LABELS: Record<AdaptiveGuardrailOperationalStatus, string> = {
  migration_required: "Migration belum lengkap",
  waiting_for_state: "Menunggu state",
  waiting_for_run: "Menunggu run pascamigrasi",
  warmup: "Guardrail warmup",
  active: "Guardrail aktif",
};

function decimal(value: number, digits = 4): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function statusClasses(status: AdaptiveGuardrailOperationalStatus): string {
  if (status === "active") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (status === "warmup" || status === "waiting_for_run") {
    return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  }
  if (status === "migration_required") return "border-red-400/30 bg-red-500/10 text-red-200";
  return "border-border-soft bg-bg-deep/45 text-text-muted";
}

export default function AdaptiveGuardrailHealthCard({
  marketId,
  target2D,
  refreshKey,
}: AdaptiveGuardrailHealthCardProps) {
  const [health, setHealth] = useState<AdaptiveGuardrailHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manualRefresh, setManualRefresh] = useState(0);

  useEffect(() => {
    if (!marketId) return;

    const controller = new AbortController();
    setLoading(true);
    setError("");

    void fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "adaptive-guardrail-health",
        marketId,
        target2D,
      }),
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || "Gagal membaca health guardrail.");
        setHealth(payload.health);
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setHealth(null);
        setError(loadError instanceof Error ? loadError.message : "Gagal membaca health guardrail.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [manualRefresh, marketId, refreshKey, target2D]);

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-[10px] text-red-200">
        <CircleAlert size={14} className="mt-0.5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border-soft bg-bg-deep/45 py-5 text-[10px] font-bold text-text-muted">
        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        Memeriksa guardrail
      </div>
    );
  }

  const HealthyIcon = health.operational ? ShieldCheck : ShieldAlert;
  const detector = health.runtime.detector;

  return (
    <div className={`rounded-xl border p-3 ${statusClasses(health.status)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <HealthyIcon size={17} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-wide opacity-75">Operational Guardrail</p>
            <p className="mt-0.5 text-xs font-black">{STATUS_LABELS[health.status]}</p>
            <p className="mt-1 text-[9px] leading-relaxed opacity-80">
              Schema {health.migration.completedObjects}/{health.migration.requiredObjects} · mode {health.mode} · drift {health.runtime.driftState}.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setManualRefresh((value) => value + 1)}
          disabled={loading}
          className="pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-current/20 bg-black/10 disabled:opacity-50"
          aria-label="Muat ulang health guardrail"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <GuardrailMetric label="Fingerprint" value={health.runtime.fingerprintPrefix ?? "belum ada"} />
        <GuardrailMetric label="Settlement" value={String(health.runtime.settlementCount)} />
        <GuardrailMetric label="Live Sample" value={`${detector.sampleCount}/10`} />
        <GuardrailMetric label="EWMA Loss" value={decimal(detector.ewmaLoss)} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-[9px] opacity-80">
        <span className="min-w-0 truncate">Reason: {detector.reason}</span>
        <span className="shrink-0">PH {decimal(detector.pageHinkley)}</span>
      </div>

      {health.issues.length > 0 && (
        <p className="mt-2 text-[9px] leading-relaxed opacity-80">
          {health.issues.join(" · ")}
        </p>
      )}
    </div>
  );
}

function GuardrailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-current/15 bg-black/10 p-2 text-center">
      <p className="text-[7px] font-black uppercase tracking-wide opacity-65">{label}</p>
      <p className="mt-1 truncate text-[10px] font-black">{value}</p>
    </div>
  );
}
