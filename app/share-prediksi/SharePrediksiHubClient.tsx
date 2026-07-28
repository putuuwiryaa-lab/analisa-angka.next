"use client";

import { useState } from "react";
import { Layers2, Share2 } from "lucide-react";
import { RekapAngkaJadiClient } from "./RekapAngkaJadiClient";
import { SharePrediksiClient } from "./SharePrediksiClient";

type ShareMode = "prediksi" | "angka-jadi";

export function SharePrediksiHubClient() {
  const [mode, setMode] = useState<ShareMode>("prediksi");

  return (
    <div>
      <div className="depth-1 mb-4 grid grid-cols-2 gap-2 rounded-3xl border p-2">
        <button
          type="button"
          onClick={() => setMode("prediksi")}
          className={`pressable flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-[10px] font-black uppercase tracking-wide ${
            mode === "prediksi"
              ? "depth-accent accent-border accent-text"
              : "depth-3 border-border-soft text-text-muted hover:border-border"
          }`}
        >
          <Share2 size={15} /> Share Prediksi
        </button>
        <button
          type="button"
          onClick={() => setMode("angka-jadi")}
          className={`pressable flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-[10px] font-black uppercase tracking-wide ${
            mode === "angka-jadi"
              ? "depth-accent accent-border accent-text"
              : "depth-3 border-border-soft text-text-muted hover:border-border"
          }`}
        >
          <Layers2 size={15} /> Rekap Angka Jadi
        </button>
      </div>

      {mode === "prediksi" ? <SharePrediksiClient /> : <RekapAngkaJadiClient />}
    </div>
  );
}
