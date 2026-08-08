"use client";

import dynamic from "next/dynamic";

function ScanViewFallback() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Memuat halaman Scan">
      <div className="depth-1 h-44 animate-pulse rounded-2xl border" />
      <div className="depth-1 h-32 animate-pulse rounded-2xl border" />
    </div>
  );
}

const ScanPageClient = dynamic(() => import("./ScanPageClient"), {
  loading: ScanViewFallback,
});

const AdaptivePageClient = dynamic(() => import("./AdaptivePageClient"), {
  loading: ScanViewFallback,
});

export default function ScanViewClient({ view }: { view?: string }) {
  return view === "adaptive" ? <AdaptivePageClient /> : <ScanPageClient />;
}
