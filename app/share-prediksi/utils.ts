import { MATI_POSITIONS, MODE_LABEL, MODE_ORDER, REKAP_BADGE_MODE, SEPARATOR, TARGET_LABEL, TARGET_ORDER, TARGET_PAIR_LABEL } from "./constants";
import type { MarketOption, ShareOption, ShareRow } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function listText(value: unknown, joiner: "" | "." = "") {
  if (!Array.isArray(value)) return "-";
  const items = value.map((item) => String(item).trim()).filter(Boolean);
  return items.length ? items.join(joiner) : "-";
}

export function isRekapBadge(option: ShareOption | null) {
  return option?.mode === REKAP_BADGE_MODE;
}

function isGanjilGenap(option: ShareOption) {
  return option.mode === "ai_parity" || (option.mode === "ai" && option.param === 7);
}

function isBesarKecil(option: ShareOption) {
  return option.mode === "ai_size" || (option.mode === "ai" && option.param === 8);
}

export function displayMode(option: ShareOption) {
  return option.mode === "ai_parity" || option.mode === "ai_size" ? "ai" : option.mode;
}

export function outputKey(option: ShareOption) {
  if (isRekapBadge(option)) return "all_badge";
  if (isGanjilGenap(option)) return "ganjil_genap";
  if (isBesarKecil(option)) return "besar_kecil";
  return `${option.mode}:${option.param}`;
}

export function marketKey(row: ShareRow) {
  return String(row.marketId || row.marketName || "").trim().toLowerCase();
}

export function marketLabel(row: ShareRow) {
  const raw = String(row.marketName || row.marketId || "-").trim().replace(/\s+/g, " ");
  if (raw === "-") return raw;
  return raw.toLowerCase().replace(/\b([a-z])/g, (letter) => letter.toUpperCase()).replace(/6d\b/gi, "6D");
}

export function targetKey(option: ShareOption) {
  return `${option.targetPair}|${option.analysisScope}`;
}

export function targetLabel(option: ShareOption) {
  if (isRekapBadge(option)) return "Semua 2D";
  if (option.mode === "mati") return "";
  if (option.analysisScope && option.analysisScope !== "default") return TARGET_LABEL[option.analysisScope] || option.analysisScope.toUpperCase();
  return TARGET_PAIR_LABEL[option.targetPair] || "";
}

export function outputLabel(option: ShareOption) {
  if (isRekapBadge(option)) return "Semua Metode Badge";
  if (isGanjilGenap(option)) return "Ganjil Genap";
  if (isBesarKecil(option)) return "Besar Kecil";
  if (option.mode === "shio") return `${option.param} Shio`;
  if (option.mode === "bbfs" && option.param === 10) return "GGBK 8 Digit";
  return `${option.param} Digit`;
}

export function marketOptionRow(market: MarketOption): ShareRow {
  return {
    marketId: market.id || null,
    marketName: market.name || market.id || null,
    updatedAt: market.updated_at || null,
    order: market.order ?? null,
  };
}

function matiColumnText(value: unknown, key: string) {
  if (!isRecord(value)) return "-";
  const raw = value[key];
  if (isRecord(raw) && Array.isArray(raw.result)) return listText(raw.result, ".");
  return listText(raw, ".");
}

function rowResultText(option: ShareOption, row: ShareRow) {
  if (option.mode === "mati") return MATI_POSITIONS.map(([key]) => matiColumnText(row.result, key)).join(" | ");
  const joiner = option.mode === "shio" || option.mode === "jumlah" ? "." : "";
  const value = row.result;
  if (Array.isArray(value)) return listText(value, joiner);
  if (typeof value === "string" || typeof value === "number") return String(value).trim() || "-";
  if (!isRecord(value)) return "-";
  if (Array.isArray(value.result)) return listText(value.result, joiner);
  if (Array.isArray(value.data)) return listText(value.data, joiner);
  return "-";
}

function buildRekapBadgeBlock(row: ShareRow) {
  const sections = (row.sections || []).filter((section) => section.lines?.length);
  if (!sections.length) return "";
  const body = sections.flatMap((section) => [`${section.label} (${section.lines.length} line)`, section.lines.join("*"), ""]);
  return [`- ${marketLabel(row)}`, "", ...body].join("\n").trimEnd();
}

export function buildShareText(option: ShareOption | null, rows: ShareRow[], separator = SEPARATOR) {
  if (!option || rows.length === 0) return "";
  if (isRekapBadge(option)) return rows.map(buildRekapBadgeBlock).filter(Boolean).join("\n\n");
  return rows.map((row) => `${marketLabel(row)} ${separator} ${rowResultText(option, row)}`).join("\n");
}

export function buildPreviewText(option: ShareOption | null, rows: ShareRow[], separator = SEPARATOR) {
  if (!option || rows.length === 0) return "";
  if (isRekapBadge(option)) {
    const visibleRows = rows.slice(0, 2);
    const hiddenCount = Math.max(rows.length - visibleRows.length, 0);
    return `${visibleRows.map(buildRekapBadgeBlock).filter(Boolean).join("\n\n")}${hiddenCount > 0 ? `\n\n...dan ${hiddenCount} pasaran lainnya` : ""}`;
  }
  const visibleRows = rows.slice(0, 5);
  const hiddenCount = Math.max(rows.length - visibleRows.length, 0);
  return `${buildShareText(option, visibleRows, separator)}${hiddenCount > 0 ? `\n...dan ${hiddenCount} pasaran lainnya` : ""}`;
}

export function uniqueBy<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function optionSort(a: ShareOption, b: ShareOption) {
  const modeDiff = (MODE_ORDER[displayMode(a)] || 99) - (MODE_ORDER[displayMode(b)] || 99);
  if (modeDiff !== 0) return modeDiff;
  const targetDiff = (TARGET_ORDER[targetKey(a)] || 99) - (TARGET_ORDER[targetKey(b)] || 99);
  if (targetDiff !== 0) return targetDiff;
  const aParam = isGanjilGenap(a) ? 70 : isBesarKecil(a) ? 80 : a.param;
  const bParam = isGanjilGenap(b) ? 70 : isBesarKecil(b) ? 80 : b.param;
  return aParam - bParam;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || "Gagal memuat data.");
  return json as T;
}
