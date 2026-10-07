import { RefreshCw, RotateCcw, Sparkles, type LucideIcon } from "lucide-react";
import {
  customFocusLabel,
  customFocusSubtitle,
  type CustomFocus,
  type TargetPair,
} from "@/lib/analysis/customDigit";
import { analysisScopeLabel, targetPairLabel, type AnalysisScope } from "./ScopeSelectors";
import { PageTopBar } from "@/components/layout/PageTopBar";
import { Button } from "@/components/ui/Button";
import { formatMarketName } from "@/lib/markets/format";

function SelectionChip({
  label,
  value,
  onReset,
  disabled,
}: {
  label: string;
  value: string;
  onReset: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onReset}
      disabled={disabled}
      className="pressable depth-3 flex min-h-10 min-w-0 items-center gap-2 rounded-2xl border px-3 py-2 text-left hover:border-border disabled:cursor-wait disabled:opacity-60"
      aria-label={`Ganti ${label}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] lg:text-xs font-black uppercase tracking-wide text-text-soft">
          {label}
        </span>
        <span className="accent-text block break-words text-[10px] lg:text-xs font-black uppercase tracking-wide">
          {value}
        </span>
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
      <div className="mb-3">
        <PageTopBar title="Analisa" onBack={onBack} backLabel="Kembali" />
      </div>

      <section className="animate-rise depth-accent relative mb-4 overflow-hidden rounded-3xl border p-4">
        <div className="accent-bg-soft absolute -right-12 -top-12 h-28 w-28 rounded-full blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="depth-3 accent-text flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border">
            <Icon size={22} strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="accent-text text-[9px] lg:text-xs font-black uppercase tracking-[0.18em]">
              Pasaran Analisa
            </div>
            <h1 className="display mt-1 break-words text-[2rem] leading-none text-text sm:text-[2.25rem]">
              {formatMarketName(marketId)}
            </h1>
            <div className="depth-3 accent-text mt-2.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] lg:text-xs font-black uppercase tracking-wide">
              <Sparkles size={10} /> {title}
            </div>
          </div>
        </div>

        {hasSelection ? (
          <div className="relative mt-4 grid grid-cols-1 gap-2">
            {isAI && analysisScope ? (
              <SelectionChip
                label="AI"
                value={analysisScopeLabel(analysisScope)}
                onReset={onAIScopeReset}
                disabled={loading}
              />
            ) : null}
            {needsTargetPair && targetPair ? (
              <SelectionChip
                label="Fokus"
                value={targetPairLabel(targetPair)}
                onReset={onTargetPairReset}
                disabled={loading}
              />
            ) : null}
            {isBBFS && analysisScope && analysisScope !== "default" ? (
              <SelectionChip
                label="BBFS"
                value={analysisScopeLabel(analysisScope)}
                onReset={onBBFSScopeReset}
                disabled={loading}
              />
            ) : null}
            {isRekapCustom && customFocus ? (
              <SelectionChip
                label="Rekap"
                value={`${customFocusLabel(customFocus)} · ${customFocusSubtitle(customFocus)}`}
                onReset={onCustomFocusReset}
                disabled={loading}
              />
            ) : null}
          </div>
        ) : null}
      </section>

      {canStartAnalyze || loading ? (
        <Button
          variant="accent"
          size="lg"
          className="mb-4 w-full"
          onClick={onStartAnalyze}
          disabled={loading}
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          {loading ? "Memproses..." : "Mulai Analisa"}
        </Button>
      ) : null}
    </>
  );
}
