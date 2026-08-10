"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { Posisi, ScanMode, Target2D, Target3D } from "@/lib/engine/types";
import { is3DMode, isPositionMode } from "@/lib/shared/scan-mode";
import { marketLabel, MODE_OPTIONS } from "../_lib";
import type { Market } from "../_lib";
import ThemedSelect, { type ThemedSelectOption } from "./ThemedSelect";

type Props = {
  markets: Market[];
  marketId: string;
  selectedMarket: Market | null;
  marketsLoading: boolean;
  rounds: number;
  patah: number;
  scanMode: ScanMode;
  targetPos: Posisi;
  target2D: Target2D;
  target3D: Target3D;
  digitCount: number;
  stopScan: number;
  loading: boolean;
  onMarketChange: (value: string) => void;
  onRoundsChange: (value: number) => void;
  onPatahChange: (value: number) => void;
  onModeChange: (value: ScanMode) => void;
  onTargetPosChange: (value: Posisi) => void;
  onTarget2DChange: (value: Target2D) => void;
  onTarget3DChange: (value: Target3D) => void;
  onDigitCountChange: (value: number) => void;
  onStopScanChange: (value: number) => void;
  onScan: () => void;
};

const POSITION_OPTIONS: ThemedSelectOption[] = [
  { value: "A", label: "AS" },
  { value: "C", label: "COP" },
  { value: "K", label: "KPL" },
  { value: "E", label: "EKR" },
];

const TARGET_3D_OPTIONS: ThemedSelectOption[] = [
  { value: "depan", label: "Depan" },
  { value: "belakang", label: "Belakang" },
];

const TARGET_2D_OPTIONS: ThemedSelectOption[] = [
  { value: "depan", label: "Depan" },
  { value: "tengah", label: "Tengah" },
  { value: "belakang", label: "Belakang" },
];

