import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type SkeletonProps = ComponentProps<"div">;

/** Placeholder loading. Pakai untuk mengganti layar kosong saat fetch data. */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-lg bg-[image:var(--skeleton-gradient)]",
        className,
      )}
      {...props}
    />
  );
}
