import type { ChangeEvent, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { Posisi, ScanMode, Target2D, Target3D } from "@/lib/engine/types";
import { is3DMode, isPositionMode } from "@/lib/shared/scan-mode";
import { marketLabel, MODE_OPTIONS } from "../_lib";
import type { Market } from "../_lib";

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

export default function ScanFields(props: Props) {
  const digitMaximum = props.scanMode === "shio" || props.scanMode === "off_shio" ? 12 : 10;
  return (
    <section className="depth-1 rounded-2xl border p-3 sm:p-4">
      <div className="space-y-3">
        <MarketSelectField markets={props.markets} value={props.marketId} selectedMarket={props.selectedMarket} disabled={props.marketsLoading} onChange={props.onMarketChange} />
        <div className="grid grid-cols-2 gap-2.5">
          <NumberField label="Data uji" value={props.rounds} min={1} max={100} hint="maks. 100" onChange={props.onRoundsChange} />
          <NumberField label="Patah" value={props.patah} min={0} max={props.rounds} hint={`maks. ${props.rounds}`} onChange={props.onPatahChange} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <SelectField label="Jenis" value={props.scanMode} onChange={(value) => props.onModeChange(value as ScanMode)}>
            {MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectField>
          {isPositionMode(props.scanMode) ? (
            <SelectField label="Target" value={props.targetPos} onChange={(value) => props.onTargetPosChange(value as Posisi)}>
              <option value="A">AS</option><option value="C">COP</option><option value="K">KPL</option><option value="E">EKR</option>
            </SelectField>
          ) : is3DMode(props.scanMode) ? (
            <SelectField label="Target" value={props.target3D} onChange={(value) => props.onTarget3DChange(value as Target3D)}>
              <option value="depan">Depan</option><option value="belakang">Belakang</option>
            </SelectField>
          ) : (
            <SelectField label="Target" value={props.target2D} onChange={(value) => props.onTarget2DChange(value as Target2D)}>
              <option value="depan">Depan</option><option value="tengah">Tengah</option><option value="belakang">Belakang</option>
            </SelectField>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <SelectField label="Jumlah digit" value={String(props.digitCount)} onChange={(value) => props.onDigitCountChange(Number(value))}>
            {Array.from({ length: digitMaximum }, (_, index) => index + 1).map((digit) => <option key={digit} value={digit}>{digit} digit</option>)}
          </SelectField>
          <NumberField label="Batas hasil" value={props.stopScan} min={1} max={5} onChange={props.onStopScanChange} />
        </div>
      </div>
      <button type="button" onClick={props.onScan} disabled={props.loading || props.marketsLoading || !props.marketId} className="pressable mt-4 flex h-[3.25rem] w-full items-center justify-center rounded-xl border border-primary/70 bg-primary px-4 text-sm font-black text-bg-deep shadow-[0_10px_24px_rgba(105,151,255,0.16)] transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50">
        {props.loading ? "Memproses Scan…" : "Scan Sekarang"}
      </button>
    </section>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.11em] text-text-muted">{children}</span>;
}

function MarketSelectField({ markets, value, selectedMarket, disabled, onChange }: { markets: Market[]; value: string; selectedMarket: Market | null; disabled?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <FieldLabel>Pasaran</FieldLabel>
      <div className="relative">
        <div className="flex h-12 items-center gap-2.5 rounded-xl border border-border-soft bg-surface px-3 shadow-inner shadow-black/10">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary shadow-[0_0_0_4px_rgba(105,151,255,0.12)]" />
          <span className="min-w-0 flex-1 truncate text-sm font-black text-text">{selectedMarket ? marketLabel(selectedMarket) : disabled ? "MEMUAT PASARAN…" : "PILIH PASARAN"}</span>
          <span className="num shrink-0 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 text-sm font-black tracking-[0.06em] text-accent">{selectedMarket?.lastResult || "----"}</span>
          <ChevronDown size={16} className="shrink-0 text-text-soft" />
        </div>
        <select value={value} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)} disabled={disabled} aria-label="Pilih pasaran" className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed">
          <option value="">Pilih pasaran</option>
          {markets.map((market) => <option key={market.id} value={market.id}>{marketLabel(market)} · {market.lastResult || "----"}</option>)}
        </select>
      </div>
    </label>
  );
}

function SelectField({ label, value, onChange, disabled, children }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <select value={value} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)} disabled={disabled} className="h-12 w-full appearance-none rounded-xl border border-border-soft bg-surface px-3 pr-8 text-sm font-black text-text outline-none shadow-inner shadow-black/10 focus:border-primary/50 disabled:opacity-55">{children}</select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-soft" />
      </div>
    </label>
  );
}

function NumberField({ label, value, min, max, hint, disabled, onChange }: { label: string; value: number; min: number; max: number; hint?: string; disabled?: boolean; onChange: (value: number) => void }) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <input type="number" inputMode="numeric" value={value} min={min} max={max} disabled={disabled} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} className="h-12 w-full rounded-xl border border-border-soft bg-surface px-3 pr-16 text-sm font-black text-text outline-none shadow-inner shadow-black/10 focus:border-primary/50 disabled:opacity-55" />
        {hint ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-text-soft/55">{hint}</span> : null}
      </div>
    </label>
  );
}
