"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { PinActivationPanel } from "@/components/auth/PinActivationPanel";
import { useAuth } from "@/components/auth/auth-context";
import { UpgradeLockPanel } from "@/components/upgrade/UpgradeLockPanel";
import {
  canUseAnalysisScope,
  canUseCustomFocus,
  canUseTargetPair,
} from "@/lib/access/freeAccess";
import {
  CUSTOM_FOCUS_OPTIONS,
  customFocusSubtitle,
  type BBFSAnalysisScope,
  type CustomFocus,
  type TargetPair,
} from "@/lib/analysis/customDigit";

export type AnalysisScope = "default" | BBFSAnalysisScope;

type ScopeOption = {
  key: Exclude<AnalysisScope, "default">;
  title: string;
  subtitle: string;
};

export const TARGET_PAIR_OPTIONS: Array<{ key: TargetPair; title: string; subtitle: string }> = [
  { key: "depan", title: "2D DEPAN", subtitle: "AS - KOP" },
  { key: "tengah", title: "2D TENGAH", subtitle: "KOP - KEPALA" },
  { key: "belakang", title: "2D BELAKANG", subtitle: "KEPALA - EKOR" },
];

export const BBFS_SCOPE_OPTIONS: ScopeOption[] = [
  { key: "2d_depan", title: "2D DEPAN", subtitle: "AS - KOP" },
  { key: "2d_tengah", title: "2D TENGAH", subtitle: "KOP - KEPALA" },
  { key: "2d_belakang", title: "2D BELAKANG", subtitle: "KEPALA - EKOR" },
  { key: "3d", title: "3D", subtitle: "KOP - KEPALA - EKOR" },
  { key: "4d", title: "4D", subtitle: "AS - KOP - KEPALA - EKOR" },
];

export const AI_SCOPE_OPTIONS: ScopeOption[] = [
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

function VipBadge() {
  return (
    <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/12 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-primary-soft">
      <Lock size={10} /> VIP
    </span>
  );
}

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
    <div className="animate-soft-pop depth-1 mt-4 space-y-4 rounded-3xl border p-4">
      <div className="text-center">
        <div className="display accent-text text-sm">{title}</div>
        <p className="mt-1.5 text-xs font-medium text-text-muted">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 gap-3">{children}</div>
    </div>
  );
}

function SelectorButton({
  option,
  onClick,
  locked = false,
  index = 0,
}: {
  option: SelectOption;
  onClick: () => void;
  locked?: boolean;
  index?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pressable animate-soft-pop depth-3 accent-text min-h-16 w-full rounded-3xl border px-5 py-4 text-center hover:border-border hover:bg-white/[0.06] ${
        locked ? "opacity-80" : ""
      }`}
      style={{ animationDelay: `${Math.min(index, 8) * 26}ms` }}
    >
      <span className="display block text-[15px]">{option.title}</span>
      <span className="mt-2 block text-[11px] font-bold uppercase tracking-wide text-text-muted">
        {option.subtitle}
      </span>
      {locked && <VipBadge />}
    </button>
  );
}

function useUpgradePanels() {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  function openUpgrade() {
    setUpgradeOpen(true);
  }

  function openPin() {
    setUpgradeOpen(false);
    setPinOpen(true);
  }

  return {
    openUpgrade,
    panels: (
      <>
        <UpgradeLockPanel open={upgradeOpen} onClose={() => setUpgradeOpen(false)} onOpenPin={openPin} />
        <PinActivationPanel open={pinOpen} onClose={() => setPinOpen(false)} />
      </>
    ),
  };
}

export function TargetPairSelector({ onSelect }: { onSelect: (pair: TargetPair) => void }) {
  const { role } = useAuth();
  const { openUpgrade, panels } = useUpgradePanels();

  return (
    <>
      <SelectorPanel title="Pilih Fokus 2D" subtitle="Pilih posisi angka yang mau dianalisa.">
        {TARGET_PAIR_OPTIONS.map((o, index) => {
          const locked = !canUseTargetPair(role, "jumlah", o.key);
          return (
            <SelectorButton
              key={o.key}
              option={o}
              onClick={() => (locked ? openUpgrade() : onSelect(o.key))}
              locked={locked}
              index={index}
            />
          );
        })}
      </SelectorPanel>
      {panels}
    </>
  );
}

export function BBFSScopeSelector({
  onSelect,
}: {
  onSelect: (scope: Exclude<AnalysisScope, "default">) => void;
}) {
  const { role } = useAuth();
  const { openUpgrade, panels } = useUpgradePanels();

  return (
    <>
      <SelectorPanel title="Pilih Jenis BBFS" subtitle="Pilih target backtest BBFS.">
        {BBFS_SCOPE_OPTIONS.map((o, index) => {
          const locked = !canUseAnalysisScope(role, "bbfs", o.key);
          return (
            <SelectorButton
              key={o.key}
              option={o}
              onClick={() => (locked ? openUpgrade() : onSelect(o.key))}
              locked={locked}
              index={index}
            />
          );
        })}
      </SelectorPanel>
      {panels}
    </>
  );
}

export function AIScopeSelector({
  onSelect,
}: {
  onSelect: (scope: Exclude<AnalysisScope, "default">) => void;
}) {
  const { role } = useAuth();
  const { openUpgrade, panels } = useUpgradePanels();

  return (
    <>
      <SelectorPanel title="Pilih Jenis Angka Ikut" subtitle="Pilih target AI yang mau dianalisa.">
        {AI_SCOPE_OPTIONS.map((o, index) => {
          const locked = !canUseAnalysisScope(role, "ai", o.key);
          return (
            <SelectorButton
              key={o.key}
              option={o}
              onClick={() => (locked ? openUpgrade() : onSelect(o.key))}
              locked={locked}
              index={index}
            />
          );
        })}
      </SelectorPanel>
      {panels}
    </>
  );
}

export function RekapFocusSelector({ onSelect }: { onSelect: (focus: CustomFocus) => void }) {
  const { role } = useAuth();
  const { openUpgrade, panels } = useUpgradePanels();

  return (
    <>
      <SelectorPanel title="Pilih Jenis Rekap" subtitle="Pilih dulu jenis line yang mau dibuat.">
        {CUSTOM_FOCUS_OPTIONS.map((item, index) => {
          const locked = !canUseCustomFocus(role, item.key);
          return (
            <SelectorButton
              key={item.key}
              option={{ key: item.key, title: item.title, subtitle: customFocusSubtitle(item.key) }}
              onClick={() => (locked ? openUpgrade() : onSelect(item.key))}
              locked={locked}
              index={index}
            />
          );
        })}
      </SelectorPanel>
      {panels}
    </>
  );
}
