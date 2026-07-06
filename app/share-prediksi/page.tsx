"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ClipboardCopy, Loader2, Share2 } from "lucide-react";

type ShareOption = {
  key: string;
  mode: string;
  param: number;
  targetPair: string;
  analysisScope: string;
  updatedAt: string | null;
};

type ShareRow = {
  marketId: string | null;
  marketName: string | null;
  baseResult?: string | null;
  result?: unknown;
  updatedAt: string | null;
  order: number | null;
};

type ShareResponse = { rows: ShareRow[] };

const MODE_LABEL: Record<string, string> = {
  ai: "Angka Ikut",
  ai_parity: "Ganjil Genap",
  ai_size: "Besar Kecil",
  bbfs: "BBFS",
  mati: "Angka Mati",
  jumlah: "Jumlah Mati",
  shio: "Shio Mati",
};

const TARGET_PAIR_LABEL: Record<string, string> = {
  depan: "2D Depan",
  tengah: "2D Tengah",
  belakang: "2D Belakang",
};

const TARGET_LABEL: Record<string, string> = {
  default: "",
  all2d: "Semua 2D",
  "2d_depan": "2D Depan",
  "2d_tengah": "2D Tengah",
  "2d_belakang": "2D Belakang",
  "3d": "3D",
  "4d": "4D",
};

function optionLabel(option: ShareOption) {
  const mode = MODE_LABEL[option.mode] || option.mode.toUpperCase();
  const target = TARGET_LABEL[option.analysisScope] || TARGET_PAIR_LABEL[option.targetPair] || option.analysisScope;
  const param = option.mode === "shio" ? `${option.param} Shio` : `${option.param} Digit`;
  return [mode, target, param].filter(Boolean).join(" · ");
}

function marketLabel(row: ShareRow) {
  return String(row.marketName || row.marketId || "-").trim();
}

function listText(value: unknown, joiner: "" | "." = "") {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join(joiner) || "-";
  if (typeof value === "string" || typeof value === "number") return String(value).trim() || "-";
  if (value && typeof value === "object" && "result" in value) {
    const result = (value as { result?: unknown }).result;
    if (Array.isArray(result)) return result.map(String).join(joiner) || "-";
  }
  return "-";
}

function rowResultText(option: ShareOption, row: ShareRow) {
  const joiner = option.mode === "shio" || option.mode === "jumlah" ? "." : "";
  return listText(row.result, joiner);
}

function buildShareText(option: ShareOption | null, rows: ShareRow[]) {
  if (!option || rows.length === 0) return "";
  const title = optionLabel(option);
  const lines = rows.map((row) => `${marketLabel(row)} ⟢ ${rowResultText(option, row)}`);
  return [title, "", ...lines].join("\n");
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || "Gagal memuat data.");
  return json as T;
}

export default function SharePrediksiPage() {
  const router = useRouter();
  const [options, setOptions] = useState<ShareOption[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [rows, setRows] = useState<ShareRow[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedOption = useMemo(() => options.find((option) => option.key === selectedKey) || null, [options, selectedKey]);
  const shareText = useMemo(() => buildShareText(selectedOption, rows), [selectedOption, rows]);

  useEffect(() => {
    let active = true;
    setLoadingOptions(true);
    setError("");
    fetchJson<ShareOption[]>("/api/share-predictions/options")
      .then((items) => {
        if (!active) return;
        setOptions(items);
        setSelectedKey(items[0]?.key || "");
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Gagal memuat pilihan share prediksi.");
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedOption) return;
    let active = true;
    setLoadingRows(true);
    setRows([]);
    setCopied(false);
    setError("");
    const params = new URLSearchParams({
      mode: selectedOption.mode,
      param: String(selectedOption.param),
      targetPair: selectedOption.targetPair,
      analysisScope: selectedOption.analysisScope,
    });
    fetchJson<ShareResponse>(`/api/share-predictions?${params.toString()}`)
      .then((data) => {
        if (active) setRows(data.rows || []);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Gagal memuat data share prediksi.");
      })
      .finally(() => {
        if (active) setLoadingRows(false);
      });
    return () => {
      active = false;
    };
  }, [selectedOption]);

  const handleCopy = async () => {
    if (!shareText) return;
    await navigator.clipboard?.writeText(shareText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div data-mode="share-prediksi" className="animate-rise space-y-4 pb-4">
      <button type="button" onClick={() => router.back()} className="pressable inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black uppercase tracking-wide text-text-soft">
        <ArrowLeft size={16} /> Kembali
      </button>

      <section className="animate-soft-pop depth-accent rounded-3xl border p-5">
        <div className="accent-text flex items-center gap-2 text-[11px] font-black uppercase tracking-wide">
          <Share2 size={14} /> Share Prediksi
        </div>
        <h2 className="display mt-2 text-3xl text-text">Share Prediksi</h2>
        <p className="mt-2 text-xs font-medium leading-snug text-text-muted">Pilih output, lalu salin format siap kirim.</p>
      </section>

      {error && <StateBox text={error} tone="error" />}

      <section className="animate-soft-pop depth-1 rounded-3xl border p-4">
        <label className="mb-2 block text-[10px] font-black uppercase tracking-wide text-text-soft">Pilihan Output</label>
        {loadingOptions ? (
          <StateBox text="Memuat pilihan…" />
        ) : options.length === 0 ? (
          <StateBox text="Pilihan share prediksi belum tersedia" />
        ) : (
          <select
            value={selectedKey}
            onChange={(event) => setSelectedKey(event.target.value)}
            className="min-h-14 w-full rounded-2xl border border-border-soft bg-surface px-4 text-sm font-black text-text outline-none"
          >
            {options.map((option) => (
              <option key={option.key} value={option.key}>
                {optionLabel(option)}
              </option>
            ))}
          </select>
        )}
      </section>

      <section className="animate-soft-pop depth-1 rounded-3xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="display text-xs text-text">Preview</span>
          <span className="text-[11px] font-bold uppercase tracking-wide text-text-soft">{rows.length} Pasaran</span>
        </div>
        {loadingRows ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border-soft p-4 text-xs font-black uppercase tracking-wide text-text-muted">
            <Loader2 size={16} className="animate-spin" /> Memuat data
          </div>
        ) : shareText ? (
          <pre className="max-h-[55svh] whitespace-pre-wrap rounded-2xl border border-border-soft bg-black/25 p-4 text-xs font-bold leading-6 text-text">{shareText}</pre>
        ) : (
          <StateBox text="Data belum tersedia" />
        )}
        <button
          type="button"
          onClick={handleCopy}
          disabled={!shareText}
          className="accent-bg-soft accent-text mt-3 flex w-full items-center justify-center gap-2 rounded-2xl p-3 text-xs font-black uppercase tracking-wider disabled:opacity-50"
        >
          {copied ? <Check size={16} /> : <ClipboardCopy size={16} />} {copied ? "Tersalin" : "Copy"}
        </button>
      </section>
    </div>
  );
}

function StateBox({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "error" }) {
  return (
    <div className={`animate-soft-pop rounded-3xl border p-4 text-center text-xs font-bold ${tone === "error" ? "border-danger/30 bg-danger/10 text-danger" : "border-dashed text-text-muted"}`}>
      {text}
    </div>
  );
}
