import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type InputProps = ComponentProps<"input">;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-2xl border border-border-soft bg-surface-2 px-4 text-[15px] text-text shadow-sm shadow-black/10",
        "placeholder:text-text-soft/80 transition-[border-color,background-color,box-shadow] duration-150",
        "focus:border-primary/70 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/25",
        "disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
      {...props}
    />
  );
}
