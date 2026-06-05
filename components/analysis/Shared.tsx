import { BarChart3, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { SHIO_EMOJI, SHIO_NAMES } from "@/lib/analysis/constants";

export function MiniLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold uppercase tracking-wide text-text-soft">{children}</div>;
}

export function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <BarChart3 size={16} className="accent-text" />
      <span className="display text-xs text-text">{title}</span>
    </div>
  );
}

export function DetailToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable depth-3 accent-text inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide hover:border-border hover:bg-white/[0.06]"
      aria-label={open ? "Tutup" : "Buka"}
    >
      {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      {open ? "Tutup" : "Buka"}
    </button>
  );
}

export function ResultHeader({ label, value }: { label: string; value: string }) {
  return (
    <div className="animate-rise depth-1 flex items-center justify-between gap-3 rounded-2xl border p-4">
      <span className="text-xs font-bold uppercase tracking-wide text-text-soft">{label}</span>
      <span className="depth-3 accent-text rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide">
        {value}
      </span>
    </div>
  );
}

export function ShioChip({ value }: { value: string | number }) {
  const normalized = Number(String(value ?? "").match(/\d+/)?.[0] ?? value);
  const safe = Number.isFinite(normalized) && normalized >= 1 && normalized <= 12 ? normalized : 0;
  const label = safe ? `${safe < 10 ? "0" + safe : safe} ${SHIO_NAMES[safe]}` : String(value ?? "-");
  const emoji = safe ? SHIO_EMOJI[safe] : "-";
  return (
    <span className="depth-accent inline-flex items-center gap-1 rounded-2xl border px-3 py-2 text-[13px] font-black text-accent">
      {emoji} {label}
    </span>
  );
}

export function LineBox({ label, lines }: { label: string; lines: string[] }) {
  const display = lines.join(" * ");
  const copyPayload = lines.join("*");
  return (
    <div className="animate-rise depth-2 rounded-2xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="display text-xs text-text">{label}</span>
        <span className="depth-3 accent-text rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide">
          {lines.length} LINE
        </span>
      </div>
      <div className="num depth-3 accent-text max-h-[260px] overflow-y-auto rounded-2xl border p-4 text-sm font-bold leading-8">
        {display || "-"}
      </div>
      <button
        onClick={() => navigator.clipboard?.writeText(copyPayload)}
        className="pressable depth-accent accent-text mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border p-3.5 text-xs font-black uppercase tracking-wider"
      >
        <Copy size={16} /> Copy Semua
      </button>
    </div>
  );
}
