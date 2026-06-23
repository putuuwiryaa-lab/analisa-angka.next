"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, ClipboardCopy, Loader2, Share2 } from "lucide-react";
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

type PickItem = {
  key: string;
  label: string;
};

type PickerKey = "jenis" | "target" | "output" | "";

const SEPARATOR = "◆";

const MARKET_ALIAS: Record<string, string> = {
  SINGAPORE6D: "SGP",
  SINGAPORE: "SGP",
  HONGKONG: "HK",
  HONGKONGLOTTO: "HK",
};

const MODE_LABEL: Record<string, string> = {
  ai: "Angka Ikut",
  ai_parity: "Ganjil Genap",
  ai_size: "Besar Kecil",
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

const TARGET_ORDER: Record<string, number> = {
  "depan|default": 1,
  "tengah|default": 2,
  "belakang|default": 3,
  "belakang|2d_depan": 4,
  "belakang|2d_tengah": 5,
  "belakang|2d_belakang": 6,
  "belakang|3d": 7,
  "belakang|4d": 8,
};

const MATI_POSITIONS = [
  ["AS", "AS"],
  ["KOP", "COP"],
  ["KEPALA", "KPL"],
  ["EKOR", "EKR"],
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function listText(value: unknown, joiner: "" | "." = "") {
  if (!Array.isArray(value)) return "-";
  const items = value.map((item) => String(item).trim()).filter(Boolean);
  return items.length ? items.join(joiner) : "-";
}

function marketLabel(row: ShareRow) {
  const raw = String(row.marketName || row.marketId || "-").trim();
  return MARKET_ALIAS[raw.toUpperCase()] || raw.toUpperCase();
}

function targetKey(option: ShareOption) {
  return `${option.targetPair}|${option.analysisScope}`;
}

function targetLabel(option: ShareOption) {
  if (option.mode === "mati") return "";
  if (option.analysisScope && option.analysisScope !== "default") {
    return TARGET_LABEL[option.analysisScope] || option.analysisScope.toUpperCase();
  }
  return TARGET_PAIR_LABEL[option.targetPair] || "";
}

function outputLabel(option: ShareOption) {
  if (option.mode === "ai_parity" || option.mode === "ai_size") return "";
  if (option.mode === "shio") return `${option.param} Shio`;
  if (option.mode === "bbfs" && option.param === 10) return "GGBK 8 Digit";
  return `${option.param} Digit`;
}

function shareTitle(option: ShareOption) {
  return [MODE_LABEL[option.mode] || option.mode.toUpperCase(), targetLabel(option), outputLabel(option)]
    .filter(Boolean)
    .join(" ");
}

function simpleResultText(value: unknown, mode: string) {
  const joiner = mode === "shio" || mode === "jumlah" ? "." : "";

  if (Array.isArray(value)) return listText(value, joiner);
  if (typeof value === "string" || typeof value === "number") return String(value).trim() || "-";
  if (!isRecord(value)) return "-";

  if (Array.isArray(value.result)) return listText(value.result, joiner);
  if (Array.isArray(value.data)) return listText(value.data, joiner);

  return "-";
}

function matiColumnText(value: unknown, key: string) {
  if (!isRecord(value)) return "-";
  const raw = value[key];
  if (isRecord(raw) && Array.isArray(raw.result)) return listText(raw.result, ".");
  return listText(raw, ".");
}

function matiResultText(value: unknown) {
  return MATI_POSITIONS.map(([key]) => matiColumnText(value, key)).join(" | ");
}

function rowResultText(option: ShareOption, row: ShareRow) {
  if (option.mode === "mati") return matiResultText(row.result);
  return simpleResultText(row.result, option.mode);
}

function buildShareText(option: ShareOption | null, rows: ShareRow[]) {
  if (!option) return "";

  const title = shareTitle(option);
  const lines = rows.map((row) => `${marketLabel(row)} ${SEPARATOR} ${rowResultText(option, row)}`);

  if (option.mode === "mati") {
    const header = MATI_POSITIONS.map(([, label]) => label).join(" | ");
    return [title, header, "", ...lines].join("\n");
  }

  return [title, "", ...lines].join("\n");
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  const output: T[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}

function optionSort(a: ShareOption, b: ShareOption) {
  const modeDiff = (MODE_ORDER[a.mode] || 99) - (MODE_ORDER[b.mode] || 99);
  if (modeDiff !== 0) return modeDiff;

  const targetDiff = (TARGET_ORDER[targetKey(a)] || 99) - (TARGET_ORDER[targetKey(b)] || 99);
  if (targetDiff !== 0) return targetDiff;

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

function PickerField({
  id,
  label,
  value,
  options,
  openPicker,
  onOpen,
  onChange,
}: {
  id: PickerKey;
  label: string;
  value: string;
  options: PickItem[];
  openPicker: PickerKey;
  onOpen: (value: PickerKey) => void;
  onChange: (value: string) => void;
}) {
  const isOpen = openPicker === id;
  const selected = options.find((option) => option.key === value);

  return (
    <div className="relative">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-text-soft">{label}</span>
      <button
        type="button"
        disabled={options.length === 0}
        onClick={() => onOpen(isOpen ? "" : id)}
        className="pressable depth-3 flex min-h-14 w-full items-center justify-between gap-3 rounded-3xl border px-4 text-left text-sm font-black text-text hover:border-border hover:bg-white/[0.06] disabled:opacity-50"
      >
        <span className="truncate">{selected?.label || "Tidak tersedia"}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-text-soft transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
          strokeWidth={2.6}
        />
      </button>

      {isOpen && options.length > 0 && (
        <div className="animate-soft-pop depth-2 mt-2 overflow-hidden rounded-3xl border p-2">
          {options.map((option) => {
            const active = option.key === value;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  onChange(option.key);
                  onOpen("");
                }}
                className={
                  active
                    ? "pressable accent-bg-soft accent-text flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-3 text-left text-sm font-black"
                    : "pressable flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-3 text-left text-sm font-bold text-text-muted hover:bg-white/[0.06] hover:text-text"
                }
              >
                <span>{option.label}</span>
                {active && <Check size={17} strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SharePrediksiPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [options, setOptions] = useState<ShareOption[]>([]);
  const [selectedMode, setSelectedMode] = useState("");
  const [selectedTarget, setSelectedTarget] = useState("");
  const [selectedOutput, setSelectedOutput] = useState("");
  const [openPicker, setOpenPicker] = useState<PickerKey>("");
  const [rows, setRows] = useState<ShareRow[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const sortedOptions = useMemo(() => [...options].sort(optionSort), [options]);

  const modeOptions = useMemo(
    () =>
      uniqueBy(sortedOptions, (option) => option.mode).map((option) => ({
        key: option.mode,
        label: MODE_LABEL[option.mode] || option.mode.toUpperCase(),
      })),
    [sortedOptions],
  );

  const modeScopedOptions = useMemo(
    () => sortedOptions.filter((option) => option.mode === selectedMode),
    [sortedOptions, selectedMode],
  );

  const targetOptions = useMemo(
    () =>
      uniqueBy(modeScopedOptions, targetKey).map((option) => ({
        key: targetKey(option),
        label: targetLabel(option) || "Semua Posisi",
      })),
    [modeScopedOptions],
  );

  const targetScopedOptions = useMemo(
    () => modeScopedOptions.filter((option) => targetKey(option) === selectedTarget),
    [modeScopedOptions, selectedTarget],
  );

  const outputOptions = useMemo(
    () =>
      uniqueBy(targetScopedOptions, (option) => String(option.param)).map((option) => ({
        key: String(option.param),
        label: outputLabel(option) || "Output",
      })),
    [targetScopedOptions],
  );

  const selectedOption = useMemo(
    () => targetScopedOptions.find((option) => String(option.param) === selectedOutput) || null,
    [targetScopedOptions, selectedOutput],
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
        setSelectedMode((current) => current || sorted[0]?.mode || "");
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
    if (!modeOptions.length) return;
    if (!modeOptions.some((option) => option.key === selectedMode)) {
      setSelectedMode(modeOptions[0].key);
    }
  }, [modeOptions, selectedMode]);

  useEffect(() => {
    if (!targetOptions.length) {
      setSelectedTarget("");
      return;
    }
    if (!targetOptions.some((option) => option.key === selectedTarget)) {
      setSelectedTarget(targetOptions[0].key);
    }
  }, [targetOptions, selectedTarget]);

  useEffect(() => {
    if (!outputOptions.length) {
      setSelectedOutput("");
      return;
    }
    if (!outputOptions.some((option) => option.key === selectedOutput)) {
      setSelectedOutput(outputOptions[0].key);
    }
  }, [outputOptions, selectedOutput]);

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
          <span className="display text-xs text-text">Filter Prediksi</span>
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
          <div className="grid grid-cols-1 gap-3">
            <PickerField id="jenis" label="Jenis" value={selectedMode} options={modeOptions} openPicker={openPicker} onOpen={setOpenPicker} onChange={setSelectedMode} />
            <PickerField id="target" label="Target" value={selectedTarget} options={targetOptions} openPicker={openPicker} onOpen={setOpenPicker} onChange={setSelectedTarget} />
            <PickerField id="output" label="Output" value={selectedOutput} options={outputOptions} openPicker={openPicker} onOpen={setOpenPicker} onChange={setSelectedOutput} />
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
