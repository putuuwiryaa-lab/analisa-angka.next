"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, ChevronRight, ClipboardCopy, ListOrdered, X } from "lucide-react";
import { numbersForJalur, type Jalur } from "@/lib/engine/jalur";

const JALURS = [1, 2, 3] as const;

function formattedNumbers(jalur: Jalur): string[] {
  return numbersForJalur(jalur).map((number) => String(number).padStart(2, "0"));
}

/** This is a fixed reference, intentionally separate from Scan predictions and frequency. */
export default function JalurReferencePanel() {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Jalur>(1);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const numbers = formattedNumbers(selected);

  function toggle() {
    if (!open) {
      setSelected(1);
      setCopied(false);
      setCopyError("");
    }
    setOpen((current) => !current);
  }

  function selectJalur(jalur: Jalur) {
    setSelected(jalur);
    setCopied(false);
    setCopyError("");
  }

  async function copyNumbers() {
    const text = numbers.join(" ");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyError("");
    } catch {
      // Match the Scan page's fallback for browsers without Clipboard API permission.
      let success = false;
      const textarea = document.createElement("textarea");
      try {
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        success = document.execCommand("copy");
      } catch {
        success = false;
      } finally {
        textarea.remove();
      }
      if (success) {
        setCopied(true);
        setCopyError("");
      } else {
        setCopyError("Tidak bisa menyalin otomatis. Silakan pilih angka secara manual.");
      }
    }
  }

  return (
    <section
      aria-label="Daftar angka jalur"
      className="mt-3 overflow-hidden rounded-xl border border-border-soft bg-surface/75"
    >
      <div className="flex items-center justify-between gap-2.5 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <ListOrdered size={18} className="shrink-0 text-text-soft" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="text-sm font-black text-text">Daftar Angka Jalur</h3>
            <p className="mt-0.5 text-[10px] font-semibold text-text-muted sm:text-xs">
              Referensi tetap 2D 00–99 · bukan hasil Scan
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={toggle}
          className="pressable flex min-h-10 shrink-0 items-center gap-1 rounded-lg border border-border-strong bg-primary/10 px-3 py-1.5 text-xs font-black text-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {open ? "Tutup" : "Lihat"}
          {open ? <ChevronDown size={15} className="rotate-180" aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
        </button>
      </div>

      {open ? (
        <div id={panelId} className="space-y-3 border-t border-border-soft bg-bg-deep/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-text">Angka 2D per Jalur</p>
              <p className="mt-0.5 text-[11px] text-text-soft">Pilih jalur untuk melihat seluruh angkanya.</p>
            </div>
            <button
              type="button"
              aria-label="Tutup daftar angka jalur"
              onClick={toggle}
              className="pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-soft text-text-soft focus-visible:outline-2 focus-visible:outline-primary"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div role="group" aria-label="Pilih jalur" className="grid grid-cols-3 gap-1.5">
            {JALURS.map((jalur) => (
              <button
                key={jalur}
                type="button"
                aria-pressed={selected === jalur}
                onClick={() => selectJalur(jalur)}
                className={`pressable min-h-11 rounded-lg border px-1 py-2 text-xs font-black transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-sm ${
                  selected === jalur
                    ? "border-primary/70 bg-primary/20 text-primary-soft"
                    : "border-border-soft bg-surface text-text-soft hover:border-border-strong"
                }`}
              >
                Jalur {jalur}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black text-text">Jalur {selected}</p>
            <span className="rounded-full border border-border-soft px-2.5 py-1 text-[11px] font-bold text-text-soft">
              {numbers.length} angka
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8" aria-label={`Angka pada Jalur ${selected}`}>
            {numbers.map((number) => (
              <span
                key={number}
                className="num flex min-h-9 items-center justify-center rounded-md border border-border-soft bg-surface px-1 text-sm font-black text-text"
              >
                {number}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={copyNumbers}
            className="pressable flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-black text-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {copied ? <Check size={16} aria-hidden="true" /> : <ClipboardCopy size={16} aria-hidden="true" />}
            {copied ? `Angka Jalur ${selected} tersalin` : `Salin angka Jalur ${selected}`}
          </button>
          {copyError ? <p role="alert" className="text-xs text-danger">{copyError}</p> : null}
          <p className="text-center text-[11px] font-semibold text-text-muted">
            Daftar ini hanya referensi kelompok angka, bukan hasil Scan atau prediksi.
          </p>
        </div>
      ) : null}
    </section>
  );
}
