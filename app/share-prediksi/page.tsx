"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardCopy, Loader2, Share2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { deviceAuthHeader } from "@/lib/auth/device";

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
  baseResult: string | null;
  result: unknown;
  updatedAt: string | null;
  order: number | null;
};

type ShareResponse = {
  rows: ShareRow[];
};

const SEPARATOR = "⟡";

const MARKET_ALIAS: Record<string, string> = {
  SINGAPORE6D: "SGP",
  SINGAPORE: "SGP",
  HONGKONG: "HK",
  HONGKONGLOTTO: "HK",
};

const MODE_LABEL: Record<string, string> = {
  ai: "Angka Ikut",
  ai_parity: "Angka Ikut Ganjil Genap",
  ai_size: "Angka Ikut Besar Kecil",
  bbfs: "BBFS",
  mati: "Angka Mati",
  jumlah: "Jumlah Mati",
  shio: "Shio Mati",
};

const TARGET_LABEL: Record<string, string> = {
  default: "",
  "2d_depan": "2D Depan",
  "2d_tengah": "2D Tengah",
  "2d_belakang": "2D Belakang",
  "3d": "3D",
  "4d": "4D",
};

const TARGET_PAIR_LABEL: Record<string, string> = {
  depan: "2D Depan",
  tengah: "2D Tengah",
  belakang: "2D Belakang",
};

const MODE_ORDER: Record<string, number> = {
  ai: 1,
  ai_parity: 2,
  ai_size: 3,
  bbfs: 4,
  mati: 5,
  jumlah: 6,
  shio: 7,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function digitListText(value: unknown) {
  if (!Array.isArray(value)) return "-";
  const items = value.map((item) => String(item).trim()).filter(Boolean);
  return items.length ? items.join("") : "-";
}

function formatResultValue(value: unknown) {
  if (Array.isArray(value)) return digitListText(value);
  if (typeof value === "string" || typeof value === "number") return String(value).trim() || "-";

  if (isRecord(value)) {
    if (Array.isArray(value.result)) return digitListText(value.result);
    if (Array.isArray(value.data)) return digitListText(value.data);

    const positions = [
      ["AS", "AS"],
      ["KOP", "COP"],
      ["KEPALA", "KPL"],
      ["EKOR", "EKR"],
    ] as const;

    const lines = positions
      .map(([key, label]) => {
        const raw = value[key];
        const text = isRecord(raw) && Array.isArray(raw.result) ? digitListText(raw.result) : digitListText(raw);
        return text !== "-" ? `${label} ${text}` : "";
      })
      .filter(Boolean);

    if (lines.length) return lines.join(" | ");
  }

  return "-";
}

function marketLabel(row: ShareRow) {
  const raw = String(row.marketName || row.marketId || "-").trim();
  const key = raw.toUpperCase();
  return MARKET_ALIAS[key] || raw.toUpperCase();
}

function titleTarget(option: ShareOption) {
  if (option.analysisScope && option.analysisScope !== "default") {
    return TARGET_LABEL[option.analysisScope] || option.analysisScope.toUpperCase();
  }

  if (["mati", "shio", "jumlah"].includes(option.mode)) return "";

  return TARGET_PAIR_LABEL[option.targetPair] || "";
}

function outputLabel(option: ShareOption) {
  if (option.mode === "ai_parity" || option.mode === "ai_size") return "";
  if (option.mode === "shio") return `${option.param} Shio`;
  if (option.mode === "bbfs" && option.param === 10) return "GGBK 8 Digit";
  return `${option.param} Digit`;
}

function shareTitle(option: ShareOption) {
  return [MODE_LABEL[option.mode] || option.mode.toUpperCase(), titleTarget(option), outputLabel(option)]
    .filter(Boolean)
    .join(" ");
}

function buildShareText(option: ShareOption | null, rows: ShareRow[]) {
  if (!option) return "";
  const title = shareTitle(option);
  const lines = rows.map((row) => `${marketLabel(row)} ${SEPARATOR} ${formatResultValue(row.result)}`);
  return [title, "", ...lines].join("\n");
}

function optionSort(a: ShareOption, b: ShareOption) {
  const modeDiff = (MODE_ORDER[a.mode] || 99) - (MODE_ORDER[b.mode] || 99);
  if (modeDiff !== 0) return modeDiff;

  const targetA = titleTarget(a);
  const targetB = titleTarget(b);
  if (targetA !== targetB) return targetA.localeCompare(targetB, "id");

  return a.param - b.param;
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      ...deviceAuthHeader(),
    },
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || "Gagal memuat data.");
  return json as T;
}

