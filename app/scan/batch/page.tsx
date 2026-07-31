"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { Check, ChevronDown, Clipboard, Search, Square, SquareCheckBig, X } from "lucide-react";
import type { Posisi, ScanMode, Target2D, Target3D } from "@/lib/engine/types";
import { is3DMode, isPositionMode, isShioMode } from "@/lib/shared/scan-mode";

type Market = { id: string; name: string; lastResult?: string };
type BatchResult = {
  title: string;
  results: { id: string; name: string; digits: string }[];
  copyText: string;
  limit: number;
};

const MAX_MARKETS = 35;
const MODES: { value: ScanMode; label: string; digits: number }[] = [
  { value: "posisi", label: "Posisi", digits: 7 },
  { value: "ai_2d_belakang", label: "AI 2D", digits: 4 },
  { value: "bbfs_2d_belakang", label: "BBFS 2D", digits: 7 },
  { value: "jumlah_2d_belakang", label: "Jumlah 2D", digits: 4 },
  { value: "ai_3d", label: "AI 3D", digits: 8 },
  { value: "bbfs_3d", label: "BBFS 3D", digits: 8 },
  { value: "off_posisi", label: "OFF Posisi", digits: 3 },
  { value: "off_2d_belakang", label: "OFF 2D", digits: 3 },
  { value: "off_jumlah_2d_belakang", label: "OFF Jumlah 2D", digits: 3 },
  { value: "off_3d", label: "OFF 3D", digits: 3 },
  { value: "shio", label: "Shio", digits: 6 },
  { value: "off_shio", label: "OFF Shio", digits: 6 },
];

async function writeClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

