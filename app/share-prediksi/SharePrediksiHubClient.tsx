"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Layers2 } from "lucide-react";
import { RekapAngkaJadiClient } from "./RekapAngkaJadiClient";
import { SharePrediksiClient } from "./SharePrediksiClient";

type ShareMode = "prediksi" | "angka-jadi";

function findJenisGrid(root: HTMLElement) {
  const heading = Array.from(root.querySelectorAll("div")).find(
    (element) =>
      element.childElementCount === 0 &&
      element.textContent?.trim().toLowerCase() === "jenis",
  );
  const grid = heading?.nextElementSibling;
  return grid instanceof HTMLElement ? grid : null;
}

export function SharePrediksiHubClient() {
  const [mode, setMode] = useState<ShareMode>("prediksi");
  const rootRef = useRef<HTMLDivElement>(null);
  const [jenisGrid, setJenisGrid] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (mode !== "prediksi") {
      setJenisGrid(null);
      return;
    }

    const root = rootRef.current;
    if (!root) return;

    const syncJenisGrid = () => {
      const next = findJenisGrid(root);
      setJenisGrid((current) => (current === next ? current : next));
    };

    syncJenisGrid();
    const observer = new MutationObserver(syncJenisGrid);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [mode]);

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

        <div className="[&>div>div:first-child]:hidden">
          <RekapAngkaJadiClient />
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <SharePrediksiClient />
      {jenisGrid
        ? createPortal(
            <button
              type="button"
              onClick={() => setMode("angka-jadi")}
              className="pressable flex min-h-[58px] items-center justify-center gap-2 rounded-2xl border border-border-soft px-3 py-2 text-center text-[11px] font-black uppercase tracking-wide text-text-muted depth-3 hover:border-border"
            >
              <Layers2 size={15} strokeWidth={1.9} className="text-text-soft" />
              <span>Rekap Angka Jadi</span>
            </button>,
            jenisGrid,
          )
        : null}
    </div>
  );
}
