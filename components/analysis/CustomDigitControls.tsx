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
        "relative rounded-2xl border p-4 text-center transition active:scale-[0.97]",
        active
          ? "accent-bg-soft accent-border accent-text"
          : recommended
            ? "accent-border bg-white/[0.04] text-text-muted"
            : "border-border-soft bg-white/[0.04] text-text-muted",
        extraClass,
      )}
    >
      {badge && (
        <span className="absolute right-3 top-2 text-[15px] leading-none">
          {badge === "fire" ? "🔥" : "👍"}
        </span>
      )}
      <span className="display block text-[13px]">{label}</span>
    </button>
  );
}

export function CustomDigitSection({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-2xl border border-border-soft bg-surface-2 p-3">
      <MiniLabel>{label}</MiniLabel>
      {children}
    </section>
  );
}

export function ThreeColumnOptions({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-2">{children}</div>;
}

export function SingleColumnOptions({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-2">{children}</div>;
}
