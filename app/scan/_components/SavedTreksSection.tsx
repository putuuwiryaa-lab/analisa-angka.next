import { Trash2 } from "lucide-react";
import { isShioMode } from "@/lib/shared/scan-mode";
import { analysisTitle, displayDigits } from "../_lib";
import type { SavedGroup, SavedTrek } from "../_lib";

type Props = {
  total: number;
  groups: SavedGroup[];
  onView: (saved: SavedTrek) => void;
  onDelete: (id: string) => void;
};

export default function SavedTreksSection({ total, groups, onView, onDelete }: Props) {
  if (!total) return null;
  return (
    <section className="space-y-3" aria-label="Trek tersimpan">
      <div className="flex items-center gap-3 px-1">
        <span className="h-px flex-1 bg-border-soft" />
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-text">Trek Tersimpan</h2>
        <span className="rounded-full border border-border-soft px-3 py-1 text-xs font-black text-text-muted">
          {total} trek
        </span>
        <span className="h-px flex-1 bg-border-soft" />
      </div>
      {groups.map((group) => (
        <div key={group.key} className="depth-1 rounded-3xl border p-4">
          <p className="mb-3 text-xs font-bold leading-relaxed text-text-soft">
            <strong className="text-text">{group.marketName}</strong>
            {" · "}
            <strong className="text-text">
              {analysisTitle(group.scanMode, group.targetPos, group.target2D, group.target3D)}
            </strong>
            {` · ${group.digitCount} ${isShioMode(group.scanMode) ? "shio" : "digit"} · ${group.L || "-"} data · patah ${group.patah} · ${group.items.length} hasil`}
          </p>
          <div className="space-y-2">
            {group.items.map((saved) => (
              <article
                key={saved.id}
                className="render-lazy-card rounded-2xl border border-border-soft bg-white/[0.025] p-3"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="max-w-[7.5rem] shrink-0 truncate rounded-xl border border-border bg-white/[0.08] px-3 py-2 text-sm font-black text-text-muted">
                      {saved.formula}
                    </span>
                    <p className="num min-w-0 flex-1 truncate text-xl font-black tracking-[0.08em] text-accent">
                      {displayDigits(saved.predictionValues, saved.scanMode) || "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => onView(saved)}
                      className="pressable h-11 rounded-xl border border-primary/40 bg-primary/10 px-3 text-xs font-black text-primary-soft"
                    >
                      Lihat
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(saved.id)}
                      className="pressable flex h-11 w-11 items-center justify-center rounded-xl border border-danger/25 bg-danger/10 text-danger"
                      aria-label="Hapus trek"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {saved.legacy ? (
                  <p className="mt-2 text-[10px] lg:text-xs font-bold text-text-soft">
                    Trek lama: detail histori belum tersedia. Simpan ulang hasil scan untuk snapshot
                    lengkap.
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
