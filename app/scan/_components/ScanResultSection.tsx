import type { AutoScanItem, AutoScanResult } from "@/lib/engine/types";
import { isShioMode } from "@/lib/shared/scan-mode";
import { analysisTitle, buildFrequencyRows, labelsFromValues } from "../_lib";

const ROLE = [
  { row: "border-accent/55 bg-accent/[0.09]", badge: "border-accent/55 bg-accent text-bg-deep" },
  { row: "border-primary/50 bg-primary/[0.10]", badge: "border-primary/55 bg-primary/25 text-primary-soft" },
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
  return [marketId, item.result.latestDraw, item.scanMode, item.targetPos, item.target2D, item.target3D, item.formula, item.code].join(":");
}

export default function ScanResultSection({ result, marketTitle, marketId, savedId, onSave, onView }: Props) {
  const frequencyRows = buildFrequencyRows(result);
  const unit = isShioMode(result.config.scanMode) ? "shio" : "digit";

  return (
    <section className="depth-1 rounded-2xl border p-3 sm:p-4">
      <div className="mb-3">
        <h2 className="truncate text-base font-black text-text">{marketTitle}</h2>
        <p className="mt-0.5 text-[11px] font-bold text-text-soft">
          {analysisTitle(result.config.scanMode, result.config.targetPos, result.config.target2D, result.config.target3D)} · {result.config.digitCount} {unit}
        </p>
        <p className="mt-0.5 text-[10px] font-bold text-text-muted">
          {result.config.L} data · patah {result.config.patah} · {result.totalMatched} hasil
        </p>
      </div>

      <div className="space-y-2">
        {result.items.length ? result.items.map((item, index) => {
          const style = ROLE[index] ?? ROLE[2];
          const id = trekId(marketId, item);
          const labels = labelsFromValues(item.angkaHidup, item.scanMode);

          return (
            <article key={`${item.code}-${index}`} className={`rounded-xl border p-2.5 ${style.row}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`max-w-[11rem] truncate rounded-lg border px-2.5 py-1.5 text-[11px] font-black ${style.badge}`}>{item.formula}</span>
                <span className="text-[10px] font-black uppercase tracking-wide text-text-muted">Hasil {index + 1}</span>
              </div>

              <div className="num mt-3 flex min-h-10 w-full flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xl font-black tracking-[0.05em] text-accent">
                {labels.map((digit, digitIndex) => <span key={`${digit}-${digitIndex}`}>{digit}</span>)}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onSave(item)} className="pressable h-10 rounded-lg border border-primary/40 bg-primary/10 px-3 text-[11px] font-black text-primary-soft">
                  {savedId === id ? "Tersimpan" : "Simpan"}
                </button>
                <button type="button" onClick={() => onView(item)} className="pressable h-10 rounded-lg border border-primary/40 bg-primary/10 px-3 text-[11px] font-black text-primary-soft">
                  Lihat
                </button>
              </div>
            </article>
          );
        }) : (
          <div className="rounded-xl border border-dashed border-border-soft p-5 text-center text-xs font-bold text-text-muted">Belum ada trek yang cocok.</div>
        )}
      </div>

      {result.items.length ? (
        <details className="mt-3 rounded-xl border border-border-soft bg-surface/75">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-black text-text [&::-webkit-details-marker]:hidden">
            <span>Frekuensi {isShioMode(result.config.scanMode) ? "Shio" : "Digit"}</span>
            <span className="rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary-soft">{result.items.length} hasil</span>
          </summary>
          <div className="grid grid-cols-2 gap-1.5 border-t border-border-soft p-2.5">
            {frequencyRows.map((row) => (
              <div key={row.value} className={`flex h-9 items-center rounded-lg border border-accent/20 bg-bg-deep/25 px-2.5 ${row.count === 0 ? "opacity-25" : ""}`}>
                <b className="num w-8 text-lg text-accent">{row.label}</b>
                <span className="mr-1.5 text-xs font-black text-text-soft">×</span>
                <span className="text-[11px] font-bold text-text">{row.count}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
