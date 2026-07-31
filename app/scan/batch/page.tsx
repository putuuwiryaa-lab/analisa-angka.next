"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clipboard, Layers3, Play, Search, Square, SquareCheckBig, X } from "lucide-react";
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

  return (
    <div className="animate-rise space-y-4">
      <section className="depth-1 rounded-3xl border p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 text-primary-soft"><Layers3 size={22} /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary-soft">Multi-pasaran</p>
            <h2 className="display text-2xl text-text">Batch Scan</h2>
            <p className="mt-1 text-sm font-medium text-text-soft">Maksimal {MAX_MARKETS} pasaran. Tidak ada proses Adaptif.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Jenis scan" value={scanMode} onChange={(value) => changeMode(value as ScanMode)}>
            {MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
          </SelectField>

          {isPositionMode(scanMode) ? (
            <SelectField label="Target posisi" value={targetPos} onChange={(value) => setTargetPos(value as Posisi)}>
              <option value="A">AS</option><option value="C">COP</option><option value="K">KPL</option><option value="E">EKR</option>
            </SelectField>
          ) : is3DMode(scanMode) ? (
            <SelectField label="Target 3D" value={target3D} onChange={(value) => setTarget3D(value as Target3D)}>
              <option value="depan">3D Depan</option><option value="belakang">3D Belakang</option>
            </SelectField>
          ) : (
            <SelectField label="Target 2D" value={target2D} onChange={(value) => setTarget2D(value as Target2D)}>
              <option value="depan">2D Depan</option><option value="tengah">2D Tengah</option><option value="belakang">2D Belakang</option>
            </SelectField>
          )}

          <NumberField label="Data uji" value={rounds} min={1} max={100} onChange={setRounds} />
          <NumberField label="Toleransi patah" value={patah} min={0} max={rounds} onChange={setPatah} />
          <NumberField label="Jumlah digit" value={digitCount} min={1} max={isShioMode(scanMode) ? 12 : 10} onChange={setDigitCount} />
          <label>
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-text-muted">Pemisah output</span>
            <input value={separator} onChange={(event) => setSeparator(event.target.value.slice(0, 16))} className="h-12 w-full rounded-2xl border border-border-soft bg-surface px-3 text-sm font-bold text-text outline-none focus:border-primary/50" />
          </label>
        </div>

        <div className="mt-3">
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-text-muted">Peringkat yang dipakai</span>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((rank) => {
              const active = topRanks.includes(rank);
              return (
                <button key={rank} type="button" onClick={() => toggleRank(rank)} className={`pressable flex h-11 items-center justify-center gap-2 rounded-2xl border text-xs font-black uppercase tracking-wide ${active ? "border-primary/40 bg-primary/15 text-primary-soft" : "border-border-soft bg-white/[0.025] text-text-muted"}`}>
                  {active ? <SquareCheckBig size={16} /> : <Square size={16} />} Top {rank}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="depth-1 rounded-3xl border p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-text-soft">Daftar pasaran</p>
            <h2 className="display text-lg text-text">Dipilih {selected.length}/{MAX_MARKETS}</h2>
          </div>
          {selected.length ? <button onClick={() => setSelected([])} className="pressable flex h-9 items-center gap-1.5 rounded-xl border border-danger/25 bg-danger/10 px-3 text-[10px] font-black uppercase text-danger"><X size={14} /> Bersihkan</button> : null}
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-soft" size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari pasaran" className="h-12 w-full rounded-2xl border border-border-soft bg-surface pl-10 pr-4 text-sm font-bold text-text outline-none focus:border-primary/50" />
        </div>

        <button type="button" onClick={selectVisible} disabled={marketsLoading || !filteredMarkets.length} className="pressable mb-3 h-10 w-full rounded-xl border border-border-soft bg-white/[0.025] text-[11px] font-black uppercase tracking-wide text-text-muted disabled:opacity-50">Pilih semua hasil pencarian</button>

        <div className="grid max-h-[25rem] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
          {filteredMarkets.map((market) => {
            const active = selected.includes(market.id);
            return (
              <button key={market.id} type="button" onClick={() => toggleMarket(market.id)} className={`pressable min-h-20 rounded-2xl border p-3 text-left ${active ? "border-primary/45 bg-primary/15" : "border-border-soft bg-white/[0.025]"}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className={`line-clamp-2 text-[11px] font-black uppercase ${active ? "text-primary-soft" : "text-text"}`}>{market.name || market.id}</span>
                  {active ? <Check size={15} className="shrink-0 text-primary-soft" /> : null}
                </div>
                <span className="num mt-2 block text-lg font-black tracking-wider text-accent">{market.lastResult || "----"}</span>
              </button>
            );
          })}
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-sm font-bold text-danger">{error}</div> : null}

        <button type="button" onClick={runBatch} disabled={loading || marketsLoading || !selected.length} className="pressable mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-primary/45 bg-primary/20 px-4 text-sm font-black uppercase tracking-wide text-primary-soft disabled:cursor-not-allowed disabled:opacity-50">
          <Play size={18} fill="currentColor" />
          {loading ? `Memproses ${selected.length} pasaran…` : "Jalankan Batch Scan"}
        </button>
      </section>

      {result ? (
        <section className="depth-1 rounded-3xl border p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-text-soft">Output siap salin</p>
              <h2 className="display text-xl text-text">{result.title}</h2>
            </div>
            <button onClick={copyOutput} className="pressable flex h-10 items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 text-[10px] font-black uppercase tracking-wide text-primary-soft">
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

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-text-muted">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded-2xl border border-border-soft bg-surface px-3 text-sm font-bold text-text outline-none focus:border-primary/50">{children}</select>
    </label>
  );
}

function NumberField({ label, value, min, max, disabled, onChange }: { label: string; value: number; min: number; max: number; disabled?: boolean; onChange: (value: number) => void }) {
  return (
    <label>
      <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-text-muted">{label}</span>
      <input type="number" value={value} min={min} max={max} disabled={disabled} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} className="h-12 w-full rounded-2xl border border-border-soft bg-surface px-3 text-sm font-bold text-text outline-none focus:border-primary/50 disabled:opacity-60" />
    </label>
  );
}
