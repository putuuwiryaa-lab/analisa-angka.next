"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { Check, ChevronDown, Clipboard, Search, Square, SquareCheckBig, X } from "lucide-react";
import type { Posisi, ScanMode, Target2D, Target3D } from "@/lib/engine/types";
import { is3DMode, isPositionMode, isShioMode } from "@/lib/shared/scan-mode";

type Market = { id: string; name: string; lastResult?: string };
type BatchResult = {
  results: { id: string; name: string; digits: string }[];
  lineSeparator?: string;
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

  const outputText = useMemo(() => {
    if (!result) return "";
    const activeSeparator = result.lineSeparator || separator;
    return result.results.map((row) => `${row.name} ${activeSeparator} ${row.digits}`).join("\n");
  }, [result, separator]);

  function changeMode(mode: ScanMode) {
    setScanMode(mode);
    setDigitCount(MODES.find((item) => item.value === mode)?.digits ?? 7);
  }

  function toggleMarket(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < MAX_MARKETS
          ? [...current, id]
          : current,
    );
  }

  function selectVisible() {
    setSelected([...new Set([...selected, ...filteredMarkets.map((market) => market.id)])].slice(0, MAX_MARKETS));
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
    if (!outputText) return;
    await writeClipboard(outputText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  const digitMaximum = isShioMode(scanMode) ? 12 : 10;

  return (
    <div className="animate-rise space-y-3">
      <section className="depth-1 rounded-2xl border p-3 sm:p-4">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <NumberField label="Data uji" value={rounds} min={1} max={100} hint="maks. 100" onChange={setRounds} />
            <NumberField label="Patah" value={patah} min={0} max={rounds} hint={`maks. ${rounds}`} onChange={setPatah} />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
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

          <div className="grid grid-cols-2 gap-2.5">
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
                  <button
                    key={rank}
                    type="button"
                    onClick={() => toggleRank(rank)}
                    className={`pressable flex h-12 items-center justify-center gap-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wide shadow-inner shadow-black/10 ${active ? "border-primary/40 bg-primary/15 text-primary-soft" : "border-border-soft bg-surface text-text-muted"}`}
                  >
                    {active ? <SquareCheckBig size={15} /> : <Square size={15} />} Top {rank}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="depth-1 rounded-2xl border p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-text-soft">Daftar pasaran</p>
            <h2 className="display text-base text-text">Dipilih {selected.length}/{MAX_MARKETS}</h2>
          </div>
          {selected.length ? (
            <button type="button" onClick={() => setSelected([])} className="pressable flex h-8 items-center gap-1 rounded-lg border border-danger/25 bg-danger/10 px-2.5 text-[9px] font-black uppercase text-danger">
              <X size={13} /> Bersihkan
            </button>
          ) : null}
        </div>

        <div className="relative mb-2.5">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-soft" size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari pasaran"
            className="h-12 w-full rounded-xl border border-border-soft bg-surface pl-9 pr-3 text-sm font-black text-text outline-none shadow-inner shadow-black/10 focus:border-primary/50"
          />
        </div>

        <button type="button" onClick={selectVisible} disabled={marketsLoading || !filteredMarkets.length} className="pressable mb-2.5 h-10 w-full rounded-xl border border-border-soft bg-surface text-[10px] font-black uppercase tracking-wide text-text-muted shadow-inner shadow-black/10 disabled:opacity-50">
          Pilih semua hasil pencarian
        </button>

        <div className="grid max-h-[22rem] grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3">
          {filteredMarkets.map((market) => {
            const active = selected.includes(market.id);
            return (
              <button
                key={market.id}
                type="button"
                onClick={() => toggleMarket(market.id)}
                className={`pressable flex min-h-12 items-center justify-between gap-1.5 rounded-xl border px-2.5 py-2 text-left shadow-inner shadow-black/10 ${active ? "border-primary/45 bg-primary/15" : "border-border-soft bg-surface"}`}
              >
                <span className={`line-clamp-2 text-[10px] font-black uppercase leading-snug ${active ? "text-primary-soft" : "text-text"}`}>{market.name || market.id}</span>
                {active ? <Check size={14} className="shrink-0 text-primary-soft" /> : null}
              </button>
            );
          })}
        </div>

        {error ? <div className="mt-3 rounded-xl border border-danger/30 bg-danger/10 p-2.5 text-xs font-bold text-danger">{error}</div> : null}

        <button type="button" onClick={runBatch} disabled={loading || marketsLoading || !selected.length} className="pressable mt-4 flex h-[3.25rem] w-full items-center justify-center rounded-xl border border-primary/70 bg-primary px-4 text-sm font-black text-bg-deep shadow-[0_10px_24px_rgba(105,151,255,0.16)] transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? `Memproses ${selected.length} pasaran…` : "Batch Scan Sekarang"}
        </button>
      </section>

      {result ? (
        <section className="depth-1 rounded-2xl border p-3 sm:p-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <FieldLabel>Hasil siap copy</FieldLabel>
            <button type="button" onClick={copyOutput} className="pressable flex h-8 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 text-[9px] font-black uppercase tracking-wide text-primary-soft">
              {copied ? <Check size={13} /> : <Clipboard size={13} />}
              {copied ? "Tersalin" : "Copy"}
            </button>
          </div>
          <textarea
            readOnly
            value={outputText}
            rows={Math.min(Math.max(result.results.length, 4), 12)}
            onFocus={(event) => event.currentTarget.select()}
            className="num w-full resize-none rounded-xl border border-border-soft bg-surface p-3 text-xs font-black leading-6 text-text outline-none shadow-inner shadow-black/10 focus:border-primary/50"
            aria-label="Hasil Batch Scan siap disalin"
          />
        </section>
      ) : null}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.11em] text-text-muted">{children}</span>;
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <select value={value} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)} className="h-12 w-full appearance-none rounded-xl border border-border-soft bg-surface px-3 pr-8 text-sm font-black text-text outline-none shadow-inner shadow-black/10 focus:border-primary/50">{children}</select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-soft" />
      </div>
    </label>
  );
}

function NumberField({ label, value, min, max, hint, onChange }: { label: string; value: number; min: number; max: number; hint?: string; onChange: (value: number) => void }) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <input type="number" inputMode="numeric" value={value} min={min} max={max} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} className="h-12 w-full rounded-xl border border-border-soft bg-surface px-3 pr-16 text-sm font-black text-text outline-none shadow-inner shadow-black/10 focus:border-primary/50" />
        {hint ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-text-soft/55">{hint}</span> : null}
      </div>
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <input value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)} className="h-12 w-full rounded-xl border border-border-soft bg-surface px-3 text-sm font-black text-text outline-none shadow-inner shadow-black/10 focus:border-primary/50" />
    </label>
  );
}
