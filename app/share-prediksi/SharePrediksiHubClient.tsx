"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { RekapAngkaJadiClient } from "./RekapAngkaJadiClient";
import { SharePrediksiClient } from "./SharePrediksiClient";

type ShareMode = "prediksi" | "angka-jadi";

export function SharePrediksiHubClient() {
  const [mode, setMode] = useState<ShareMode>("prediksi");

  if (mode === "angka-jadi") {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMode("prediksi")}
            className="pressable depth-3 inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 text-xs font-black uppercase tracking-wide text-text-muted hover:border-border"
          >
            <ArrowLeft size={15} /> Pilih Jenis
          </button>
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-text-soft">
            Share Prediksi
          </span>
        </div>

        <RekapAngkaJadiClient hideBackNavigation />
      </div>
    );
  }

  return <SharePrediksiClient onOpenAngkaJadi={() => setMode("angka-jadi")} />;
}
