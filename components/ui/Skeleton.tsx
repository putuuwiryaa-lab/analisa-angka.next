import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type SkeletonProps = ComponentProps<"div">;

/** Placeholder loading. Pakai untuk mengganti layar kosong saat fetch data. */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-lg bg-[linear-gradient(90deg,rgba(255,255,255,0.045),rgba(255,255,255,0.085),rgba(255,255,255,0.045))]",
        className,
      )}
      {...props}
    />
  );
}
