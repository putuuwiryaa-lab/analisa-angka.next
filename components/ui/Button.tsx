import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition select-none " +
  "active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:brightness-110",
  ghost: "border border-border-soft bg-white/[0.03] text-text-muted hover:bg-white/[0.06]",
  danger: "bg-danger text-white hover:brightness-110",
  accent: "accent-bg-soft accent-text border accent-border",
};

const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-13 px-6 text-base",
  icon: "h-11 w-11",
};

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
