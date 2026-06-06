"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { PinActivationPanel } from "@/components/auth/PinActivationPanel";
import { useAuth } from "@/components/auth/auth-context";
import { UpgradeLockPanel } from "@/components/upgrade/UpgradeLockPanel";
import { canUseParam, type LockableMode, type LockableScope } from "@/lib/access/freeAccess";
import { cn } from "@/lib/cn";

type ParamConfig = {
  title: string;
  values: number[];
  labels?: Record<number, string>;
  hints?: Record<number, string>;
};

function VipBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={cn(
        "absolute inline-flex items-center gap-0.5 rounded-full border border-primary/25 bg-primary/10 font-black uppercase tracking-wide text-primary-soft/80",
        compact ? "right-1.5 top-1.5 px-1.5 py-0.5 text-[7px]" : "right-3 top-3 px-2 py-1 text-[9px]",
      )}
    >
      <Lock size={compact ? 7 : 9} /> VIP
    </span>
  );
}

export function ParamSelector({
  type,
  param,
  analysisScope = "default",
  onAnalyze,
}: {
  type: string;
  param: number | null;
  analysisScope?: string;
  onAnalyze: (param: number) => void;
}) {
  const { role } = useAuth();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  if (type === "rekap" || param !== 0) return null;

  const aiValues =
    analysisScope === "3d" ? [1, 3, 5, 7, 8] : analysisScope === "4d" ? [1, 2, 4] : [2, 4, 6, 7, 8];
  const aiTitle =
    analysisScope === "3d"
      ? "Pilih Jenis Angka Ikut 3D"
      : analysisScope === "4d"
        ? "Pilih Jenis Angka Ikut 4D"
        : "Pilih Jenis Angka Ikut 2D";

  const options: Record<string, ParamConfig> = {
    ai: { title: aiTitle, values: aiValues, labels: { 7: "GENAP GANJIL", 8: "BESAR KECIL" } },
    bbfs: { title: "Pilih Jumlah Digit BBFS", values: [7, 8, 9] },
    mati: { title: "Pilih Jumlah Digit OFF", values: [1, 2, 3], hints: { 1: "RINGAN", 2: "SEIMBANG", 3: "KETAT" } },
    jumlah: { title: "Pilih Jumlah OFF", values: [1, 2, 3], hints: { 1: "RINGAN", 2: "SEIMBANG", 3: "KETAT" } },
    shio: { title: "Pilih Jumlah Shio Mati", values: [1, 2, 3], hints: { 1: "RINGAN", 2: "SEIMBANG", 3: "KETAT" } },
  };

  const cfg = options[type] || options.ai;
  const isAiMode = type === "ai";
  const isGridThree = isAiMode || type === "bbfs" || type === "mati" || type === "jumlah" || type === "shio";

  function openPinPanel() {
    setUpgradeOpen(false);
    setPinOpen(true);
  }

  return (
    <>
      <div className="animate-soft-pop depth-1 mt-4 rounded-3xl border p-4">
        <div className="mb-4 text-center">
          <div className="display accent-text text-sm">{cfg.title}</div>
          <p className="mt-1.5 text-xs font-medium text-text-muted">Pilih parameter untuk memulai analisa.</p>
        </div>

        <div className={cn("grid gap-2.5", isGridThree ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
          {cfg.values.map((value, index) => {
            const isSpecial = isAiMode && (value === 7 || value === 8);
            const hint = cfg.hints?.[value];
            const label = isSpecial ? cfg.labels![value] : String(value);
            const locked = !canUseParam(
              role,
              type as LockableMode,
              value,
              analysisScope as LockableScope,
            );
            const compactBadge = locked && !isSpecial && isGridThree;

            return (
              <button
                key={value}
                onClick={() => (locked ? setUpgradeOpen(true) : onAnalyze(value))}
                className={cn(
                  "pressable animate-soft-pop depth-3 accent-text relative rounded-3xl border text-center hover:border-border hover:bg-white/[0.06]",
                  isSpecial ? "col-span-3 min-h-[88px] p-4" : isGridThree ? "min-h-[88px] p-3" : "p-5",
                  compactBadge ? "pt-7" : "",
                  locked ? "border-border-soft/70 bg-white/[0.015] opacity-55 hover:bg-white/[0.025]" : "",
                )}
                style={{ animationDelay: `${Math.min(index, 6) * 28}ms` }}
              >
                {locked && <VipBadge compact={compactBadge} />}
                <span className={cn("display block", isSpecial ? "text-[15px] leading-5" : "text-2xl", locked ? "text-text-muted/80" : "")}>{label}</span>
                {((isAiMode && !isSpecial) || type === "bbfs") && (
                  <span className={cn("mt-2 block text-[10px] font-bold uppercase tracking-wide", locked ? "text-text-soft/70" : "text-text-muted")}>
                    DIGIT
                  </span>
                )}
                {hint && (
                  <span className={cn("mt-2 block text-[10px] font-bold uppercase tracking-wide", locked ? "text-text-soft/70" : "text-text-muted")}>
                    {hint}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <UpgradeLockPanel open={upgradeOpen} onClose={() => setUpgradeOpen(false)} onOpenPin={openPinPanel} />
      <PinActivationPanel open={pinOpen} onClose={() => setPinOpen(false)} />
    </>
  );
}
