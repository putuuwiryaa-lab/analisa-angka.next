"use client";

import dynamic from "next/dynamic";

const AnalyzeModeClient = dynamic(() => import("./AnalyzeModeClient"), {
  ssr: false,
  loading: () => (
    <div className="animate-rise py-10 text-center text-sm text-muted-foreground">
      Memuat analisis...
    </div>
  ),
});

export default function AnalyzeModeClientLoader({
  marketId,
  mode,
}: {
  marketId: string;
  mode: string;
}) {
  return <AnalyzeModeClient marketId={marketId} mode={mode} />;
}
