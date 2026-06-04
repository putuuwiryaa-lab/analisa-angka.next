import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "default" | "accent" | "success" | "danger";

const variants: Record<Variant, string> = {
  default: "bg-white/[0.06] text-text-muted",
  accent: "accent-bg-soft accent-text",
  success: "bg-success/15 text-success",
  danger: "bg-danger/15 text-danger",
};

type BadgeProps = ComponentProps<"span"> & {
  variant?: Variant;
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
