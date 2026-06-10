import { Lock } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type VipBadgeProps = ComponentProps<"span"> & {
  label?: string;
  iconSize?: number;
};

export function VipBadge({ className, label = "VIP", iconSize = 9, ...props }: VipBadgeProps) {
  return (
    <span
      {...props}
      data-mode="vip"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border accent-border accent-bg-soft px-2 py-0.5 text-[9px] font-black uppercase tracking-wide accent-text",
        className,
      )}
    >
      <Lock size={iconSize} /> {label}
    </span>
  );
}
