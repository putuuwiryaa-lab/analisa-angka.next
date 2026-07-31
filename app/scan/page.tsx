"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Clipboard, Save, Trash2 } from "lucide-react";
import type { AutoScanItem, AutoScanResult, Posisi, ScanMode, Target2D, Target3D } from "@/lib/engine/types";
import { is3DMode, isPositionMode, isShioMode } from "@/lib/shared/scan-mode";

type Market = {
  id: string;
  name: string;
  lastResult?: string;
  updated_at?: string | null;
};

type SavedTrek = {
  id: string;
  createdAt: string;
  marketId: string;
  marketName: string;
  mode: ScanMode;
  formula: string;
  code: string;
  digits: number[];
  offDigits: number[];
};

const STORAGE_KEY = "analisa_scan_saved_treks_v1";

const MODE_OPTIONS: { value: ScanMode; label: string; digits: number }[] = [
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
  { value: "experiment_x7", label: "Experiment X7", digits: 7 },
];

function marketLabel(market: Market) {
  return String(market.name || market.id).toUpperCase();
}

function displayDigits(values: number[], mode: ScanMode) {
  if (isShioMode(mode)) return values.map((digit) => String(digit + 1).padStart(2, "0")).join("-");
  return values.join("");
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

export default function ScanPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketId, setMarketId] = useState("");
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [scanMode, setScanMode] = useState<ScanMode>("ai_2d_belakang");
  const [targetPos, setTargetPos] = useState<Posisi>("K");
  const [target2D, setTarget2D] = useState<Target2D>("belakang");
  const [target3D, setTarget3D] = useState<Target3D>("belakang");
  const [rounds, setRounds] = useState(14);
  const [patah, setPatah] = useState(0);
  const [digitCount, setDigitCount] = useState(4);
  const [stopScan, setStopScan] = useState(3);
  const [marketName, setMarketName] = useState("");
  const [result, setResult] = useState<AutoScanResult | null>(null);
  const [savedTreks, setSavedTreks] = useState<SavedTrek[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState("");

  useEffect(() => {
    fetch("/api/markets")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Gagal memuat pasaran.");
        return Array.isArray(data) ? data : [];
      })
      .then((data: Market[]) => {
        setMarkets(data);
        const defaultMarket = data.find((market) => /singapore|sgp/i.test(`${market.id} ${market.name}`)) ?? data[0];
        if (defaultMarket) setMarketId(defaultMarket.id);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Gagal memuat pasaran."))
      .finally(() => setMarketsLoading(false));

    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(stored)) setSavedTreks(stored);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const selectedMarket = markets.find((market) => market.id === marketId) ?? null;
  const digitMaximum = isShioMode(scanMode) ? 12 : 10;

  function changeMode(mode: ScanMode) {
    setScanMode(mode);
    const option = MODE_OPTIONS.find((item) => item.value === mode);
    setDigitCount(option?.digits ?? 7);
    if (mode === "experiment_x7") {
      setRounds(7);
      setPatah(0);
      setStopScan(1);
    }
  }

  async function runScan() {
    if (!marketId) {
      setError("Pilih pasaran terlebih dahulu.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId,
          scanMode,
          targetPos,
          target2D,
          target3D,
          L: rounds,
          patah,
          digitCount,
          stopScan,
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.error) throw new Error(data?.error || "Scan gagal.");
      setMarketName(String(data.market || selectedMarket?.name || selectedMarket?.id || "Pasaran"));
      setResult(data.result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Scan gagal.");
    } finally {
      setLoading(false);
    }
  }

  function persistSaved(next: SavedTrek[]) {
    setSavedTreks(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function saveTrek(item: AutoScanItem) {
    const trek: SavedTrek = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      createdAt: new Date().toISOString(),
      marketId,
      marketName: marketName || selectedMarket?.name || selectedMarket?.id || marketId,
      mode: item.scanMode,
      formula: item.formula,
      code: item.code,
      digits: item.angkaHidup,
      offDigits: item.angkaMati,
    };
    persistSaved([trek, ...savedTreks].slice(0, 100));
  }

  function deleteTrek(id: string) {
    persistSaved(savedTreks.filter((item) => item.id !== id));
  }

  async function copyItem(item: AutoScanItem) {
    const text = [
      String(marketName || selectedMarket?.name || selectedMarket?.id || "Pasaran").toUpperCase(),
      displayDigits(item.angkaHidup, item.scanMode),
      item.angkaMati.length ? `OFF: ${displayDigits(item.angkaMati, item.scanMode)}` : "",
      item.formula,
      item.code,
    ].filter(Boolean).join("\n");
    await copyText(text);
    setCopiedCode(item.code);
    window.setTimeout(() => setCopiedCode(""), 1400);
  }

  return (
    <div className="animate-rise space-y-4">
      <section className="depth-1 rounded-3xl border p-4 sm:p-5">
        <div className="space-y-4">
          <MarketSelectField
            markets={markets}
            value={marketId}
            selectedMarket={selectedMarket}
            disabled={marketsLoading}
            onChange={setMarketId}
          />

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Data uji"
              value={rounds}
              min={1}
              max={100}
              hint="maks. 100"
              disabled={scanMode === "experiment_x7"}
              onChange={setRounds}
            />
            <NumberField
              label="Patah"
              value={patah}
              min={0}
              max={rounds}
              hint={`maks. ${rounds}`}
              disabled={scanMode === "experiment_x7"}
              onChange={setPatah}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Jenis" value={scanMode} onChange={(value) => changeMode(value as ScanMode)}>
              {MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>

            {isPositionMode(scanMode) ? (
              <SelectField label="Target" value={targetPos} onChange={(value) => setTargetPos(value as Posisi)}>
                <option value="A">AS</option>
                <option value="C">COP</option>
                <option value="K">KPL</option>
                <option value="E">EKR</option>
              </SelectField>
            ) : is3DMode(scanMode) ? (
              <SelectField label="Target" value={target3D} onChange={(value) => setTarget3D(value as Target3D)}>
                <option value="depan">Depan</option>
                <option value="belakang">Belakang</option>
              </SelectField>
            ) : scanMode !== "experiment_x7" ? (
              <SelectField label="Target" value={target2D} onChange={(value) => setTarget2D(value as Target2D)}>
                <option value="depan">Depan</option>
                <option value="tengah">Tengah</option>
                <option value="belakang">Belakang</option>
              </SelectField>
            ) : (
              <SelectField label="Target" value="otomatis" disabled onChange={() => undefined}>
                <option value="otomatis">Otomatis</option>
              </SelectField>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Jumlah digit"
              value={String(digitCount)}
              disabled={scanMode === "experiment_x7"}
              onChange={(value) => setDigitCount(Number(value))}
            >
              {Array.from({ length: digitMaximum }, (_, index) => index + 1).map((digit) => (
                <option key={digit} value={digit}>{digit} digit</option>
              ))}
            </SelectField>
            <NumberField
              label="Batas hasil"
              value={stopScan}
              min={1}
              max={5}
              disabled={scanMode === "experiment_x7"}
              onChange={setStopScan}
            />
          </div>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-sm font-bold text-danger">{error}</div> : null}

        <button
          type="button"
          onClick={runScan}
          disabled={loading || marketsLoading || !marketId}
          className="pressable mt-5 flex h-16 w-full items-center justify-center rounded-2xl border border-primary/70 bg-primary px-4 text-base font-black text-bg-deep shadow-[0_12px_30px_rgba(105,151,255,0.18)] transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Memproses Scan…" : "Scan Sekarang"}
        </button>
      </section>

      {result ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-text-soft">Hasil {marketName}</p>
              <h2 className="display text-xl text-text">{result.totalMatched} trek ditemukan</h2>
            </div>
            <span className="rounded-full border border-border-soft bg-surface px-3 py-1 text-[10px] font-black uppercase tracking-wide text-text-muted">{result.totalChecked} rumus</span>
          </div>

          {result.items.length ? result.items.map((item, index) => (
            <article key={`${item.code}-${index}`} className="depth-1 rounded-3xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wide text-primary-soft">Peringkat {index + 1}</p>
                  <p className="mt-1 truncate text-xs font-bold text-text-muted">{item.formula}</p>
                </div>
                <span className="rounded-full border border-border-soft px-2.5 py-1 text-[10px] font-black text-text-soft">{item.activeColumns || "X7"}</span>
              </div>

              <div className="my-4 rounded-3xl border border-primary/20 bg-primary/10 px-4 py-5 text-center">
                <div className="num break-all text-4xl font-black tracking-[0.13em] text-accent">{displayDigits(item.angkaHidup, item.scanMode) || "-"}</div>
                {item.angkaMati.length ? <p className="mt-2 text-xs font-black uppercase tracking-wide text-text-muted">OFF {displayDigits(item.angkaMati, item.scanMode)}</p> : null}
              </div>

              <p className="break-all rounded-2xl bg-black/15 px-3 py-2 font-mono text-[10px] leading-relaxed text-text-soft">{item.code}</p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => copyItem(item)} className="pressable flex h-11 items-center justify-center gap-2 rounded-2xl border border-border-soft bg-white/[0.035] text-xs font-black uppercase tracking-wide text-text-muted hover:text-text">
                  {copiedCode === item.code ? <Check size={16} /> : <Clipboard size={16} />}
                  {copiedCode === item.code ? "Tersalin" : "Salin"}
                </button>
                <button onClick={() => saveTrek(item)} className="pressable flex h-11 items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 text-xs font-black uppercase tracking-wide text-primary-soft">
                  <Save size={16} /> Simpan Trek
                </button>
              </div>
            </article>
          )) : (
            <div className="rounded-3xl border border-dashed border-border-soft p-8 text-center text-sm font-bold text-text-muted">Tidak ada trek yang cocok dengan konfigurasi ini.</div>
          )}
        </section>
      ) : null}

      <section className="depth-1 rounded-3xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-text-soft">Penyimpanan lokal</p>
            <h2 className="display text-lg text-text">Saved Trek</h2>
          </div>
          <span className="rounded-full border border-border-soft px-3 py-1 text-xs font-black text-text-muted">{savedTreks.length}</span>
        </div>

        {savedTreks.length ? (
          <div className="space-y-2">
            {savedTreks.map((trek) => (
              <div key={trek.id} className="flex items-center gap-3 rounded-2xl border border-border-soft bg-white/[0.025] p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black uppercase text-text">{trek.marketName}</p>
                  <p className="num mt-1 truncate text-xl font-black tracking-[0.1em] text-accent">{displayDigits(trek.digits, trek.mode)}</p>
                  <p className="mt-1 truncate font-mono text-[9px] text-text-soft">{trek.formula} · {trek.code}</p>
                </div>
                <button onClick={() => deleteTrek(trek.id)} className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-danger/25 bg-danger/10 text-danger" aria-label="Hapus trek">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border-soft p-5 text-center text-xs font-bold text-text-soft">Belum ada trek tersimpan pada domain Analisa Angka.</p>
        )}
      </section>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-text-muted">{children}</span>;
}

function MarketSelectField({ markets, value, selectedMarket, disabled, onChange }: {
  markets: Market[];
  value: string;
  selectedMarket: Market | null;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <FieldLabel>Pasaran</FieldLabel>
      <div className="relative">
        <div className="flex h-[4.5rem] items-center gap-3 rounded-2xl border border-border-soft bg-surface px-4 shadow-inner shadow-black/10">
          <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-primary shadow-[0_0_0_6px_rgba(105,151,255,0.12)]" />
          <span className="min-w-0 flex-1 truncate text-base font-black text-text">
            {selectedMarket ? marketLabel(selectedMarket) : disabled ? "MEMUAT PASARAN…" : "PILIH PASARAN"}
          </span>
          <span className="num shrink-0 rounded-xl border border-accent/30 bg-accent/10 px-3 py-1.5 text-base font-black tracking-[0.08em] text-accent">
            {selectedMarket?.lastResult || "----"}
          </span>
          <ChevronDown size={18} className="shrink-0 text-text-soft" />
        </div>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-label="Pilih pasaran"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        >
          <option value="">Pilih pasaran</option>
          {markets.map((market) => (
            <option key={market.id} value={market.id}>{marketLabel(market)} · {market.lastResult || "----"}</option>
          ))}
        </select>
      </div>
    </label>
  );
}

function SelectField({ label, value, onChange, disabled, children }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-[4.5rem] w-full appearance-none rounded-2xl border border-border-soft bg-surface px-4 pr-10 text-base font-black text-text outline-none shadow-inner shadow-black/10 focus:border-primary/50 disabled:opacity-55"
        >
          {children}
        </select>
        <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-soft" />
      </div>
    </label>
  );
}

function NumberField({ label, value, min, max, hint, disabled, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  hint?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))}
          className="h-[4.5rem] w-full rounded-2xl border border-border-soft bg-surface px-4 pr-20 text-base font-black text-text outline-none shadow-inner shadow-black/10 focus:border-primary/50 disabled:opacity-55"
        />
        {hint ? <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-text-soft/55">{hint}</span> : null}
      </div>
    </label>
  );
}
