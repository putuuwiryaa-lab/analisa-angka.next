import { ArrowLeft, RefreshCw, Sparkles } from "lucide-react";
import {
  customFocusLabel,
  customFocusSubtitle,
  type CustomFocus,
  type TargetPair,
} from "@/lib/analysis/customDigit";
import { analysisScopeLabel, targetPairLabel, type AnalysisScope } from "./ScopeSelectors";
import { Button } from "@/components/ui/Button";

function StatusPill({ label, value, onReset }: { label: string; value: string; onReset: () => void }) {
  return (
    <div className="animate-rise depth-3 mt-3 flex items-center justify-between gap-2 rounded-2xl border px-3 py-2.5">
      <div className="min-w-0 flex-1 text-left">
        <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wide text-text-soft">
          {label}:
        </span>
        <span className="accent-text text-[11px] font-black uppercase tracking-wide leading-relaxed">{value}</span>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="pressable shrink-0 rounded-full border border-border-soft bg-white/[0.035] px-3 py-1.5 text-[11px] font-bold text-text-muted hover:border-border hover:text-text"
      >
        Ganti
      </button>
    </div>
  );
}

export function AnalysisPageChrome({
  title,
  icon,
  marketId,
  isAI,
  isBBFS,
  isRekapCustom,
  needsTargetPair,
  analysisScope,
  targetPair,
  customFocus,
  loading,
  canStartAnalyze,
  onBack,
  onStartAnalyze,
  onAIScopeReset,
  onTargetPairReset,
  onBBFSScopeReset,
  onCustomFocusReset,
}: {
  title: string;
  icon: string;
  marketId: string;
  isAI: boolean;
  isBBFS: boolean;
  isRekapCustom: boolean;
  needsTargetPair: boolean;
  analysisScope: AnalysisScope | null;
  targetPair: TargetPair | null;
  customFocus: CustomFocus | null;
  loading: boolean;
  canStartAnalyze: boolean;
  onBack: () => void;
  onStartAnalyze: () => void;
  onAIScopeReset: () => void;
  onTargetPairReset: () => void;
  onBBFSScopeReset: () => void;
  onCustomFocusReset: () => void;
}) {
  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3" onClick={onBack}>
        <ArrowLeft size={16} /> Kembali
      </Button>

      <div className="animate-rise depth-1 relative mb-4 overflow-hidden rounded-3xl border p-4">
        <div className="accent-bg-soft absolute -right-12 -top-12 h-28 w-28 rounded-full blur-3xl" />
        <div className="relative mb-4 flex items-center gap-3">
          <div className="depth-3 accent-text flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-lg">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="depth-3 accent-text mb-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide">
              <Sparkles size={10} /> Mode Analisa
            </div>
            <h2 className="display truncate text-base text-text">{title}</h2>
          </div>
        </div>

        <div className="depth-2 flex min-h-[88px] items-center justify-center rounded-[1.35rem] border px-5 py-5 text-center">
          <p className="display break-words text-[2rem] leading-[1.05] text-text sm:text-[2.35rem]">
            {marketId}
          </p>
        </div>

        {isAI && analysisScope && (
          <StatusPill label="AI" value={analysisScopeLabel(analysisScope)} onReset={onAIScopeReset} />
        )}
        {needsTargetPair && targetPair && (
          <StatusPill label="Fokus" value={targetPairLabel(targetPair)} onReset={onTargetPairReset} />
        )}
        {isBBFS && analysisScope && analysisScope !== "default" && (
          <StatusPill label="BBFS" value={analysisScopeLabel(analysisScope)} onReset={onBBFSScopeReset} />
        )}
        {isRekapCustom && customFocus && (
          <StatusPill
            label="Rekap"
            value={`${customFocusLabel(customFocus)} · ${customFocusSubtitle(customFocus)}`}
            onReset={onCustomFocusReset}
          />
        )}
      </div>

      {(canStartAnalyze || loading) && (
        <Button size="lg" className="mb-4 w-full" onClick={onStartAnalyze} disabled={loading}>
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          {loading ? "Memproses..." : "Mulai Analisa"}
        </Button>
      )}
    </>
  );
}
