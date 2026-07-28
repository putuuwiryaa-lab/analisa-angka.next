import "server-only";

import { customFocusPositions, type PositionKey, type TargetPair } from "@/lib/analysis/customDigit";
import { createAdminClient } from "@/lib/server/supabase-admin";
import type { ShareAngkaJadiConfig, ShareAngkaJadiRow } from "./shareAngkaJadi";

export type ShareMethodDetail = { label: string; value: string };

type Snapshot = {
  market_id: string | null;
  base_result: string | null;
  mode: string | null;
  param: number | null;
  target_pair: string | null;
  analysis_scope: string | null;
  result: unknown;
};

const positionLabel: Record<PositionKey, string> = {
  as: "AS",
  kop: "KOP",
  kepala: "KPL",
  ekor: "EKR",
};

const clean = (value: unknown) => String(value ?? "").trim().toLowerCase();

function unwrap(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if ("result" in record) return unwrap(record.result);
  if ("data" in record) return unwrap(record.data);
  return value;
}

function numbers(value: unknown): number[] {
  const raw = unwrap(value);
  if (Array.isArray(raw)) return Array.from(new Set(raw.flatMap(numbers)));
  if (typeof raw === "number") return Number.isFinite(raw) ? [raw] : [];
  return Array.from(new Set((String(raw ?? "").match(/-?\d+/g) || []).map(Number)));
}

function digits(value: unknown): number[] {
  const raw = unwrap(value);
  if (typeof raw === "string") {
    return Array.from(new Set((raw.match(/\d/g) || []).map(Number)));
  }
  return numbers(raw).filter((number) => Number.isInteger(number) && number >= 0 && number <= 9);
}

function text(value: unknown): string {
  const raw = unwrap(value);
  return String(Array.isArray(raw) ? raw[0] ?? "" : raw ?? "").trim().toUpperCase();
}

function offDigits(value: unknown, position: PositionKey): number[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  return digits(record[position.toUpperCase()] ?? record[position]);
}

function modes(config: ShareAngkaJadiConfig): string[] {
  const result = new Set<string>();
  if (config.aiDigit || config.parity || config.size) result.add("ai");
  if (config.parity) result.add("ai_parity");
  if (config.size) result.add("ai_size");
  if (config.bbfsDigit) result.add("bbfs");
  if (Object.keys(config.offPositions).length) result.add("mati");
  if (config.offJumlah) result.add("jumlah");
  if (config.offShio) result.add("shio");
  return Array.from(result);
}

function find(
  rows: Snapshot[],
  marketId: string,
  baseResult: string,
  mode: string,
  param: number,
  targetPair: string,
  scope: string,
): Snapshot | undefined {
  return rows.find((row) =>
    clean(row.market_id) === clean(marketId)
    && clean(row.base_result) === clean(baseResult)
    && row.mode === mode
    && Number(row.param) === param
    && String(row.target_pair || "belakang") === targetPair
    && String(row.analysis_scope || "default") === scope
  );
}

function add(details: ShareMethodDetail[], label: string, value: string): void {
  if (value.trim()) details.push({ label, value: value.trim() });
}

function detailsFor(
  row: ShareAngkaJadiRow,
  focus: TargetPair,
  config: ShareAngkaJadiConfig,
  snapshots: Snapshot[],
): ShareMethodDetail[] {
  const details: ShareMethodDetail[] = [];

  if (config.aiDigit) {
    const snapshot = find(snapshots, row.marketId, row.baseResult, "ai", config.aiDigit, focus, "default");
    add(details, "AI", digits(snapshot?.result).join(""));
  }

  if (config.parity) {
    const snapshot = find(snapshots, row.marketId, row.baseResult, "ai_parity", 1, focus, "default")
      || find(snapshots, row.marketId, row.baseResult, "ai", 7, focus, "default");
    add(details, "Ganjil Genap", text(snapshot?.result));
  }

  if (config.size) {
    const snapshot = find(snapshots, row.marketId, row.baseResult, "ai_size", 1, focus, "default")
      || find(snapshots, row.marketId, row.baseResult, "ai", 8, focus, "default");
    add(details, "Besar Kecil", text(snapshot?.result));
  }

  if (config.bbfsDigit) {
    const snapshot = find(
      snapshots,
      row.marketId,
      row.baseResult,
      "bbfs",
      config.bbfsDigit,
      focus,
      `2d_${focus}`,
    );
    const label = config.bbfsDigit === 10 ? "GGBK" : "BBFS";
    add(details, label, digits(snapshot?.result).join(""));
  }

  for (const position of customFocusPositions(focus)) {
    const count = config.offPositions[position];
    if (!count) continue;
    const snapshot = find(snapshots, row.marketId, row.baseResult, "mati", count, "belakang", "default");
    add(details, `OFF ${positionLabel[position]}`, offDigits(snapshot?.result, position).join(" "));
  }

  if (config.offJumlah) {
    const snapshot = find(
      snapshots,
      row.marketId,
      row.baseResult,
      "jumlah",
      config.offJumlah,
      focus,
      "default",
    );
    add(details, "OFF Jumlah", numbers(snapshot?.result).join(" "));
  }

  if (config.offShio) {
    const snapshot = find(
      snapshots,
      row.marketId,
      row.baseResult,
      "shio",
      config.offShio,
      focus,
      "default",
    );
    add(details, "OFF Shio", numbers(snapshot?.result).join(" "));
  }

  return details;
}

export async function attachShareMethodDetails(
  rows: ShareAngkaJadiRow[],
  focus: TargetPair,
  config: ShareAngkaJadiConfig,
): Promise<Array<ShareAngkaJadiRow & { methods: ShareMethodDetail[] }>> {
  if (!rows.length) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("analysis_snapshots")
    .select("market_id,base_result,mode,param,target_pair,analysis_scope,result,updated_at")
    .in("market_id", rows.map((row) => row.marketId))
    .in("mode", modes(config))
    .order("updated_at", { ascending: false })
    .limit(10000);

  if (error) throw error;
  const snapshots = (data || []) as Snapshot[];
  return rows.map((row) => ({
    ...row,
    methods: detailsFor(row, focus, config, snapshots),
  }));
}
