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

type RekapSection = { label: string; lines: string[] };

type ShareRow = {
  marketId: string | null;
  marketName: string | null;
  baseResult?: string | null;
  result?: unknown;
  updatedAt: string | null;
  order: number | null;
  sections?: RekapSection[];
};

type ShareResponse = { rows: ShareRow[]; nextCursor?: number | null };
type MarketOption = { id?: string | null; name?: string | null; order?: number | null; updated_at?: string | null };
type PickItem = { key: string; label: string };
type PickerKey = "jenis" | "target" | "output" | "";

const SEPARATOR = "⟢";
const REKAP_BADGE_MODE = "rekap_badge";
const BBFS7_TRIAL_MODE = "bbfs7_trial";
const REKAP_MAX_MARKETS = 5;

const REKAP_BADGE_OPTION: ShareOption = {
  key: "rekap_badge|0|belakang|all2d",
  mode: REKAP_BADGE_MODE,
  param: 0,
  targetPair: "belakang",
  analysisScope: "all2d",
  updatedAt: null,
};

const BBFS7_TRIAL_OPTIONS: ShareOption[] = [
  {
    key: "bbfs7_trial|0|depan|default",
    mode: BBFS7_TRIAL_MODE,
    param: 0,
    targetPair: "depan",
    analysisScope: "default",
    updatedAt: null,
  },
  {
    key: "bbfs7_trial|0|tengah|default",
    mode: BBFS7_TRIAL_MODE,
    param: 0,
    targetPair: "tengah",
    analysisScope: "default",
    updatedAt: null,
  },
  {
    key: "bbfs7_trial|0|belakang|default",
    mode: BBFS7_TRIAL_MODE,
    param: 0,
    targetPair: "belakang",
    analysisScope: "default",
    updatedAt: null,
  },
];