export default function ScanFields(props: Props) {
  const digitMaximum =
    props.scanMode === "shio" || props.scanMode === "off_shio" ? 12 : 10;
  const digitOptions = Array.from({ length: digitMaximum }, (_, index) => ({
    value: String(index + 1),
    label: `${index + 1} digit`,
  }));

  return (
    <section className="depth-1 rounded-2xl border p-3 sm:p-4">
      <div className="space-y-3">
        <MarketSelectField
          markets={props.markets}
          value={props.marketId}
          selectedMarket={props.selectedMarket}
          disabled={props.marketsLoading}
          onChange={props.onMarketChange}
        />

        <div className="grid grid-cols-2 gap-2.5">
          <NumberField
            label="Data uji"
            value={props.rounds}
            min={1}
            max={100}
            hint="maks. 100"
            onChange={props.onRoundsChange}
          />
          <NumberField
            label="Patah"
            value={props.patah}
            min={0}
            max={props.rounds}
            hint={`maks. ${props.rounds}`}
            onChange={props.onPatahChange}
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <ThemedSelect
            label="Jenis"
            value={props.scanMode}
            options={MODE_OPTIONS}
            onChange={(value) => props.onModeChange(value as ScanMode)}
          />

          {isPositionMode(props.scanMode) ? (
            <ThemedSelect
              label="Target"
              value={props.targetPos}
              options={POSITION_OPTIONS}
              onChange={(value) => props.onTargetPosChange(value as Posisi)}
            />
          ) : is3DMode(props.scanMode) ? (
            <ThemedSelect
              label="Target"
              value={props.target3D}
              options={TARGET_3D_OPTIONS}
              onChange={(value) => props.onTarget3DChange(value as Target3D)}
            />
          ) : (
            <ThemedSelect
              label="Target"
              value={props.target2D}
              options={TARGET_2D_OPTIONS}
              onChange={(value) => props.onTarget2DChange(value as Target2D)}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <ThemedSelect
            label="Jumlah digit"
            value={String(props.digitCount)}
            options={digitOptions}
            onChange={(value) => props.onDigitCountChange(Number(value))}
          />
          <NumberField
            label="Batas hasil"
            value={props.stopScan}
            min={1}
            hint="saran ≤20"
            onChange={props.onStopScanChange}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={props.onScan}
        disabled={props.loading || props.marketsLoading || !props.marketId}
        className="pressable mt-4 flex h-[3.25rem] w-full items-center justify-center rounded-xl border border-primary/70 bg-primary px-4 text-sm font-black text-bg-deep shadow-[0_10px_24px_rgba(105,151,255,0.16)] transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        {props.loading ? "Memproses Scan…" : "Scan Sekarang"}
      </button>
    </section>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.11em] text-text-muted">
      {children}
    </span>
  );
}

function MarketSelectField({
  markets,
  value,
  selectedMarket,
  disabled,
  onChange,
}: {
  markets: Market[];
  value: string;
  selectedMarket: Market | null;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  const filteredMarkets = normalizedQuery
    ? markets.filter((market) =>
        `${marketLabel(market)} ${market.lastResult || ""}`
          .toLocaleLowerCase("id-ID")
          .includes(normalizedQuery),
      )
    : markets;

  useEffect(() => {
    if (!open) return;

    searchRef.current?.focus();

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

  const selectMarket = (marketId: string) => {
    onChange(marketId);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${open ? "z-50" : "z-0"}`}>
      <FieldLabel>Pasaran</FieldLabel>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-12 w-full items-center gap-2.5 rounded-xl border border-border-soft bg-surface px-3 text-left shadow-inner shadow-black/10 outline-none transition-colors hover:border-border-strong focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-55"
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary shadow-[0_0_0_4px_rgba(124,77,255,0.14)]" />
        <span className="min-w-0 flex-1 truncate text-sm font-black text-text">
          {selectedMarket
            ? marketLabel(selectedMarket)
            : disabled
              ? "MEMUAT PASARAN…"
              : "PILIH PASARAN"}
        </span>
        <span className="num shrink-0 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 text-sm font-black tracking-[0.06em] text-accent">
          {selectedMarket?.lastResult || "----"}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-text-soft transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl border border-border-strong bg-surface-2 shadow-[0_24px_70px_rgba(0,0,0,0.55)] ring-1 ring-white/5">
          <div className="border-b border-border-soft bg-surface-2 p-2">
            <div className="flex h-10 items-center gap-2 rounded-xl border border-border-soft bg-bg/70 px-3 focus-within:border-primary/55 focus-within:ring-2 focus-within:ring-primary/10">
              <Search size={15} className="shrink-0 text-text-soft" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari pasaran…"
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold text-text outline-none placeholder:text-text-faint"
              />
            </div>
          </div>

          <div
            role="listbox"
            aria-label="Daftar pasaran"
            className="max-h-[min(18rem,52vh)] overflow-y-auto p-1.5"
          >
            {filteredMarkets.length ? (
              filteredMarkets.map((market) => {
                const selected = market.id === value;
                return (
                  <button
                    key={market.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => selectMarket(market.id)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      selected
                        ? "bg-primary/16 text-text"
                        : "text-text-muted hover:bg-white/[0.06] hover:text-text"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${selected ? "bg-primary" : "bg-text-faint"}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-black">
                      {marketLabel(market)}
                    </span>
                    <span className="num shrink-0 rounded-lg border border-accent/25 bg-accent/10 px-2 py-1 text-xs font-black text-accent">
                      {market.lastResult || "----"}
                    </span>
                    <Check
                      size={15}
                      className={selected ? "text-primary-soft" : "invisible"}
                    />
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-8 text-center text-xs font-bold text-text-soft">
                Pasaran tidak ditemukan
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  hint,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  hint?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const cancelBlurRef = useRef(false);

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    if (draft.trim() === "") {
      setDraft(String(value));
      return;
    }

    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }

    const integer = Math.trunc(parsed);
    const normalized = Math.max(
      min,
      max === undefined ? integer : Math.min(max, integer),
    );
    setDraft(String(normalized));
    if (normalized !== value) onChange(normalized);
  };

  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          value={draft}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setDraft(event.target.value)
          }
          onBlur={() => {
            if (cancelBlurRef.current) {
              cancelBlurRef.current = false;
              setDraft(String(value));
              return;
            }
            commit();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              cancelBlurRef.current = true;
              setDraft(String(value));
              event.currentTarget.blur();
            }
          }}
          className="h-12 w-full rounded-xl border border-border-soft bg-surface px-3 pr-16 text-sm font-black text-text outline-none shadow-inner shadow-black/10 focus:border-primary/50 disabled:opacity-55"
        />
        {hint ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-text-soft/55">
            {hint}
          </span>
        ) : null}
      </div>
    </label>
  );
}
