import "server-only";

import { buildCustomDigitLines, customFocusPositions, type PositionKey, type TargetPair } from "@/lib/analysis/customDigit";
import { createAdminClient } from "@/lib/server/supabase-admin";

export type ShareAngkaJadiCount = 1 | 2 | 3;
export type ShareAngkaJadiAiDigit = 2 | 4 | 6;
export type ShareAngkaJadiBbfsDigit = 7 | 8 | 9 | 10;

export type ShareAngkaJadiConfig = {
  aiDigit: ShareAngkaJadiAiDigit | null;
  parity: boolean;
  size: boolean;
  bbfsDigit: ShareAngkaJadiBbfsDigit | null;
  offPositions: Partial<Record<PositionKey, ShareAngkaJadiCount>>;
  offJumlah: ShareAngkaJadiCount | null;
  offShio: ShareAngkaJadiCount | null;
};

export type ShareAngkaJadiRow = {
  marketId: string;
  marketName: string;
  baseResult: string;
  order: number | null;
  lineCount: number;
  lines: string[];
};

export type ShareAngkaJadiFailure = {
  marketId: string;
  marketName: string;
  reason: string;
};

type SnapshotRow = {
  market_id: string | null;
  market_name: string | null;
  base_result: string | null;
  mode: string | null;
  param: number | null;
  target_pair: string | null;
  analysis_scope: string | null;
  result: unknown;
  updated_at: string | null;
};

type MarketRow = {
  id: string | null;
  name: string | null;
  order: number | null;
};

type SnapshotIdentity = {
  mode: string;
  param: number;
  targetPair: string;
  analysisScope: string;
};

const MAX_MARKETS = 100;
const MAX_SNAPSHOT_ROWS = 10000;
const VALID_FOCUS = new Set<TargetPair>(["depan", "tengah", "belakang"]);

function normalizedKey(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value))));
}

function unwrapResult(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if ("result" in record) return unwrapResult(record.result);
  if ("data" in record) return unwrapResult(record.data);
  return value;
}

function numberList(value: unknown): number[] {
  const raw = unwrapResult(value);
  if (Array.isArray(raw)) return uniqueNumbers(raw.flatMap(numberList));
  if (typeof raw === "number") return Number.isFinite(raw) ? [raw] : [];
  if (typeof raw === "string") {
    return uniqueNumbers((raw.match(/-?\d+/g) || []).map(Number));
  }
  return [];
}

function digitList(value: unknown): number[] {
  const raw = unwrapResult(value);
  if (typeof raw === "string") {
    return uniqueNumbers((raw.match(/\d/g) || []).map(Number)).filter((digit) => digit >= 0 && digit <= 9);
  }
  return numberList(raw).filter((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9);
}

function textValue(value: unknown) {
  const raw = unwrapResult(value);
  if (Array.isArray(raw)) return textValue(raw[0]);
  return String(raw ?? "").trim().toUpperCase();
}

function matiDigits(value: unknown, position: PositionKey) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  const key = position.toUpperCase();
  return digitList(record[key] ?? record[position]);
}

function snapshotKey(identity: SnapshotIdentity) {
  return `${identity.mode}|${identity.param}|${identity.targetPair}|${identity.analysisScope}`;
}

function rowSnapshotKey(row: SnapshotRow) {
  return snapshotKey({
    mode: String(row.mode || ""),
    param: Number(row.param || 0),
    targetPair: String(row.target_pair || "belakang"),
    analysisScope: String(row.analysis_scope || "default"),
  });
}

function isCount(value: number): value is ShareAngkaJadiCount {
  return value === 1 || value === 2 || value === 3;
}

function isAiDigit(value: number): value is ShareAngkaJadiAiDigit {
  return value === 2 || value === 4 || value === 6;
}

function isBbfsDigit(value: number): value is ShareAngkaJadiBbfsDigit {
  return value === 7 || value === 8 || value === 9 || value === 10;
}

export function sanitizeShareAngkaJadiFocus(value: unknown): TargetPair {
  const focus = String(value || "belakang") as TargetPair;
  return VALID_FOCUS.has(focus) ? focus : "belakang";
}

export function sanitizeShareAngkaJadiConfig(value: unknown, focus: TargetPair): ShareAngkaJadiConfig {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  const aiDigitValue = Number(source.aiDigit || 0);
  const bbfsDigitValue = Number(source.bbfsDigit || 0);
  const offJumlahValue = Number(source.offJumlah || 0);
  const offShioValue = Number(source.offShio || 0);
  const rawPositions = source.offPositions && typeof source.offPositions === "object" && !Array.isArray(source.offPositions)
    ? source.offPositions as Record<string, unknown>
    : {};

  const offPositions: Partial<Record<PositionKey, ShareAngkaJadiCount>> = {};
  for (const position of customFocusPositions(focus)) {
    const count = Number(rawPositions[position] || 0);
    if (isCount(count)) offPositions[position] = count;
  }

  return {
    aiDigit: isAiDigit(aiDigitValue) ? aiDigitValue : null,
    parity: source.parity === true,
    size: source.size === true,
    bbfsDigit: isBbfsDigit(bbfsDigitValue) ? bbfsDigitValue : null,
    offPositions,
    offJumlah: isCount(offJumlahValue) ? offJumlahValue : null,
    offShio: isCount(offShioValue) ? offShioValue : null,
  };
}

export function sanitizeShareAngkaJadiMarketIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const item of value) {
    const id = String(item || "").trim();
    const key = normalizedKey(id);
    if (!id || seen.has(key)) continue;
    seen.add(key);
    ids.push(id);
    if (ids.length >= MAX_MARKETS) break;
  }

  return ids;
}

export function shareAngkaJadiMethodCount(config: ShareAngkaJadiConfig) {
  return Number(Boolean(config.aiDigit))
    + Number(config.parity)
    + Number(config.size)
    + Number(Boolean(config.bbfsDigit))
    + Object.keys(config.offPositions).length
    + Number(Boolean(config.offJumlah))
    + Number(Boolean(config.offShio));
}

function descriptor(mode: string, param: number, targetPair: string, analysisScope: string): SnapshotIdentity {
  return { mode, param, targetPair, analysisScope };
}

function requiredModes(config: ShareAngkaJadiConfig) {
  const modes = new Set<string>();
  if (config.aiDigit) modes.add("ai");
  if (config.parity) {
    modes.add("ai_parity");
    modes.add("ai");
  }
  if (config.size) {
    modes.add("ai_size");
    modes.add("ai");
  }
  if (config.bbfsDigit) modes.add("bbfs");
  if (Object.keys(config.offPositions).length) modes.add("mati");
  if (config.offJumlah) modes.add("jumlah");
  if (config.offShio) modes.add("shio");
  return Array.from(modes);
}

function marketDisplayName(marketId: string, markets: Map<string, MarketRow>, snapshots: SnapshotRow[]) {
  const market = markets.get(normalizedKey(marketId));
  const snapshotName = snapshots.find((row) => normalizedKey(row.market_id) === normalizedKey(marketId))?.market_name;
  return String(market?.name || snapshotName || marketId);
}

function buildSnapshotIndex(rows: SnapshotRow[]) {
  const index = new Map<string, Map<string, SnapshotRow>>();
  for (const row of rows) {
    const marketId = normalizedKey(row.market_id);
    if (!marketId) continue;
    if (!index.has(marketId)) index.set(marketId, new Map());
    const byIdentity = index.get(marketId)!;
    const identity = rowSnapshotKey(row);
    if (!byIdentity.has(identity)) byIdentity.set(identity, row);
  }
  return index;
}

function pickSnapshot(
  index: Map<string, Map<string, SnapshotRow>>,
  marketId: string,
  alternatives: SnapshotIdentity[],
) {
  const rows = index.get(normalizedKey(marketId));
  if (!rows) return null;
  for (const identity of alternatives) {
    const row = rows.get(snapshotKey(identity));
    if (row) return row;
  }
  return null;
}

function requireSnapshot(
  index: Map<string, Map<string, SnapshotRow>>,
  marketId: string,
  alternatives: SnapshotIdentity[],
  label: string,
  used: Set<SnapshotRow>,
) {
  const row = pickSnapshot(index, marketId, alternatives);
  if (!row) throw new Error(`${label} belum tersedia.`);
  used.add(row);
  return row;
}

function ensureSynchronizedBaseResult(rows: Set<SnapshotRow>) {
  const values = Array.from(rows).map((row) => String(row.base_result || "").trim());
  if (values.some((value) => !value)) throw new Error("Base result metode belum lengkap.");
  const unique = new Set(values);
  if (unique.size !== 1) throw new Error("Data metode belum sinkron pada result terbaru.");
  return values[0];
}

