"use client";

import { useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import DropdownPopover from "./DropdownPopover";
import { formatMarketName } from "@/lib/markets/format";

export interface AdaptiveMarketOption {
  id: string;
  name: string;
  lastResult?: string;
}

function marketLabel(market: AdaptiveMarketOption) {
  return formatMarketName(market.name, market.id);
}

export default function AdaptiveMarketSelect({
  markets,
  value,
  selectedMarket,
  disabled,
  loading,
  onChange,
}: {
  markets: AdaptiveMarketOption[];
  value: string;
  selectedMarket: AdaptiveMarketOption | null;
  disabled?: boolean;
  loading?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  const filteredMarkets = normalizedQuery
    ? markets.filter((market) =>
        `${marketLabel(market)} ${market.lastResult || ""}`
          .toLocaleLowerCase("id-ID")
          .includes(normalizedQuery),
      )
    : markets;

  const selectMarket = (marketId: string) => {
    onChange(marketId);
    setQuery("");
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className="relative">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.13em] text-text-muted">
        Pasaran
      </span>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={`Pasaran: ${selectedMarket ? marketLabel(selectedMarket) : "Pilih pasaran"}`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="flex h-12 w-full items-center gap-2.5 rounded-xl border border-border-soft bg-surface px-3 text-left shadow-inner shadow-black/10 outline-none transition-colors hover:border-border-strong focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-55"
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary shadow-[0_0_0_4px_rgba(124,77,255,0.14)]" />
        <span className="min-w-0 flex-1 truncate text-sm font-black text-text">
          {selectedMarket
            ? marketLabel(selectedMarket)
            : loading
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
        <DropdownPopover
          triggerRef={triggerRef}
          onClose={() => setOpen(false)}
          maxHeight={352}
          className="flex flex-col rounded-2xl border border-border-strong bg-surface-2 shadow-[0_24px_70px_rgba(0,0,0,0.55)] ring-1 ring-white/5"
        >
          <div className="shrink-0 border-b border-border-soft bg-surface-2 p-2">
            <div className="flex h-10 items-center gap-2 rounded-xl border border-border-soft bg-bg/70 px-3 focus-within:border-primary/55 focus-within:ring-2 focus-within:ring-primary/10">
              <Search size={15} className="shrink-0 text-text-soft" />
              <input
                aria-label="Cari pasaran"
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari pasaran…"
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold text-text outline-none placeholder:text-text-faint"
              />
            </div>
          </div>

          <div
            id={listboxId}
            role="listbox"
            tabIndex={0}
            aria-label="Daftar pasaran"
            className="min-h-0 overflow-y-auto overscroll-contain p-1.5"
          >
            {filteredMarkets.length ? (
              filteredMarkets.map((market) => {
                const selected = market.id === value;
                return (
                  <button
                    key={market.id}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={selected}
                    onClick={() => selectMarket(market.id)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      selected
                        ? "bg-primary/16 text-text"
                        : "text-text-muted hover:bg-white/[0.06] hover:text-text"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        selected ? "bg-primary" : "bg-text-faint"
                      }`}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-black">
                      {marketLabel(market)}
                    </span>
                    <span className="num shrink-0 rounded-lg border border-accent/25 bg-accent/10 px-2 py-1 text-xs font-black text-accent">
                      {market.lastResult || "----"}
                    </span>
                    <Check size={15} className={selected ? "text-primary-soft" : "invisible"} />
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-8 text-center text-xs font-bold text-text-soft">
                Pasaran tidak ditemukan
              </div>
            )}
          </div>
        </DropdownPopover>
      ) : null}
    </div>
  );
}
