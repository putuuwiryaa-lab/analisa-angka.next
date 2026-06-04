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

  return (
    <div className="animate-rise space-y-3 rounded-2xl border border-border-soft bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle title="Angka Jadi" />
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
