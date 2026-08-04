"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Activity, Layers3, ScanSearch } from "lucide-react";

function navClass(active: boolean) {
  return [
    "pressable flex h-12 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black uppercase tracking-wide transition-colors",
    active
      ? "border-primary/45 bg-primary/20 text-primary-soft"
      : "border-border-soft bg-surface/85 text-text-muted hover:border-border hover:text-text",
  ].join(" ");
}

function NavigationLinks({
  scanActive,
  batchActive,
  adaptiveActive,
}: {
  scanActive: boolean;
  batchActive: boolean;
  adaptiveActive: boolean;
}) {
  return (
    <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2 px-3 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-2 sm:px-5">
      <Link href="/scan" prefetch={false} className={navClass(scanActive)} aria-current={scanActive ? "page" : undefined}>
        <ScanSearch size={17} />
        Scan
      </Link>
      <Link href="/scan/batch" prefetch={false} className={navClass(batchActive)} aria-current={batchActive ? "page" : undefined}>
        <Layers3 size={17} />
        Batch
      </Link>
      <Link href="/scan?view=adaptive" prefetch={false} className={navClass(adaptiveActive)} aria-current={adaptiveActive ? "page" : undefined}>
        <Activity size={17} />
        Adaptive
      </Link>
    </div>
  );
}

export function ScanNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const adaptiveView = searchParams.get("view") === "adaptive";

  return (
    <NavigationLinks
      scanActive={pathname === "/scan" && !adaptiveView}
      batchActive={pathname.startsWith("/scan/batch")}
      adaptiveActive={pathname === "/scan" && adaptiveView}
    />
  );
}

export function ScanNavigationFallback() {
  return <NavigationLinks scanActive={false} batchActive={false} adaptiveActive={false} />;
}
