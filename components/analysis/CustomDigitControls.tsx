import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { MiniLabel } from "./Shared";
import type { RecommendationBadge } from "@/lib/analysis/recommendations";

export function CustomDigitOptionButton({
  active,
  label,
  onClick,
  extraClass = "",
  badge,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  extraClass?: string;
  badge?: RecommendationBadge;
}) {
  const recommended = Boolean(badge);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable relative min-h-14 rounded-2xl border p-4 text-center",
        active
          ? "accent-bg-soft accent-border accent-text shadow-[0_10px_28px_rgba(0,0,0,0.16)]"
          : recommended
            ? "accent-border bg-white/[0.045] text-text hover:bg-white/[0.065]"
            : "border-border-soft bg-white/[0.035] text-text-muted hover:border-border hover:bg-white/[0.055]",
        extraClass,
      )}
    >
      {badge && (
        <span className="absolute right-2.5 top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-white/10 bg-black/20 px-1 text-[13px] leading-none shadow-sm">
          {badge === "fire" ? "🔥" : "👍"}
        </span>
      )}
      <span className="display block text-[13px] leading-5">{label}</span>
    </button>
  );
}

export function CustomDigitSection({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <section className="animate-soft-pop space-y-2 rounded-3xl border border-border-soft bg-surface-2 p-3">
      <MiniLabel>{label}</MiniLabel>
      {children}
    </section>
  );
}

export function ThreeColumnOptions({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-2.5">{children}</div>;
}

export function SingleColumnOptions({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-2.5">{children}</div>;
}