export default function BatchScanPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [scanMode, setScanMode] = useState<ScanMode>("bbfs_2d_belakang");
  const [targetPos, setTargetPos] = useState<Posisi>("K");
  const [target2D, setTarget2D] = useState<Target2D>("belakang");
  const [target3D, setTarget3D] = useState<Target3D>("belakang");
  const [rounds, setRounds] = useState(14);
  const [patah, setPatah] = useState(0);
  const [digitCount, setDigitCount] = useState(7);
  const [topRanks, setTopRanks] = useState<number[]>([1]);
  const [separator, setSeparator] = useState("➜");
  const [result, setResult] = useState<BatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/markets")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Gagal memuat pasaran.");
        return Array.isArray(data) ? data : [];
      })
      .then((data: Market[]) => setMarkets(data))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Gagal memuat pasaran."))
      .finally(() => setMarketsLoading(false));
  }, []);

  const filteredMarkets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return markets;
    return markets.filter((market) => `${market.id} ${market.name}`.toLowerCase().includes(normalized));
  }, [markets, query]);

  function changeMode(mode: ScanMode) {
    setScanMode(mode);
    setDigitCount(MODES.find((item) => item.value === mode)?.digits ?? 7);
  }

  function toggleMarket(id: string) {
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < MAX_MARKETS ? [...current, id] : current);
  }

  function selectVisible() {
    const next = [...new Set([...selected, ...filteredMarkets.map((market) => market.id)])].slice(0, MAX_MARKETS);
    setSelected(next);
  }

  function toggleRank(rank: number) {
    setTopRanks((current) => {
      if (current.includes(rank)) {
        const next = current.filter((item) => item !== rank);
        return next.length ? next : [1];
      }
      return [...current, rank].sort((a, b) => a - b);
    });
  }

  async function runBatch() {
    if (!selected.length) {
      setError("Pilih minimal satu pasaran.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/batch-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketIds: selected,
          scanMode,
          targetPos,
          target2D,
          target3D,
          digitCount,
          topRanks,
          L: rounds,
          patah,
          lineSeparator: separator,
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.error) throw new Error(data?.error || "Batch scan gagal.");
      setResult(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Batch scan gagal.");
    } finally {
      setLoading(false);
    }
  }

  async function copyOutput() {
    if (!result) return;
    await writeClipboard(result.copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  const digitMaximum = isShioMode(scanMode) ? 12 : 10;

  return (
    <div className="animate-rise space-y-4">
      <section className="depth-1 rounded-3xl border p-4 sm:p-5">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Data uji" value={rounds} min={1} max={100} hint="maks. 100" onChange={setRounds} />
            <NumberField label="Patah" value={patah} min={0} max={rounds} hint={`maks. ${rounds}`} onChange={setPatah} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Jenis" value={scanMode} onChange={(value) => changeMode(value as ScanMode)}>
              {MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
            </SelectField>

            {isPositionMode(scanMode) ? (
              <SelectField label="Target" value={targetPos} onChange={(value) => setTargetPos(value as Posisi)}>
                <option value="A">AS</option><option value="C">COP</option><option value="K">KPL</option><option value="E">EKR</option>
              </SelectField>
            ) : is3DMode(scanMode) ? (
              <SelectField label="Target" value={target3D} onChange={(value) => setTarget3D(value as Target3D)}>
                <option value="depan">Depan</option><option value="belakang">Belakang</option>
              </SelectField>
            ) : (
              <SelectField label="Target" value={target2D} onChange={(value) => setTarget2D(value as Target2D)}>
                <option value="depan">Depan</option><option value="tengah">Tengah</option><option value="belakang">Belakang</option>
              </SelectField>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Jumlah digit" value={String(digitCount)} onChange={(value) => setDigitCount(Number(value))}>
              {Array.from({ length: digitMaximum }, (_, index) => index + 1).map((digit) => <option key={digit} value={digit}>{digit} digit</option>)}
            </SelectField>
            <TextField label="Pemisah output" value={separator} onChange={(value) => setSeparator(value.slice(0, 16))} />
          </div>

          <div>
            <FieldLabel>Peringkat yang dipakai</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((rank) => {
                const active = topRanks.includes(rank);
                return (
                  <button key={rank} type="button" onClick={() => toggleRank(rank)} className={`pressable flex h-[4.5rem] items-center justify-center gap-2 rounded-2xl border text-xs font-black uppercase tracking-wide shadow-inner shadow-black/10 ${active ? "border-primary/40 bg-primary/15 text-primary-soft" : "border-border-soft bg-surface text-text-muted"}`}>
                    {active ? <SquareCheckBig size={17} /> : <Square size={17} />} Top {rank}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="depth-1 rounded-3xl border p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-text-soft">Daftar pasaran</p>
            <h2 className="display text-lg text-text">Dipilih {selected.length}/{MAX_MARKETS}</h2>
          </div>
          {selected.length ? (
            <button type="button" onClick={() => setSelected([])} className="pressable flex h-9 items-center gap-1.5 rounded-xl border border-danger/25 bg-danger/10 px-3 text-[10px] font-black uppercase text-danger">
              <X size={14} /> Bersihkan
            </button>
          ) : null}
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-soft" size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari pasaran" className="h-[4.5rem] w-full rounded-2xl border border-border-soft bg-surface pl-12 pr-4 text-base font-black text-text outline-none shadow-inner shadow-black/10 focus:border-primary/50" />
        </div>

        <button type="button" onClick={selectVisible} disabled={marketsLoading || !filteredMarkets.length} className="pressable mb-3 h-14 w-full rounded-2xl border border-border-soft bg-surface text-[11px] font-black uppercase tracking-wide text-text-muted shadow-inner shadow-black/10 disabled:opacity-50">
          Pilih semua hasil pencarian
        </button>

        <div className="grid max-h-[25rem] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
          {filteredMarkets.map((market) => {
            const active = selected.includes(market.id);
            return (
              <button key={market.id} type="button" onClick={() => toggleMarket(market.id)} className={`pressable flex min-h-16 items-center justify-between gap-2 rounded-2xl border px-3 py-3 text-left shadow-inner shadow-black/10 ${active ? "border-primary/45 bg-primary/15" : "border-border-soft bg-surface"}`}>
                <span className={`line-clamp-2 text-[11px] font-black uppercase leading-snug ${active ? "text-primary-soft" : "text-text"}`}>{market.name || market.id}</span>
                {active ? <Check size={16} className="shrink-0 text-primary-soft" /> : null}
              </button>
            );
          })}
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-sm font-bold text-danger">{error}</div> : null}

        <button type="button" onClick={runBatch} disabled={loading || marketsLoading || !selected.length} className="pressable mt-5 flex h-16 w-full items-center justify-center rounded-2xl border border-primary/70 bg-primary px-4 text-base font-black text-bg-deep shadow-[0_12px_30px_rgba(105,151,255,0.18)] transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? `Memproses ${selected.length} pasaran…` : "Batch Scan Sekarang"}
        </button>
      </section>

      {result ? (
        <section className="depth-1 rounded-3xl border p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-text-soft">Output siap salin</p>
              <h2 className="display text-xl text-text">{result.title}</h2>
            </div>
            <button type="button" onClick={copyOutput} className="pressable flex h-10 items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 text-[10px] font-black uppercase tracking-wide text-primary-soft">
              {copied ? <Check size={15} /> : <Clipboard size={15} />}{copied ? "Tersalin" : "Salin"}
            </button>
          </div>
          <div className="space-y-2">
            {result.results.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border-soft bg-white/[0.025] p-3">
                <span className="min-w-0 truncate text-xs font-black uppercase text-text-muted">{row.name}</span>
                <span className="num shrink-0 text-lg font-black tracking-wider text-accent">{row.digits}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-text-muted">{children}</span>;
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <select value={value} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)} className="h-[4.5rem] w-full appearance-none rounded-2xl border border-border-soft bg-surface px-4 pr-10 text-base font-black text-text outline-none shadow-inner shadow-black/10 focus:border-primary/50">{children}</select>
        <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-soft" />
      </div>
    </label>
  );
}

function NumberField({ label, value, min, max, hint, onChange }: { label: string; value: number; min: number; max: number; hint?: string; onChange: (value: number) => void }) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <input type="number" inputMode="numeric" value={value} min={min} max={max} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} className="h-[4.5rem] w-full rounded-2xl border border-border-soft bg-surface px-4 pr-20 text-base font-black text-text outline-none shadow-inner shadow-black/10 focus:border-primary/50" />
        {hint ? <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-text-soft/55">{hint}</span> : null}
      </div>
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <input value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)} className="h-[4.5rem] w-full rounded-2xl border border-border-soft bg-surface px-4 text-base font-black text-text outline-none shadow-inner shadow-black/10 focus:border-primary/50" />
    </label>
  );
}
