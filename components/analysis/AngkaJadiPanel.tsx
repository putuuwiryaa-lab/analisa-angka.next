import { DetailToggle, LineBox, SectionTitle } from "./Shared";
import { buildAngkaJadi } from "@/lib/analysis/utils";
import { angkaJadiModes } from "@/lib/analysis/constants";

export function AngkaJadiPanel({
  type,
  result,
  open,
  setOpen,
}: {
  type: string;
  result: Record<string, unknown>;
  open: boolean;
  setOpen: (fn: (value: boolean) => boolean) => void;
}) {
  if (!result || !angkaJadiModes.has(type)) return null;
  const data = buildAngkaJadi(type, result);
  const totalLines = data.sections.reduce((acc, section) => acc + section.lines.length, 0);

  return (
    <div className="animate-soft-pop space-y-3 rounded-3xl border border-border-soft bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <SectionTitle title="Angka Jadi" />
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-text-soft">
            {data.sections.length} bagian · {totalLines} line
          </p>
        </div>
        <DetailToggle open={open} onClick={() => setOpen((v) => !v)} />
      </div>
      {open && (
        <div className="animate-rise space-y-3 pt-1">
          {data.sections.map((section) => (
            <LineBox key={section.label} label={section.label} lines={section.lines} />
          ))}
        </div>
      )}
    </div>
  );
}
