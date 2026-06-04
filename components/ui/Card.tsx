import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type CardProps = ComponentProps<"div"> & {
  pressable?: boolean;
};

export function Card({ className, pressable = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border-soft bg-surface p-5",
        pressable && "cursor-pointer transition active:scale-[0.985] hover:border-border",
        className,
      )}
      {...props}
    />
  );
}
