import {
  CUSTOM_FOCUS_OPTIONS,
  customFocusSubtitle,
  type BBFSAnalysisScope,
  type CustomFocus,
  type TargetPair,
} from "@/lib/analysis/customDigit";

export type AnalysisScope = "default" | BBFSAnalysisScope;

export const TARGET_PAIR_OPTIONS: Array<{ key: TargetPair; title: string; subtitle: string }> = [
  { key: "depan", title: "2D DEPAN", subtitle: "AS - KOP" },
  { key: "tengah", title: "2D TENGAH", subtitle: "KOP - KEPALA" },
  { key: "belakang", title: "2D BELAKANG", subtitle: "KEPALA - EKOR" },
];

export const BBFS_SCOPE_OPTIONS: Array<{
  key: Exclude<AnalysisScope, "default">;
  title: string;
  subtitle: string;
}> = [
  { key: "2d_depan", title: "2D DEPAN", subtitle: "AS - KOP" },
  { key: "2d_tengah", title: "2D TENGAH", subtitle: "KOP - KEPALA" },
  { key: "2d_belakang", title: "2D BELAKANG", subtitle: "KEPALA - EKOR" },
  { key: "3d", title: "3D", subtitle: "KOP - KEPALA - EKOR" },
  { key: "4d", title: "4D", subtitle: "AS - KOP - KEPALA - EKOR" },
];

export const AI_SCOPE_OPTIONS: Array<{
  key: Exclude<AnalysisScope, "default">;
  title: string;
  subtitle: string;
}> = [
  { key: "2d_depan", title: "2D DEPAN", subtitle: "AS - KOP" },
  { key: "2d_tengah", title: "2D TENGAH", subtitle: "KOP - KEPALA" },
  { key: "2d_belakang", title: "2D BELAKANG", subtitle: "KEPALA - EKOR" },
  { key: "3d", title: "3D", subtitle: "KOP - KEPALA - EKOR" },
  { key: "4d", title: "4D", subtitle: "AS - KOP - KEPALA - EKOR" },
];

export const VALID_TARGET_PAIRS: TargetPair[] = ["depan", "tengah", "belakang"];

export function targetPairLabel(pair: TargetPair | null) {
  if (!pair) return "";
  const option = TARGET_PAIR_OPTIONS.find((item) => item.key === pair);
  return option ? `${option.title} · ${option.subtitle}` : "";
}

export function analysisScopeLabel(scope: AnalysisScope | null) {
  if (!scope || scope === "default") return "";
  const option = BBFS_SCOPE_OPTIONS.find((item) => item.key === scope);
  return option ? `${option.title} · ${option.subtitle}` : "";
}

type SelectOption = { key: string; title: string; subtitle: string };

function SelectorPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-soft-pop mt-4 space-y-4 rounded-3xl border border-border-soft bg-surface p-4">
      <div className="text-center">
        <div className="display accent-text text-sm">{title}</div>
        <p className="mt-1.5 text-xs font-medium text-text-muted">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 gap-3">{children}</div>
    </div>
  );
}

function SelectorButton({ option, onClick, index = 0 }: { option: SelectOption; onClick: () => void; index?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable animate-soft-pop accent-border accent-text min-h-16 w-full rounded-3xl border bg-white/[0.035] px-5 py-4 text-center hover:bg-white/[0.06]"
      style={{ animationDelay: `${Math.min(index, 8) * 26}ms` }}
    >
      <span className="display block text-[15px]">{option.title}</span>
      <span className="mt-2 block text-[11px] font-bold uppercase tracking-wide text-text-muted">
        {option.subtitle}
      </span>
    </button>
  );
}

export function TargetPairSelector({ onSelect }: { onSelect: (pair: TargetPair) => void }) {
  return (
    <SelectorPanel title="Pilih Fokus 2D" subtitle="Pilih posisi angka yang mau dianalisa.">
      {TARGET_PAIR_OPTIONS.map((o, index) => (
        <SelectorButton key={o.key} option={o} onClick={() => onSelect(o.key)} index={index} />
      ))}
    </SelectorPanel>
  );
}

export function BBFSScopeSelector({
  onSelect,
}: {
  onSelect: (scope: Exclude<AnalysisScope, "default">) => void;
}) {
  return (
    <SelectorPanel title="Pilih Jenis BBFS" subtitle="Pilih target backtest BBFS.">
      {BBFS_SCOPE_OPTIONS.map((o, index) => (
        <SelectorButton key={o.key} option={o} onClick={() => onSelect(o.key)} index={index} />
      ))}
    </SelectorPanel>
  );
}

export function AIScopeSelector({
  onSelect,
}: {
  onSelect: (scope: Exclude<AnalysisScope, "default">) => void;
}) {
  return (
    <SelectorPanel title="Pilih Jenis Angka Ikut" subtitle="Pilih target AI yang mau dianalisa.">
      {AI_SCOPE_OPTIONS.map((o, index) => (
        <SelectorButton key={o.key} option={o} onClick={() => onSelect(o.key)} index={index} />
      ))}
    </SelectorPanel>
  );
}

export function RekapFocusSelector({ onSelect }: { onSelect: (focus: CustomFocus) => void }) {
  return (
    <SelectorPanel title="Pilih Jenis Rekap" subtitle="Pilih dulu jenis line yang mau dibuat.">
      {CUSTOM_FOCUS_OPTIONS.map((item, index) => (
        <SelectorButton
          key={item.key}
          option={{ key: item.key, title: item.title, subtitle: customFocusSubtitle(item.key) }}
          onClick={() => onSelect(item.key)}
          index={index}
        />
      ))}
    </SelectorPanel>
  );
}
