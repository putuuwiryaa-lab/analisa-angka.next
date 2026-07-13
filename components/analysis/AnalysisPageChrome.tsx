import { ArrowLeft, RefreshCw, RotateCcw, Sparkles, type LucideIcon } from "lucide-react";
import {
  customFocusLabel,
  customFocusSubtitle,
  type CustomFocus,
  type TargetPair,
} from "@/lib/analysis/customDigit";
import { analysisScopeLabel, targetPairLabel, type AnalysisScope } from "./ScopeSelectors";
import { Button } from "@/components/ui/Button";

function SelectionChip({ label, value, onReset }: { label: string; value: string; onReset: () => void }) {
  return (
    <button
      type="button"
      onClick={onReset}
      className="pressable depth-3 flex min-h-10 min-w-0 items-center gap-2 rounded-2xl border px-3 text-left hover:border-border"
      aria-label={`Ganti ${label}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-black uppercase tracking-wide text-text-soft">{label}</span>
        <span className="accent-text block truncate text-[10px] font-black uppercase tracking-wide">{value}</span>
      </span>
      <RotateCcw size={13} className="shrink-0 text-text-soft" />
    </button>
  );
}

export function AnalysisPageChrome({
  title,
  icon: Icon,
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
  icon: LucideIcon;
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
  const hasSelection =
    (isAI && Boolean(analysisScope)) ||
    (needsTargetPair && Boolean(targetPair)) ||
    (isBBFS && Boolean(analysisScope && analysisScope !== "default")) ||
    (isRekapCustom && Boolean(customFocus));

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3" onClick={onBack}>
        <ArrowLeft size={16} /> Kembali
      </Button>

      <section className="animate-rise depth-accent relative mb-4 overflow-hidden rounded-3xl border p-4">
        <div className="accent-bg-soft absolute -right-12 -top-12 h-28 w-28 rounded-full blur-3xl" />

        <div className="relative flex items-start gap-3">
          <div className="depth-3 accent-text flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border">
            <Icon size={22} strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="accent-text flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em]">
              <Sparkles size={10} /> Mode Analisa
            </div>
            <h1 className="display mt-1 text-base text-text">{title}</h1>
            <p className="display mt-3 break-words text-[1.75rem] leading-tight text-text sm:text-[2rem]">{marketId}</p>
          </div>
        </div>

        {hasSelection ? (
          <div className="relative mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {isAI && analysisScope ? (
              <SelectionChip label="AI" value={analysisScopeLabel(analysisScope)} onReset={onAIScopeReset} />
            ) : null}
            {needsTargetPair && targetPair ? (
              <SelectionChip label="Fokus" value={targetPairLabel(targetPair)} onReset={onTargetPairReset} />
            ) : null}
            {isBBFS && analysisScope && analysisScope !== "default" ? (
              <SelectionChip label="BBFS" value={analysisScopeLabel(analysisScope)} onReset={onBBFSScopeReset} />
            ) : null}
            {isRekapCustom && customFocus ? (
              <SelectionChip
                label="Rekap"
                value={`${customFocusLabel(customFocus)} · ${customFocusSubtitle(customFocus)}`}
                onReset={onCustomFocusReset}
              />
            ) : null}
          </div>
        ) : null}
      </section>

      {(canStartAnalyze || loading) ? (
        <Button variant="accent" size="lg" className="mb-4 w-full" onClick={onStartAnalyze} disabled={loading}>
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          {loading ? "Memproses..." : "Mulai Analisa"}
        </Button>
      ) : null}
    </>
  );
}
