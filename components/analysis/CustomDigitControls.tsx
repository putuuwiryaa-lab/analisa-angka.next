import type { ReactNode } from "react";
import { Binary, Combine, Hash, Scale, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { MiniLabel } from "./Shared";
import type { RecommendationBadge } from "@/lib/analysis/recommendations";

function optionIcon(label: string): LucideIcon {
  const normalized = label.trim().toUpperCase();
  if (normalized.includes("GENAP GANJIL") || normalized.includes("GANJIL GENAP")) return Binary;
  if (normalized.includes("BESAR KECIL")) return Scale;
  if (normalized.includes("GGBK")) return Combine;
  return Hash;
}

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
  const Icon = optionIcon(label);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable group relative min-h-[72px] rounded-2xl border p-3 text-center",
        active
          ? "depth-accent accent-text"
          : recommended
            ? "depth-3 accent-text hover:border-border hover:bg-white/[0.065]"
            : "depth-3 text-text-muted hover:border-border hover:bg-white/[0.055]",
        extraClass,
      )}
    >
      {badge && (
        <span className="depth-2 absolute right-2.5 top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1 text-[13px] leading-none">
          {badge === "fire" ? "🔥" : "👍"}
        </span>
      )}
      <span className="depth-2 mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl border transition-transform duration-150 group-hover:scale-[1.05]">
        <Icon size={15} strokeWidth={1.9} />
      </span>
      <span className="display block text-[13px] leading-5">{label}</span>
    </button>
  );
}

export function CustomDigitSection({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <section className="animate-soft-pop depth-2 space-y-2 rounded-3xl border p-3">
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
