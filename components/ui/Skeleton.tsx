import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type SkeletonProps = ComponentProps<"div">;

/** Placeholder loading. Pakai untuk mengganti layar kosong saat fetch data. */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-white/[0.06]", className)}
      {...props}
    />
  );
}