const MODE_LABEL: Record<string, string> = {
  rekap_badge: "Rekap Badge 2D",
  bbfs7_trial: "Uji Coba BBFS 7D",
  ai: "Angka Ikut",
  bbfs: "BBFS",
  mati: "Angka Mati",
  jumlah: "Jumlah Mati",
  shio: "Shio Mati",
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

const TARGET_PAIR_LABEL: Record<string, string> = {
  depan: "2D Depan",
  tengah: "2D Tengah",
  belakang: "2D Belakang",
};

const MODE_ORDER: Record<string, number> = {
  rekap_badge: 0,
  bbfs7_trial: 1,
  ai: 2,
  bbfs: 3,
  mati: 4,
  jumlah: 5,
  shio: 6,
};

const TARGET_ORDER: Record<string, number> = {
  "belakang|all2d": 0,
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

function isRekapBadge(option: ShareOption | null) {
  return option?.mode === REKAP_BADGE_MODE;
}

function isBbfs7Trial(option: ShareOption | null) {
  return option?.mode === BBFS7_TRIAL_MODE;
}

function isGanjilGenap(option: ShareOption) {
  return option.mode === "ai_parity" || (option.mode === "ai" && option.param === 7);
}

function isBesarKecil(option: ShareOption) {
  return option.mode === "ai_size" || (option.mode === "ai" && option.param === 8);
}

function displayMode(option: ShareOption) {
  return option.mode === "ai_parity" || option.mode === "ai_size" ? "ai" : option.mode;
}

function outputKey(option: ShareOption) {
  if (option.mode === REKAP_BADGE_MODE) return "all_badge";
  if (option.mode === BBFS7_TRIAL_MODE) return "bbfs7_trial";
  if (isGanjilGenap(option)) return "ganjil_genap";
  if (isBesarKecil(option)) return "besar_kecil";
  return `${option.mode}:${option.param}`;
}

function marketKey(row: ShareRow) {
  return String(row.marketId || row.marketName || "").trim().toLowerCase();
}

function titleCaseMarketName(value: string) {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .replace(/6d\b/gi, "6D");
}

function marketLabel(row: ShareRow) {
  const raw = String(row.marketName || row.marketId || "-").trim().replace(/\s+/g, " ");
  return raw === "-" ? raw : titleCaseMarketName(raw);
}

function targetKey(option: ShareOption) {
  return `${option.targetPair}|${option.analysisScope}`;
}

function targetLabel(option: ShareOption) {
  if (option.mode === REKAP_BADGE_MODE) return "Semua 2D";
  if (option.mode === BBFS7_TRIAL_MODE) return TARGET_PAIR_LABEL[option.targetPair] || "";
  if (option.mode === "mati") return "";
  if (option.analysisScope && option.analysisScope !== "default") return TARGET_LABEL[option.analysisScope] || option.analysisScope.toUpperCase();
  return TARGET_PAIR_LABEL[option.targetPair] || "";
}

function outputLabel(option: ShareOption) {
  if (option.mode === REKAP_BADGE_MODE) return "Semua Metode Badge";
  if (option.mode === BBFS7_TRIAL_MODE) return "7 Digit";
  if (isGanjilGenap(option)) return "Ganjil Genap";
  if (isBesarKecil(option)) return "Besar Kecil";
  if (option.mode === "shio") return `${option.param} Shio`;
  if (option.mode === "bbfs" && option.param === 10) return "GGBK 8 Digit";
  return `${option.param} Digit`;
}

function shareTitle(option: ShareOption) {
  if (option.mode === REKAP_BADGE_MODE) return "Rekap Badge 2D";
  if (option.mode === BBFS7_TRIAL_MODE) {
    const label = (TARGET_PAIR_LABEL[option.targetPair] || "2D Belakang").replace("2D ", "");
    return `Uji Coba BBFS 7D ${label}`;
  }
  const mode = displayMode(option);
  return [MODE_LABEL[mode] || mode.toUpperCase(), targetLabel(option), outputLabel(option)].filter(Boolean).join(" ");
}

function marketOptionRow(market: MarketOption): ShareRow {
  return {
    marketId: market.id || null,
    marketName: market.name || market.id || null,
    updatedAt: market.updated_at || null,
    order: market.order ?? null,
  };
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

function linesText(lines: string[]) {
  return lines.join("*");
}

function formatTimePart(date: Date, timeZone: string, suffix: string) {
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const weekday = parts.find((part) => part.type === "weekday")?.value || "";
  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = parts.find((part) => part.type === "minute")?.value || "00";
  const day = weekday ? weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase() : "";
  return `${day} ${hour}.${minute} ${suffix}`.trim();
}

function dataLineText(rows: ShareRow[]) {
  const timestamps = rows.map((row) => Date.parse(row.updatedAt || "")).filter((time) => Number.isFinite(time));
  if (!timestamps.length) return "";
  const latest = new Date(Math.max(...timestamps));
  const wib = formatTimePart(latest, "Asia/Jakarta", "WIB");
  const wita = formatTimePart(latest, "Asia/Makassar", "WITA");
  const witaTime = wita.replace(/^\S+\s+/, "");
  return `*Data ${wib} / ${witaTime}*`;
}

function buildRekapBadgeBlock(row: ShareRow) {
  const sections = (row.sections || []).filter((section) => section.lines?.length);
  if (!sections.length) return "";
  const body = sections.flatMap((section) => [`${section.label} (${section.lines.length} line)`, linesText(section.lines), ""]);
  return [`- ${marketLabel(row)}`, "", ...body].join("\n").trimEnd();
}

function buildRekapBadgeShareText(rows: ShareRow[]) {
  return rows.map(buildRekapBadgeBlock).filter(Boolean).join("\n\n");
}

function buildShareText(option: ShareOption | null, rows: ShareRow[]) {
  if (!option || rows.length === 0) return "";
  if (isRekapBadge(option)) return buildRekapBadgeShareText(rows);
  const title = shareTitle(option);
  const dataLine = dataLineText(rows);
  const lines = rows.map((row) => `${marketLabel(row)} ${SEPARATOR} ${rowResultText(option, row)}`);

  if (option.mode === "mati") {
    const header = MATI_POSITIONS.map(([, label]) => label).join(" | ");
    return [title, dataLine, header, "", ...lines].filter((line, index) => line || index === 3).join("\n");
  }

  return [title, dataLine, "", ...lines].filter((line, index) => line || index === 2).join("\n");
}

function buildPreviewText(option: ShareOption | null, rows: ShareRow[]) {
  if (!option || rows.length === 0) return "";
  if (isRekapBadge(option)) {
    const visibleRows = rows.slice(0, 2);
    const hiddenCount = Math.max(rows.length - visibleRows.length, 0);
    const moreLine = hiddenCount > 0 ? `\n\n...dan ${hiddenCount} pasaran lainnya` : "";
    return `${buildRekapBadgeShareText(visibleRows)}${moreLine}`;
  }

  const title = shareTitle(option);
  const dataLine = dataLineText(rows);
  const visibleRows = rows.slice(0, 5).map((row) => `${marketLabel(row)} ${SEPARATOR} ${rowResultText(option, row)}`);
  const hiddenCount = Math.max(rows.length - visibleRows.length, 0);
  const moreLine = hiddenCount > 0 ? `...dan ${hiddenCount} pasaran lainnya` : "";

  if (option.mode === "mati") {
    const header = MATI_POSITIONS.map(([, label]) => label).join(" | ");
    return [title, dataLine, header, "", ...visibleRows, moreLine].filter((line, index) => line || index === 3).join("\n");
  }

  return [title, dataLine, "", ...visibleRows, moreLine].filter((line, index) => line || index === 2).join("\n");
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
  const modeDiff = (MODE_ORDER[displayMode(a)] || 99) - (MODE_ORDER[displayMode(b)] || 99);
  if (modeDiff !== 0) return modeDiff;

  const targetDiff = (TARGET_ORDER[targetKey(a)] || 99) - (TARGET_ORDER[targetKey(b)] || 99);
  if (targetDiff !== 0) return targetDiff;

  const ggbkA = isGanjilGenap(a) ? 70 : isBesarKecil(a) ? 80 : a.param;
  const ggbkB = isGanjilGenap(b) ? 70 : isBesarKecil(b) ? 80 : b.param;
  return ggbkA - ggbkB;
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, ...deviceAuthHeader() },
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
  const { token, verifying } = useAuth();
  const [options, setOptions] = useState<ShareOption[]>([]);
  const [marketOptions, setMarketOptions] = useState<ShareRow[]>([]);
  const [selectedMode, setSelectedMode] = useState(REKAP_BADGE_MODE);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [selectedOutput, setSelectedOutput] = useState("");
  const [openPicker, setOpenPicker] = useState<PickerKey>("");
  const [rows, setRows] = useState<ShareRow[]>([]);
  const [selectedMarketKeys, setSelectedMarketKeys] = useState<Set<string>>(() => new Set());
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const sortedOptions = useMemo(
    () => [REKAP_BADGE_OPTION, ...BBFS7_TRIAL_OPTIONS, ...options].sort(optionSort),
    [options],
  );
  const modeOptions = useMemo(
    () =>
      uniqueBy(sortedOptions, displayMode).map((option) => {
        const mode = displayMode(option);
        return { key: mode, label: MODE_LABEL[mode] || mode.toUpperCase() };
      }),
    [sortedOptions],
  );
  const modeScopedOptions = useMemo(
    () => sortedOptions.filter((option) => displayMode(option) === selectedMode),
    [sortedOptions, selectedMode],
  );
  const targetOptions = useMemo(
    () => uniqueBy(modeScopedOptions, targetKey).map((option) => ({ key: targetKey(option), label: targetLabel(option) || "Semua Posisi" })),
    [modeScopedOptions],
  );
  const targetScopedOptions = useMemo(
    () => modeScopedOptions.filter((option) => targetKey(option) === selectedTarget),
    [modeScopedOptions, selectedTarget],
  );
  const outputOptions = useMemo(
    () => uniqueBy(targetScopedOptions, outputKey).map((option) => ({ key: outputKey(option), label: outputLabel(option) })),
    [targetScopedOptions],
  );
  const selectedOption = useMemo(
    () => targetScopedOptions.find((option) => outputKey(option) === selectedOutput) || null,
    [targetScopedOptions, selectedOutput],
  );

  const rekapMode = isRekapBadge(selectedOption);
  const bbfs7Mode = isBbfs7Trial(selectedOption);
  const generateMode = rekapMode || bbfs7Mode;
  const pickerRows = generateMode ? marketOptions : rows;
  const selectedRows = useMemo(() => rows.filter((row) => selectedMarketKeys.has(marketKey(row))), [rows, selectedMarketKeys]);
  const shareText = useMemo(() => buildShareText(selectedOption, selectedRows), [selectedOption, selectedRows]);
  const previewText = useMemo(() => buildPreviewText(selectedOption, selectedRows), [selectedOption, selectedRows]);
  const selectedCount = selectedMarketKeys.size;
  const selectionLimit = rekapMode ? REKAP_MAX_MARKETS : pickerRows.length;

  useEffect(() => {
    if (!verifying && !token) router.replace("/kode-login");
  }, [router, token, verifying]);

  useEffect(() => {
    if (verifying || !token) return;
    let active = true;
    setLoadingOptions(true);
    setError("");

    Promise.all([fetchJson<ShareOption[]>("/api/share-predictions/options", token), fetchJson<MarketOption[]>("/api/markets", token)])
      .then(([items, markets]) => {
        if (!active) return;
        setOptions([...items].sort(optionSort));
        setMarketOptions(markets.map(marketOptionRow).filter((row) => row.marketId));
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
  }, [token, verifying]);

  useEffect(() => {
    if (modeOptions.length && !modeOptions.some((option) => option.key === selectedMode)) setSelectedMode(modeOptions[0].key);
  }, [modeOptions, selectedMode]);

  useEffect(() => {
    if (!targetOptions.length) {
      setSelectedTarget("");
      return;
    }
    if (!targetOptions.some((option) => option.key === selectedTarget)) setSelectedTarget(targetOptions[0].key);
  }, [targetOptions, selectedTarget]);

  useEffect(() => {
    if (!outputOptions.length) {
      setSelectedOutput("");
      return;
    }
    if (!outputOptions.some((option) => option.key === selectedOutput)) setSelectedOutput(outputOptions[0].key);
  }, [outputOptions, selectedOutput]);

  useEffect(() => {
    if (verifying || !token || !selectedOption) return;
    let active = true;
    setLoadingRows(false);
    setRows([]);
    setSelectedMarketKeys(new Set());
    setCopied(false);
    setError("");

    if (generateMode) {
      return () => {
        active = false;
      };
    }

    setLoadingRows(true);
    const params = new URLSearchParams({
      mode: selectedOption.mode,
      param: String(selectedOption.param),
      targetPair: selectedOption.targetPair,
      analysisScope: selectedOption.analysisScope,
    });

    fetchJson<ShareResponse>(`/api/share-predictions?${params.toString()}`, token)
      .then((data) => {
        if (!active) return;
        const nextRows = data.rows || [];
        setRows(nextRows);
        setSelectedMarketKeys(new Set(nextRows.map(marketKey).filter(Boolean)));
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
  }, [token, verifying, selectedOption, generateMode]);

  function selectedMarketIds() {
    return marketOptions.filter((row) => selectedMarketKeys.has(marketKey(row))).map((row) => String(row.marketId)).filter(Boolean);
  }

  async function handleGenerateRekap() {
    if (!token || !selectedOption || !isRekapBadge(selectedOption)) return;
    const marketIds = selectedMarketIds();

    if (!marketIds.length) return setError("Pilih minimal satu pasaran.");
    if (marketIds.length > REKAP_MAX_MARKETS) return setError(`Maksimal ${REKAP_MAX_MARKETS} pasaran sekali generate.`);

    setLoadingRows(true);
    setRows([]);
    setCopied(false);
    setError("");

    try {
      const params = new URLSearchParams({ limit: String(REKAP_MAX_MARKETS), marketIds: marketIds.join(",") });
      const data = await fetchJson<ShareResponse>(`/api/share-predictions/rekap-badge?${params.toString()}`, token);
      setRows(data.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal generate rekap badge.");
    } finally {
      setLoadingRows(false);
    }
  }

  async function handleGenerateBbfs7() {
    if (!token || !selectedOption || !isBbfs7Trial(selectedOption)) return;
    const marketIds = selectedMarketIds();

    if (!marketIds.length) return setError("Pilih minimal satu pasaran.");

    setLoadingRows(true);
    setRows([]);
    setCopied(false);
    setError("");

    try {
      const params = new URLSearchParams({
        targetPair: selectedOption.targetPair,
        marketIds: marketIds.join(","),
      });
      const data = await fetchJson<ShareResponse>(`/api/share-predictions/bbfs7-trial?${params.toString()}`, token);
      setRows(data.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal generate BBFS 7D.");
    } finally {
      setLoadingRows(false);
    }
  }

  function toggleMarket(row: ShareRow) {
    const key = marketKey(row);
    if (!key) return;
    setRows((current) => (generateMode ? [] : current));
    setCopied(false);
    setSelectedMarketKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (rekapMode && next.size >= REKAP_MAX_MARKETS) {
          setError(`Maksimal ${REKAP_MAX_MARKETS} pasaran sekali generate.`);
          return next;
        }
        next.add(key);
      }
      return next;
    });
  }

  function selectAllMarkets() {
    const source = rekapMode ? pickerRows.slice(0, REKAP_MAX_MARKETS) : pickerRows;
    setRows((current) => (generateMode ? [] : current));
    setSelectedMarketKeys(new Set(source.map(marketKey).filter(Boolean)));
  }

  function clearMarkets() {
    setRows((current) => (generateMode ? [] : current));
    setSelectedMarketKeys(new Set());
  }

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

  if (verifying || !token) {
    return (
      <div className="animate-rise pb-8">
        <div className="depth-1 rounded-3xl border p-4 text-center">
          <div className="depth-2 rounded-3xl border px-4 py-10">
            <Loader2 className="mx-auto mb-3 animate-spin text-text-soft" size={22} />
            <p className="text-xs font-black uppercase tracking-wide text-text-muted">Memeriksa akses…</p>
          </div>
        </div>
      </div>
    );
  }

  const previewFallback = generateMode && selectedCount
    ? "Klik Generate untuk membuat prediksi dari pasaran yang dicentang."
    : rows.length
      ? "Belum ada pasaran dipilih."
      : "Pilih prediksi dulu.";

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
          <p className="mt-2 text-xs font-semibold leading-relaxed text-text-muted">Pilih filter, tandai pasaran, lalu salin atau bagikan.</p>
        </div>
      </section>

      <div className="depth-2 mb-4 rounded-2xl border border-primary/25 bg-primary/10 p-3 text-[11px] font-bold leading-relaxed text-text-muted">
        <span className="accent-text font-black">Catatan update:</span> Rekap Badge 2D maksimal {REKAP_MAX_MARKETS} centang. Uji Coba BBFS 7D bisa pilih semua pasaran.
      </div>

      {error && <div className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-center text-xs font-bold text-danger">{error}</div>}

      <section className="depth-1 mb-4 rounded-3xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <span className="display text-xs text-text">Filter Prediksi</span>
          {loadingOptions && <Loader2 size={15} className="animate-spin text-text-soft" />}
        </div>
        {loadingOptions ? (
          <div className="depth-2 rounded-2xl border p-4 text-center text-[11px] font-black uppercase tracking-wide text-text-muted">Memuat pilihan…</div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <PickerField id="jenis" label="Jenis" value={selectedMode} options={modeOptions} openPicker={openPicker} onOpen={setOpenPicker} onChange={setSelectedMode} />
            <PickerField id="target" label="Target" value={selectedTarget} options={targetOptions} openPicker={openPicker} onOpen={setOpenPicker} onChange={setSelectedTarget} />
            <PickerField id="output" label="Output" value={selectedOutput} options={outputOptions} openPicker={openPicker} onOpen={setOpenPicker} onChange={setSelectedOutput} />
          </div>
        )}
      </section>

      <section className="depth-1 mb-4 rounded-3xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <span className="display text-xs text-text">Pilih Pasaran</span>
          <span className="text-[10px] font-black uppercase tracking-wide text-text-soft">{selectedCount}/{selectionLimit}</span>
        </div>
        {loadingOptions || (loadingRows && !generateMode) ? (
          <div className="depth-2 rounded-2xl border p-4 text-center text-[11px] font-black uppercase tracking-wide text-text-muted">Memuat pasaran…</div>
        ) : pickerRows.length === 0 ? (
          <div className="depth-2 rounded-2xl border p-4 text-center text-[11px] font-black uppercase tracking-wide text-text-muted">Belum ada pasaran</div>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={selectAllMarkets}
                className="pressable depth-3 rounded-2xl border px-3 py-2 text-[11px] font-black uppercase tracking-wide text-text-muted hover:border-border hover:bg-white/[0.06]"
              >
                {rekapMode ? "Pilih 5 Pertama" : "Pilih Semua"}
              </button>
              <button
                type="button"
                onClick={clearMarkets}
                className="pressable depth-3 rounded-2xl border px-3 py-2 text-[11px] font-black uppercase tracking-wide text-text-muted hover:border-border hover:bg-white/[0.06]"
              >
                Kosongkan
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {pickerRows.map((row) => {
                const key = marketKey(row);
                const active = selectedMarketKeys.has(key);
                return (
                  <button
                    key={key || marketLabel(row)}
                    type="button"
                    onClick={() => toggleMarket(row)}
                    className={
                      active
                        ? "pressable animate-soft-pop accent-bg-soft accent-border relative flex min-h-[58px] items-center justify-center rounded-2xl border px-2 py-2 text-center"
                        : "pressable animate-soft-pop depth-1 relative flex min-h-[58px] items-center justify-center rounded-2xl border px-2 py-2 text-center hover:border-border hover:bg-surface-2"
                    }
                  >
                    {active && (
                      <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                        <Check size={11} strokeWidth={3.2} />
                      </span>
                    )}
                    <span className="line-clamp-2 text-[9px] font-black leading-3 tracking-wide text-text">{marketLabel(row)}</span>
                  </button>
                );
              })}
            </div>
            {generateMode && (
              <button
                type="button"
                onClick={rekapMode ? handleGenerateRekap : handleGenerateBbfs7}
                disabled={loadingRows || selectedCount === 0}
                className="pressable depth-accent accent-text mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black uppercase tracking-wide disabled:opacity-45"
              >
                {loadingRows && <Loader2 size={15} className="animate-spin" />}
                Generate
              </button>
            )}
          </>
        )}
      </section>

      <section className="depth-1 rounded-3xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <span className="display text-xs text-text">Preview Singkat</span>
          {loadingRows && <Loader2 size={15} className="animate-spin text-text-soft" />}
        </div>
        <pre className="depth-2 min-h-[150px] overflow-hidden whitespace-pre-wrap break-all rounded-3xl border p-4 font-mono text-[12px] font-bold leading-6 text-text">
          {loadingRows ? "Memuat preview…" : previewText || previewFallback}
        </pre>
        <p className="mt-2 px-1 text-[10px] font-bold uppercase tracking-wide text-text-soft">Copy dan Share hanya mengirim pasaran yang dicentang dan sudah digenerate.</p>
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