function buildMarketLines(
  marketId: string,
  focus: TargetPair,
  config: ShareAngkaJadiConfig,
  index: Map<string, Map<string, SnapshotRow>>,
) {
  const used = new Set<SnapshotRow>();
  const aiByPair: Partial<Record<TargetPair, number[]>> = {};
  const aiParityByPair: Partial<Record<TargetPair, string>> = {};
  const aiSizeByPair: Partial<Record<TargetPair, string>> = {};
  const jumlahByPair: Partial<Record<TargetPair, number[]>> = {};
  const shioByPair: Partial<Record<TargetPair, number[]>> = {};
  const offByPosition: Partial<Record<PositionKey, number[]>> = {};
  let bbfsGlobal: number[] = [];

  if (config.aiDigit) {
    const row = requireSnapshot(
      index,
      marketId,
      [descriptor("ai", config.aiDigit, focus, "default")],
      `AI ${config.aiDigit} Digit`,
      used,
    );
    aiByPair[focus] = digitList(row.result);
    if (!aiByPair[focus]?.length) throw new Error(`Hasil AI ${config.aiDigit} Digit kosong.`);
  }

  if (config.parity) {
    const row = requireSnapshot(
      index,
      marketId,
      [descriptor("ai_parity", 1, focus, "default"), descriptor("ai", 7, focus, "default")],
      "Ganjil Genap",
      used,
    );
    const result = textValue(row.result);
    if (result !== "GANJIL" && result !== "GENAP") throw new Error("Hasil Ganjil Genap tidak valid.");
    aiParityByPair[focus] = result;
  }

  if (config.size) {
    const row = requireSnapshot(
      index,
      marketId,
      [descriptor("ai_size", 1, focus, "default"), descriptor("ai", 8, focus, "default")],
      "Besar Kecil",
      used,
    );
    const result = textValue(row.result);
    if (result !== "BESAR" && result !== "KECIL") throw new Error("Hasil Besar Kecil tidak valid.");
    aiSizeByPair[focus] = result;
  }

  if (config.bbfsDigit) {
    const row = requireSnapshot(
      index,
      marketId,
      [descriptor("bbfs", config.bbfsDigit, focus, `2d_${focus}`)],
      config.bbfsDigit === 10 ? "GGBK 8 Digit" : `BBFS ${config.bbfsDigit}`,
      used,
    );
    bbfsGlobal = digitList(row.result);
    if (!bbfsGlobal.length) throw new Error("Hasil BBFS kosong.");
  }

  for (const [position, count] of Object.entries(config.offPositions) as Array<[PositionKey, ShareAngkaJadiCount]>) {
    const row = requireSnapshot(
      index,
      marketId,
      [descriptor("mati", count, "belakang", "default")],
      `OFF ${position.toUpperCase()} ${count}`,
      used,
    );
    offByPosition[position] = matiDigits(row.result, position);
    if (!offByPosition[position]?.length) throw new Error(`Hasil OFF ${position.toUpperCase()} ${count} kosong.`);
  }

  if (config.offJumlah) {
    const row = requireSnapshot(
      index,
      marketId,
      [descriptor("jumlah", config.offJumlah, focus, "default")],
      `OFF Jumlah ${config.offJumlah}`,
      used,
    );
    jumlahByPair[focus] = numberList(row.result);
    if (!jumlahByPair[focus]?.length) throw new Error("Hasil OFF Jumlah kosong.");
  }

  if (config.offShio) {
    const row = requireSnapshot(
      index,
      marketId,
      [descriptor("shio", config.offShio, focus, "default")],
      `OFF Shio ${config.offShio}`,
      used,
    );
    shioByPair[focus] = numberList(row.result);
    if (!shioByPair[focus]?.length) throw new Error("Hasil OFF Shio kosong.");
  }

  const baseResult = ensureSynchronizedBaseResult(used);
  const lines = buildCustomDigitLines({
    focus,
    aiByPair,
    aiParityByPair,
    aiSizeByPair,
    bbfsGlobal,
    offAs: offByPosition.as || [],
    offKop: offByPosition.kop || [],
    offKepala: offByPosition.kepala || [],
    offEkor: offByPosition.ekor || [],
    jumlahByPair,
    shioByPair,
  });

  if (!lines.length) throw new Error("Kombinasi metode menghasilkan 0 line.");
  return { baseResult, lines };
}

export async function generateShareAngkaJadiBatch(
  focus: TargetPair,
  config: ShareAngkaJadiConfig,
  marketIds: string[],
) {
  if (!marketIds.length) throw new Error("Pilih minimal satu pasaran.");
  if (shareAngkaJadiMethodCount(config) < 1) throw new Error("Pilih minimal satu metode.");

  const supabase = createAdminClient();
  const modes = requiredModes(config);

  const [{ data: marketData, error: marketError }, { data: snapshotData, error: snapshotError }] = await Promise.all([
    supabase.from("markets").select("id,name,order").in("id", marketIds),
    supabase
      .from("analysis_snapshots")
      .select("market_id,market_name,base_result,mode,param,target_pair,analysis_scope,result,updated_at")
      .in("market_id", marketIds)
      .in("mode", modes)
      .order("updated_at", { ascending: false })
      .limit(MAX_SNAPSHOT_ROWS),
  ]);

  if (marketError) throw marketError;
  if (snapshotError) throw snapshotError;

  const snapshots = (snapshotData || []) as SnapshotRow[];
  const markets = new Map<string, MarketRow>();
  for (const market of (marketData || []) as MarketRow[]) {
    if (market.id) markets.set(normalizedKey(market.id), market);
  }
  const index = buildSnapshotIndex(snapshots);
  const rows: ShareAngkaJadiRow[] = [];
  const failed: ShareAngkaJadiFailure[] = [];

  for (const marketId of marketIds) {
    const market = markets.get(normalizedKey(marketId));
    const marketName = marketDisplayName(marketId, markets, snapshots);
    try {
      const generated = buildMarketLines(marketId, focus, config, index);
      rows.push({
        marketId,
        marketName,
        baseResult: generated.baseResult,
        order: market?.order ?? null,
        lineCount: generated.lines.length,
        lines: generated.lines,
      });
    } catch (error) {
      failed.push({
        marketId,
        marketName,
        reason: error instanceof Error ? error.message : "Gagal membuat angka jadi.",
      });
    }
  }

  return { focus, rows, failed };
}
