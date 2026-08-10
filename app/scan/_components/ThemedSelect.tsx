"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type ThemedSelectOption = {
  value: string;
  label: string;
};

export default function ThemedSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  align = "start",
  wide = false,
}: {
  label: string;
  value: string;
  options: readonly ThemedSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  align?: "start" | "end";
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const listboxId = `${id}-listbox`;
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative min-w-0 ${open ? "z-40" : "z-0"}`}>
      <span
        id={labelId}
        className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.11em] text-text-muted"
      >
        {label}
      </span>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-labelledby={`${labelId} ${valueId}`}
        onClick={() => setOpen((current) => !current)}
        className="flex h-12 w-full items-center rounded-xl border border-border-soft bg-surface px-3 text-left text-sm font-black text-text shadow-inner shadow-black/10 outline-none transition-colors hover:border-border-strong focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-55"
      >
        <span id={valueId} className="min-w-0 flex-1 truncate">
          {selectedOption?.label || "Pilih"}
        </span>
        <ChevronDown
          size={16}
          className={`ml-2 shrink-0 text-text-soft transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={labelId}
          className={`absolute top-full mt-2 max-h-56 overflow-y-auto rounded-xl border border-border-strong bg-surface-2 p-1.5 shadow-[0_20px_55px_rgba(0,0,0,0.5)] ring-1 ring-white/5 ${
            align === "end" ? "left-auto right-0" : "left-0 right-auto"
          } ${wide ? "w-[min(20rem,calc(100vw-2rem))]" : "w-full"}`}
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-black transition-colors ${
                  selected
                    ? "bg-primary/16 text-text"
                    : "text-text-muted hover:bg-white/[0.06] hover:text-text"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <Check
                  size={14}
                  className={selected ? "text-primary-soft" : "invisible"}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
