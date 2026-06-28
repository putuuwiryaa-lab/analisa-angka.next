"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { EvaluationHistory } from "@/components/history/EvaluationHistory";
import { evaluationModes } from "@/lib/analysis/constants";
import { safeArray, statsFrom } from "@/lib/analysis/utils";
import { DetailToggle, SectionTitle, ShioChip } from "./Shared";
import { AngkaJadiPanel } from "./AngkaJadiPanel";

type TargetPair = "depan" | "tengah" | "belakang";
type AnalysisScope = "default" | "4d" | "3d" | "2d_depan" | "2d_tengah" | "2d_belakang";
type ResultData = Record<string, any>;

function StatsList({ stats }: { stats: any[] }) {
  if (!stats.length)
    return (
      <div className="depth-2 rounded-2xl border p-4 text-center text-[11px] font-bold uppercase tracking-wide text-text-muted">
        Belum ada statistik aktif
      </div>
    );
  return (
    <div className="space-y-2">
      {stats.map((s, i) => {
        const score = s.hits ?? s.score ?? 0;
        const pct = Math.min(100, Math.max(8, (Number(score) / 14) * 100));
        return (
          <div
            key={i}
            className="animate-soft-pop depth-2 grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border p-3"
          >
            <span className="accent-border accent-text rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wide">
              Elite
            </span>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-semibold uppercase tracking-wide text-text opacity-90">
                {s.name || `Rumus ${i + 1}`}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <span className="num accent-text text-[11px] font-black">{score}/14</span>
          </div>
        );
      })}
    </div>
  );
}

