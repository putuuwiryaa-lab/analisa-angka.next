import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type InputProps = ComponentProps<"input">;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-xl border border-border-soft bg-surface-2 px-4 text-[15px] text-text",
        "placeholder:text-text-soft transition",
        "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30",
        className,
      )}
      {...props}
    />
  );
}
