import { useEffect, useMemo, useState } from "react";
import { Bookmark, Check, Copy, Eye } from "lucide-react";
import type { AutoScanItem, AutoScanResult } from "@/lib/engine/types";
import { isJalurMode, isShioMode } from "@/lib/shared/scan-mode";
import { formatScanCopyAll, formatScanCopyValues } from "@/lib/shared/scan-copy";
import { analysisTitle, buildFrequencyRows, labelsFromValues } from "../_lib";
import JalurReferencePanel from "./JalurReferencePanel";

async function copyPlainText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back for browsers that deny clipboard access.
    }
  }

  const textarea = document.createElement("textarea");
  try {
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    if (!document.execCommand("copy")) throw new Error("Clipboard tidak tersedia.");
  } finally {
    textarea.remove();
  }
}

const ROLE = [
  { row: "border-accent/55 bg-accent/[0.09]", badge: "border-accent/55 bg-accent text-bg-deep" },
  {
    row: "border-primary/50 bg-primary/[0.10]",
    badge: "border-primary/55 bg-primary/25 text-primary-soft",
  },
  { row: "border-border bg-white/[0.055]", badge: "border-border bg-white/[0.10] text-text-muted" },
] as const;

type Props = {
  result: AutoScanResult;
  marketTitle: string;
  marketId: string;
  savedId: string;
  onSave: (item: AutoScanItem) => void;
  onView: (item: AutoScanItem) => void;
};

export function trekId(marketId: string, item: AutoScanItem) {
  return [
    marketId,
    item.result.latestDraw,
    item.scanMode,
    item.targetPos,
    item.target2D,
    item.target3D,
    item.formula,
    item.code,
  ].join(":");
}

export default function ScanResultSection({
  result,
  marketTitle,
  marketId,
  savedId,
  onSave,
  onView,
}: Props) {
  const frequencyRows = useMemo(() => buildFrequencyRows(result), [result]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyError, setCopyError] = useState("");

  useEffect(() => {
    if (!copiedKey) return;
    const timer = window.setTimeout(() => setCopiedKey(null), 1600);
    return () => window.clearTimeout(timer);
  }, [copiedKey]);

  async function copyResult(text: string, key: string) {
    try {
      await copyPlainText(text);
      setCopiedKey(key);
      setCopyError("");
    } catch {
      setCopiedKey(null);
      setCopyError("Gagal menyalin hasil. Periksa izin clipboard browser.");
    }
  }
  const unit = isJalurMode(result.config.scanMode) ? "jalur" : isShioMode(result.config.scanMode) ? "shio" : "digit";

  return (
    <section className="desktop-result-enter depth-1 rounded-2xl border p-3 sm:p-4">
      <div className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-base font-black text-text">{marketTitle}</h2>
          {result.items.length > 0 ? (
            <button
              type="button"
              onClick={() => void copyResult(formatScanCopyAll(result.items), "all")}
              className="pressable flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-primary/35 bg-primary/10 px-2.5 text-[11px] font-black text-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label="Salin semua hasil Scan"
              title="Salin semua hasil Scan"
            >
              {copiedKey === "all" ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
              {copiedKey === "all" ? "Tersalin" : "Salin Semua"}
            </button>
          ) : null}
        </div>
        <p className="mt-0.5 text-[11px] lg:text-[13px] font-bold text-text-soft">
          {analysisTitle(
            result.config.scanMode,
            result.config.targetPos,
            result.config.target2D,
            result.config.target3D,
          )}{" "}
          · {result.config.digitCount} {unit}
        </p>
        <p className="mt-0.5 text-[10px] lg:text-xs font-bold text-text-muted">
          {result.config.L} data · patah {result.config.patah} · {result.totalMatched} hasil
        </p>
      </div>

      {copyError ? <p role="alert" className="mb-3 text-xs font-bold text-danger">{copyError}</p> : null}
      <span role="status" className="sr-only">{copiedKey ? "Hasil berhasil disalin." : ""}</span>

      <div className="space-y-2">
        {result.items.length ? (
          result.items.map((item, index) => {
            const style = ROLE[index] ?? ROLE[2];
            const id = trekId(marketId, item);
            const labels = labelsFromValues(item.angkaHidup, item.scanMode);

            return (
              <article
                key={`${item.code}-${index}`}
                className={`render-lazy-row rounded-xl border px-2.5 py-2 ${style.row}`}
              >
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-1 sm:gap-1.5">
                  <span
                    className={`max-w-[5.2rem] truncate rounded-md border px-1.5 py-1 text-[9px] lg:text-xs font-black ${style.badge}`}
                    title={item.formula}
                  >
                    {item.formula}
                  </span>

                  <div className="num min-w-0 truncate text-center text-[0.9rem] font-black tracking-[0.08em] text-accent sm:text-lg sm:tracking-[0.16em]">
                    {labels.join(" ")}
                  </div>

                  <button
                    type="button"
                    onClick={() => onView(item)}
                    className="pressable flex h-7 w-7 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-primary-soft"
                    aria-label={`Lihat detail hasil ${index + 1}`}
                    title="Lihat"
                  >
                    <Eye size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => void copyResult(formatScanCopyValues(item.angkaHidup, item.scanMode), `row:${index}`)}
                    className="pressable flex h-7 w-7 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    aria-label={`Salin hasil ${index + 1}`}
                    title={copiedKey === `row:${index}` ? "Tersalin" : "Salin hasil"}
                  >
                    {copiedKey === `row:${index}` ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => onSave(item)}
                    className="pressable flex h-7 w-7 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-primary-soft"
                    aria-label={
                      savedId === id
                        ? `Hasil ${index + 1} sudah tersimpan`
                        : `Simpan hasil ${index + 1}`
                    }
                    title={savedId === id ? "Tersimpan" : "Simpan"}
                  >
                    <Bookmark size={14} className={savedId === id ? "fill-current" : ""} />
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-border-soft p-5 text-center text-xs font-bold text-text-muted">
            Belum ada trek yang cocok.
          </div>
        )}
      </div>

      {result.items.length ? (
        <details className="mt-3 rounded-xl border border-border-soft bg-surface/75">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-black text-text [&::-webkit-details-marker]:hidden">
            <span>Frekuensi {isJalurMode(result.config.scanMode) ? "Jalur" : isShioMode(result.config.scanMode) ? "Shio" : "Digit"}</span>
            <span className="rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-[10px] lg:text-xs font-black text-primary-soft">
              {result.items.length} hasil
            </span>
          </summary>
          <div className="grid grid-cols-2 gap-1.5 border-t border-border-soft p-2.5">
            {frequencyRows.map((row) => (
              <div
                key={row.value}
                className={`flex h-9 items-center rounded-lg border border-accent/20 bg-bg-deep/25 px-2.5 ${row.count === 0 ? "opacity-25" : ""}`}
              >
                <b className="num w-8 text-lg text-accent">{row.label}</b>
                <span className="mr-1.5 text-xs font-black text-text-soft">×</span>
                <span className="text-[11px] lg:text-[13px] font-bold text-text">{row.count}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {isJalurMode(result.config.scanMode) ? <JalurReferencePanel /> : null}
    </section>
  );
}
