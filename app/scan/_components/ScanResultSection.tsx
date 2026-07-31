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
  return (
    <section className="depth-1 rounded-3xl border p-4 sm:p-5">
      <p className="mb-4 text-sm font-bold leading-relaxed text-text-soft">
        <strong className="text-text">{marketTitle}</strong>{" · "}
        <strong className="text-text">{analysisTitle(result.config.scanMode, result.config.targetPos, result.config.target2D, result.config.target3D)}</strong>
        {` · ${result.config.digitCount} ${isShioMode(result.config.scanMode) ? "shio" : "digit"} · ${result.config.L} data · patah ${result.config.patah} · ${result.totalMatched} hasil`}
      </p>
      <div className="space-y-2.5">
        {result.items.length ? result.items.map((item, index) => {
          const style = ROLE[index] ?? ROLE[2];
          const id = trekId(marketId, item);
          return (
            <article key={`${item.code}-${index}`} className={`rounded-2xl border p-3 ${style.row}`}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`max-w-[7.5rem] shrink-0 truncate rounded-xl border px-3 py-2 text-sm font-black ${style.badge}`}>{item.formula}</span>
                  <div className="num flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-black tracking-[0.06em] text-accent">{labelsFromValues(item.angkaHidup, item.scanMode).map((digit, digitIndex) => <span key={`${digit}-${digitIndex}`}>{digit}</span>)}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => onSave(item)} className="pressable h-11 rounded-xl border border-primary/40 bg-primary/10 px-3 text-xs font-black text-primary-soft">{savedId === id ? "Tersimpan" : "Simpan"}</button>
                  <button type="button" onClick={() => onView(item)} className="pressable h-11 rounded-xl border border-primary/40 bg-primary/10 px-3 text-xs font-black text-primary-soft">Lihat</button>
                </div>
              </div>
            </article>
          );
        }) : <div className="rounded-2xl border border-dashed border-border-soft p-7 text-center text-sm font-bold text-text-muted">Belum ada trek yang cocok.</div>}
      </div>
      {result.items.length ? (
        <div className="mt-4 rounded-3xl border border-border-soft bg-surface/75 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="display text-xl text-text">Frekuensi {isShioMode(result.config.scanMode) ? "Shio" : "Digit"}</h2>
            <span className="rounded-full border border-primary/35 bg-primary/10 px-3 py-1.5 text-xs font-black text-primary-soft">{result.items.length} hasil scan</span>
          </div>
          <p className="mt-2 text-xs font-bold leading-relaxed text-text-soft">Dihitung dari semua angka hidup yang tampil pada hasil scan.</p>
          <div className="mt-4 space-y-2">{frequencyRows.map((row) => (
            <div key={row.value} className={`flex h-12 items-center rounded-xl border border-accent/20 bg-bg-deep/25 px-4 ${row.count === 0 ? "opacity-25" : ""}`}>
              <b className="num w-12 text-2xl text-accent">{row.label}</b><span className="mr-3 font-black text-text-soft">×</span><span className="font-mono text-base font-bold text-text">{row.count} kali muncul</span>
            </div>
          ))}</div>
        </div>
      ) : null}
    </section>
  );
}