function DigitPills({
  items,
  compact = true,
  singleLine = false,
  center = false,
}: {
  items: any[];
  compact?: boolean;
  singleLine?: boolean;
  center?: boolean;
}) {
  if (singleLine) {
    return (
      <div
        className="grid w-full gap-1.5"
        style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
      >
        {items.map((item, i) => (
          <div key={i} className={cnPill(true, compact)}>
            {item}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap ${center ? "justify-center" : "justify-end"} gap-2`}>
      {items.map((item, i) => (
        <div key={i} className={cnPill(false, compact)}>
          {item}
        </div>
      ))}
    </div>
  );
}

function cnPill(singleLine: boolean, compact: boolean) {
  const size = singleLine
    ? "h-11 min-w-0 px-0 text-lg"
    : compact
      ? "h-10 min-w-10 px-3 text-base"
      : "h-14 min-w-14 px-4 text-3xl";
  return `depth-accent display flex shrink-0 items-center justify-center rounded-2xl border text-text ${size}`;
}

function ResultRow({ label, values, shio = false }: { label: string; values: any; shio?: boolean }) {
  return (
    <div className="animate-soft-pop depth-2 flex min-h-[68px] items-center justify-between gap-3 rounded-2xl border p-4">
      <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-text-soft">{label}</span>
      <div className="min-w-0 flex-1">
        {shio ? (
          <div className="flex flex-wrap justify-end gap-2">
            {safeArray(values).map((s, i) => (
              <ShioChip key={`${s}-${i}`} value={s} />
            ))}
          </div>
        ) : (
          <DigitPills items={safeArray(values)} compact />
        )}
      </div>
    </div>
  );
}

function MainResultCard({
  values,
  shio = false,
  singleLine = false,
  stacked = false,
  badge,
}: {
  values: any;
  shio?: boolean;
  singleLine?: boolean;
  stacked?: boolean;
  badge?: string;
}) {
  const arr = safeArray(values);
  const useStacked = stacked || shio;
  return (
    <div className="animate-soft-pop depth-accent relative overflow-hidden rounded-3xl border p-4">
      <div className="accent-bg-soft absolute -right-16 -top-16 h-44 w-44 rounded-full blur-3xl" />
      <div className="relative mb-3 flex items-center justify-between gap-3">
        <div className="depth-3 accent-text inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide">
          <Trophy size={12} /> Hasil Utama
        </div>
        {badge && (
          <span className="depth-3 accent-text rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide">
            {badge}
          </span>
        )}
      </div>
      {useStacked ? (
        <div className="depth-2 relative rounded-3xl border p-4 text-center">
          {shio ? (
            <div className="flex flex-wrap justify-center gap-2">
              {arr.map((s, i) => (
                <ShioChip key={`${s}-${i}`} value={s} />
              ))}
            </div>
          ) : (
            <DigitPills items={arr} compact={false} singleLine={singleLine} center />
          )}
        </div>
      ) : (
        <div className="depth-2 relative rounded-3xl border p-4">
          <DigitPills items={arr} compact={false} singleLine={singleLine} center />
        </div>
      )}
    </div>
  );
}

function DetailValidationHeader({
  activeLabel,
  open,
  onToggle,
}: {
  activeLabel: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <SectionTitle title="Detail Validasi" />
      <div className="flex shrink-0 items-center gap-2">
        <span className="depth-3 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-text-muted">
          {activeLabel}
        </span>
        <DetailToggle open={open} onClick={onToggle} />
      </div>
    </div>
  );
}

function MatiEvaluationTabs({ marketId, param }: { marketId: string; param: number }) {
  const [activePosition, setActivePosition] = useState<"as" | "kop" | "kepala" | "ekor">("as");
  const tabs = [
    { key: "as", label: "AS" },
    { key: "kop", label: "KOP" },
    { key: "kepala", label: "KEPALA" },
    { key: "ekor", label: "EKOR" },
  ] as const;
  const activeLabel = tabs.find((tab) => tab.key === activePosition)?.label || "AS";

  return (
    <div className="animate-rise depth-1 space-y-3 rounded-3xl border p-4">
      <div className="flex items-center justify-between px-1">
        <span className="display text-xs text-text">Riwayat Evaluasi</span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-text-soft">Per Posisi</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {tabs.map((tab) => {
          const active = activePosition === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActivePosition(tab.key)}
              className={
                active
                  ? "pressable depth-accent accent-text rounded-2xl border px-2 py-3 text-[11px] font-black uppercase tracking-wide"
                  : "pressable depth-3 rounded-2xl border px-2 py-3 text-[11px] font-black uppercase tracking-wide text-text-muted hover:border-border hover:bg-white/[0.06]"
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <EvaluationHistory
        marketId={marketId}
        mode="mati"
        param={param}
        position={activePosition}
        title={`Riwayat ${activeLabel}`}
      />
    </div>
  );
}

export function AnalysisResult({
  type,
  result,
  param,
  marketId,
  targetPair = "belakang",
  analysisScope = "default",
  detailValidationOpen,
  setDetailValidationOpen,
  angkaJadiOpen,
  setAngkaJadiOpen,
}: {
  type: string;
  result: ResultData;
  param: number | null;
  marketId: string;
  label: string;
  targetPair?: TargetPair;
  analysisScope?: AnalysisScope;
  detailValidationOpen: boolean;
  setDetailValidationOpen: (fn: (value: boolean) => boolean) => void;
  angkaJadiOpen: boolean;
  setAngkaJadiOpen: (fn: (value: boolean) => boolean) => void;
}) {
  if (type === "mati") {
    const POS = ["AS", "KOP", "KEPALA", "EKOR"];
    const totalActive = POS.reduce((acc, p) => acc + statsFrom(result[p]).length, 0);
    return (
      <div className="animate-rise space-y-4">
        <div className="depth-1 space-y-3 rounded-3xl border p-4">
          {POS.map((p) => (
            <ResultRow key={p} label={`OFF ${p}`} values={result[p]?.result} />
          ))}
        </div>
        <div className="animate-soft-pop depth-1 space-y-5 rounded-3xl border p-4">
          <DetailValidationHeader
            activeLabel={`RUMUS ACTIVE ${totalActive}/56`}
            open={detailValidationOpen}
            onToggle={() => setDetailValidationOpen((open) => !open)}
          />
          {detailValidationOpen &&
            POS.map((p) => (
              <section key={p} className="animate-rise space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="display accent-text text-[11px]">{p}</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <StatsList stats={statsFrom(result[p])} />
              </section>
            ))}
        </div>
        <AngkaJadiPanel type={type} result={result} open={angkaJadiOpen} setOpen={setAngkaJadiOpen} />
        {param !== 0 && <MatiEvaluationTabs marketId={marketId} param={param || 1} />}
      </div>
    );
  }

  const stats = safeArray(result.stats);
  const displayResult = safeArray(result.result);
  const active = result.elitCount ?? result.eliteTotal ?? stats.length;
  const effectiveMode = result.evaluationMode || type;
  const effectiveParam = result.evaluationParam || param || 1;
  const effectiveAnalysisScope = (result.analysis_scope || analysisScope || "default") as AnalysisScope;
  const isTraditionalBbfs = type === "bbfs7_tradisional";
  const formulaTotal =
    isTraditionalBbfs ? 60 : type === "ai" || type === "bbfs" ? 35 : type === "jumlah" ? 56 : type === "shio" ? 60 : 50;
  const isBBFSResult = type === "bbfs" || isTraditionalBbfs;
  const isAIResult = type === "ai";
  const isBbfsGgbkResult = type === "bbfs" && effectiveParam === 10 && Boolean(result.bbfsGgbk);
  const resultBadge = isBbfsGgbkResult ? result.bbfsGgbk?.label : isTraditionalBbfs ? `${active}/${formulaTotal} Lolos` : undefined;

  return (
    <div className="animate-rise space-y-4">
      <MainResultCard
        values={displayResult}
        shio={type === "shio"}
        singleLine={isBBFSResult || isAIResult}
        stacked={type === "ai" || isBBFSResult}
        badge={resultBadge}
      />
      <div className="animate-soft-pop depth-1 rounded-3xl border p-4">
        <DetailValidationHeader
          activeLabel={`RUMUS ACTIVE ${active}/${formulaTotal}`}
          open={detailValidationOpen}
          onToggle={() => setDetailValidationOpen((open) => !open)}
        />
        {detailValidationOpen && (
          <div className="animate-rise mt-4">
            <StatsList stats={stats} />
          </div>
        )}
      </div>
      <AngkaJadiPanel type={type} result={result} open={angkaJadiOpen} setOpen={setAngkaJadiOpen} />
      {evaluationModes.has(effectiveMode) && param !== 0 && (
        <div className="animate-soft-pop depth-1 space-y-3 rounded-3xl border p-4">
          <EvaluationHistory
            marketId={marketId}
            mode={effectiveMode}
            param={effectiveParam}
            targetPair={targetPair}
            analysisScope={effectiveAnalysisScope}
            title={isBbfsGgbkResult ? "Riwayat BBFS GGBK 8D" : undefined}
          />
        </div>
      )}
    </div>
  );
}