export default function SharePrediksiPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [options, setOptions] = useState<ShareOption[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [rows, setRows] = useState<ShareRow[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.key === selectedKey) || null,
    [options, selectedKey],
  );

  const shareText = useMemo(() => buildShareText(selectedOption, rows), [selectedOption, rows]);

  useEffect(() => {
    if (!token) return;

    let active = true;
    setLoadingOptions(true);
    setError("");

    fetchJson<ShareOption[]>("/api/share-predictions/options", token)
      .then((items) => {
        if (!active) return;
        const sorted = [...items].sort(optionSort);
        setOptions(sorted);
        setSelectedKey((current) => current || sorted[0]?.key || "");
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Gagal memuat pilihan share prediksi.");
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !selectedOption) return;

    const params = new URLSearchParams({
      mode: selectedOption.mode,
      param: String(selectedOption.param),
      targetPair: selectedOption.targetPair,
      analysisScope: selectedOption.analysisScope,
    });

    let active = true;
    setLoadingRows(true);
    setRows([]);
    setCopied(false);
    setError("");

    fetchJson<ShareResponse>(`/api/share-predictions?${params.toString()}`, token)
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
  }, [token, selectedOption]);

  async function handleCopy() {
    if (!shareText) return;
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function handleShare() {
    if (!shareText) return;
    if (navigator.share) {
      await navigator.share({ text: shareText });
      return;
    }
    await handleCopy();
  }

  return (
    <div className="animate-rise pb-8">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="pressable depth-3 mb-3 inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black uppercase tracking-wide text-text-muted hover:border-border hover:bg-white/[0.06]"
      >
        <ArrowLeft size={15} /> Beranda
      </button>

      <section className="depth-1 mb-4 rounded-3xl border p-4 text-center">
        <div className="depth-2 rounded-3xl border px-4 py-6">
          <div className="display text-2xl text-text">Share Prediksi</div>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-text-muted">
            Pilih filter prediksi aktif, lalu salin atau bagikan semua pasaran.
          </p>
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-center text-xs font-bold text-danger">
          {error}
        </div>
      )}

      <section className="depth-1 mb-4 rounded-3xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <span className="display text-xs text-text">Pilih Prediksi</span>
          {loadingOptions && <Loader2 size={15} className="animate-spin text-text-soft" />}
        </div>

        {!token ? (
          <div className="depth-2 rounded-2xl border p-4 text-center text-[11px] font-black uppercase tracking-wide text-text-muted">
            Memeriksa akses…
          </div>
        ) : loadingOptions ? (
          <div className="depth-2 rounded-2xl border p-4 text-center text-[11px] font-black uppercase tracking-wide text-text-muted">
            Memuat pilihan…
          </div>
        ) : options.length === 0 ? (
          <div className="depth-2 rounded-2xl border p-4 text-center text-[11px] font-black uppercase tracking-wide text-text-muted">
            Belum ada snapshot prediksi aktif
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {options.map((option, index) => {
              const active = option.key === selectedKey;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSelectedKey(option.key)}
                  className={
                    active
                      ? "pressable animate-soft-pop depth-accent accent-text rounded-3xl border px-4 py-4 text-left"
                      : "pressable animate-soft-pop depth-3 rounded-3xl border px-4 py-4 text-left text-text-muted hover:border-border hover:bg-white/[0.06]"
                  }
                  style={{ animationDelay: `${Math.min(index, 12) * 16}ms` }}
                >
                  <span className="display block text-[13px] leading-5">{shareTitle(option)}</span>
                  <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-wide text-text-soft">
                    {option.mode} · {option.targetPair} · {option.analysisScope}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="depth-1 rounded-3xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <span className="display text-xs text-text">Preview Share</span>
          {loadingRows && <Loader2 size={15} className="animate-spin text-text-soft" />}
        </div>

        <pre className="depth-2 min-h-[220px] whitespace-pre-wrap rounded-3xl border p-4 font-mono text-[12px] font-bold leading-6 text-text">
          {loadingRows ? "Memuat data share…" : shareText || "Pilih prediksi dulu."}
        </pre>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!shareText || loadingRows}
            className="pressable depth-3 flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black uppercase tracking-wide text-text-muted hover:border-border hover:bg-white/[0.06] disabled:opacity-45"
          >
            <ClipboardCopy size={16} /> {copied ? "Tersalin" : "Copy"}
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={!shareText || loadingRows}
            className="pressable depth-accent accent-text flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black uppercase tracking-wide disabled:opacity-45"
          >
            <Share2 size={16} /> Share
          </button>
        </div>
      </section>
    </div>
  );
}
