import "server-only";
import { createAdminClient } from "@/lib/server/supabase-admin";
import {
  MIN_WINS_15,
  MIN_WINS_LAST_5,
  MAX_LOSS_STREAK_ALLOWED,
} from "@/lib/analysis/statistics";
import {
  INVEST_CATALOG,
  catalogForRole,
  type InvestCombo,
  type InvestFilter,
  type InvestAccess,
} from "./investCatalog";

/**
 * INVEST ENGINE — pemindai rekomendasi invest (proksi via market_statistics).
 *
 * Per pasaran, untuk 3 pasangan 2D (depan/tengah/belakang) yang INDEPENDEN:
 *   1. baca komponen "menang 13/15" dari market_statistics
 *   2. cocokkan ke buku catatan (INVEST_CATALOG)
 *   3. ambil combo yang SEMUA bloknya menang
 *   4. urutkan pakai rata-rata score komponen
 *
 * Akses: dibuka untuk semua user (FREE penuh). Param `catalog` opsional
 * disediakan kalau suatu saat ingin membatasi (mis. lewat catalogForRole).
 *
 * Komponen yang belum genap 15 sampel (bbfs/parity/size baru) otomatis belum
 * punya baris -> combo-nya belum muncul, lalu hidup sendiri saat datanya matang.
 */

export type InvestPair = "depan" | "tengah" | "belakang";

const PAIRS: InvestPair[] = ["depan", "tengah", "belakang"];

// Tiap pasangan 2D = dua posisi digit. off_kepala = digit-1, off_ekor = digit-2.
const PAIR_POSITIONS: Record<InvestPair, { d1: string; d2: string }> = {
  depan: { d1: "as", d2: "kop" },
  tengah: { d1: "kop", d2: "kepala" },
  belakang: { d1: "kepala", d2: "ekor" },
};

const PAIR_LABEL: Record<InvestPair, string> = {
  depan: "2D DEPAN",
  tengah: "2D TENGAH",
  belakang: "2D BELAKANG",
};

interface StatRow {
  market_id: string;
  market_name?: string | null;
  group_key: string;
  mode: string;
  position: string | null;
  param: number;
  target_pair: string | null;
  analysis_scope: string | null;
  wins_15: number;
  wins_last_5: number;
  max_loss_streak: number;
  score: number | null;
}

const STAT_SELECT =
  "market_id,market_name,group_key,mode,position,param,target_pair,analysis_scope,wins_15,wins_last_5,max_loss_streak,score";

/** Deskriptor baris market_statistics untuk sebuah blok filter, pada pasangan tertentu. */
function filterDescriptor(f: InvestFilter, pair: InvestPair) {
  const pos = PAIR_POSITIONS[pair];
  switch (f.kind) {
    case "ai":
      return { group_key: "ai", position: "all", param: f.param, target_pair: pair, analysis_scope: "default" };
    case "off_kepala": // digit-1 pasangan
      return { group_key: "off_digit", position: pos.d1, param: f.param, target_pair: "all", analysis_scope: "default" };
    case "off_ekor": // digit-2 pasangan
      return { group_key: "off_digit", position: pos.d2, param: f.param, target_pair: "all", analysis_scope: "default" };
    case "off_jumlah":
      return { group_key: "off_jumlah", position: "all", param: f.param, target_pair: pair, analysis_scope: "default" };
    case "off_shio":
      return { group_key: "off_shio", position: "all", param: f.param, target_pair: pair, analysis_scope: "default" };
    // --- siap-sambut (belum ada data sampai genap 15) ---
    case "bbfs":
      return { group_key: "bbfs", position: "all", param: f.param, target_pair: pair, analysis_scope: `2d_${pair}` };
    case "parity":
      return { group_key: "ai_parity", position: "all", param: 1, target_pair: pair, analysis_scope: "default" };
    case "size":
      return { group_key: "ai_size", position: "all", param: 1, target_pair: pair, analysis_scope: "default" };
    default:
      throw new Error(`Filter invest tak dikenal: ${(f as InvestFilter).kind}`);
  }
}

/** Kunci kanonik (TANPA mode — tahan jika nama mode bbfs/parity/size sedikit beda). */
function statKey(d: { group_key: string; position: string; param: number; target_pair: string; analysis_scope: string }) {
  return [d.group_key, d.position || "all", d.param, d.target_pair || "all", d.analysis_scope || "default"].join("|");
}

function rowKey(r: StatRow) {
  return [r.group_key, r.position || "all", r.param, r.target_pair || "all", r.analysis_scope || "default"].join("|");
}

function isWinning(r: StatRow) {
  return r.wins_15 >= MIN_WINS_15 && r.wins_last_5 >= MIN_WINS_LAST_5 && r.max_loss_streak <= MAX_LOSS_STREAK_ALLOWED;
}

/** Peta komponen MENANG untuk satu pasaran. (off_digit gabungan 'mati_2d' diabaikan.) */
function buildWinningMap(rows: StatRow[]) {
  const map = new Map<string, StatRow>();
  for (const r of rows) {
    if (!isWinning(r)) continue;
    if (r.group_key === "off_digit" && r.mode !== "mati") continue; // pakai mati per-posisi
    const k = rowKey(r);
    const prev = map.get(k);
    if (!prev || (r.score ?? 0) > (prev.score ?? 0)) map.set(k, r);
  }
  return map;
}

export interface InvestComboResult {
  id: string;
  label: string;
  access: InvestAccess;
  expectedLines: number;
  hitRate: number;
  avgWins15: number;
  avgScore: number;
}

export interface InvestPairResult {
  pair: InvestPair;
  pairLabel: string;
  combos: InvestComboResult[];
}

export interface InvestMarketResult {
  marketId: string;
  marketName: string;
  pairs: InvestPairResult[];
  hasAny: boolean;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Evaluasi satu pasaran dari baris statistik-nya. `catalog` default = seluruh katalog (FREE penuh). */
export function evaluateMarketInvest(
  marketId: string,
  marketName: string,
  rows: StatRow[],
  catalog: InvestCombo[] = INVEST_CATALOG,
): InvestMarketResult {
  const winMap = buildWinningMap(rows);

  const pairs = PAIRS.map<InvestPairResult>((pair) => {
    const combos: InvestComboResult[] = [];

    for (const combo of catalog) {
      const matches = combo.filters.map((f) => winMap.get(statKey(filterDescriptor(f, pair))));
      if (matches.some((m) => !m)) continue;

      const wins = matches.map((m) => m!.wins_15);
      const scores = matches.map((m) => m!.score ?? 0);
      combos.push({
        id: combo.id,
        label: combo.label,
        access: combo.access,
        expectedLines: combo.expectedLines,
        hitRate: combo.hitRate,
        avgWins15: round1(avg(wins)),
        avgScore: round2(avg(scores)),
      });
    }

    combos.sort(
      (a, b) =>
        b.avgScore - a.avgScore ||
        b.avgWins15 - a.avgWins15 ||
        b.hitRate - a.hitRate ||
        a.expectedLines - b.expectedLines,
    );

    return { pair, pairLabel: PAIR_LABEL[pair], combos };
  });

  return {
    marketId,
    marketName,
    pairs,
    hasAny: pairs.some((p) => p.combos.length > 0),
  };
}

/** OVERVIEW: semua pasaran (1 query). Untuk halaman list /rekomendasi. */
export async function loadInvestOverview(catalog: InvestCombo[] = INVEST_CATALOG): Promise<InvestMarketResult[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("market_statistics")
    .select(STAT_SELECT)
    .eq("is_active", true)
    .gte("wins_15", MIN_WINS_15)
    .gte("wins_last_5", MIN_WINS_LAST_5)
    .lte("max_loss_streak", MAX_LOSS_STREAK_ALLOWED)
    .limit(5000);

  if (error) throw error;

  const rows = (data || []) as StatRow[];
  const byMarket = new Map<string, StatRow[]>();
  const names = new Map<string, string>();
  for (const r of rows) {
    if (!r.market_id) continue;
    let bucket = byMarket.get(r.market_id);
    if (!bucket) {
      bucket = [];
      byMarket.set(r.market_id, bucket);
    }
    bucket.push(r);
    if (r.market_name) names.set(r.market_id, r.market_name);
  }

  const results: InvestMarketResult[] = [];
  for (const [marketId, marketRows] of byMarket) {
    results.push(evaluateMarketInvest(marketId, names.get(marketId) || marketId, marketRows, catalog));
  }

  results.sort((a, b) => Number(b.hasAny) - Number(a.hasAny) || a.marketName.localeCompare(b.marketName));
  return results;
}

/** DETAIL: satu pasaran (untuk tap-to-detail nanti). */
export async function loadInvestForMarket(marketId: string, catalog: InvestCombo[] = INVEST_CATALOG): Promise<InvestMarketResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("market_statistics")
    .select(STAT_SELECT)
    .eq("market_id", marketId)
    .eq("is_active", true)
    .gte("wins_15", MIN_WINS_15)
    .gte("wins_last_5", MIN_WINS_LAST_5)
    .lte("max_loss_streak", MAX_LOSS_STREAK_ALLOWED)
    .limit(2000);

  if (error) throw error;

  const rows = (data || []) as StatRow[];
  const name = rows.find((r) => r.market_name)?.market_name || marketId;
  return evaluateMarketInvest(marketId, name, rows, catalog);
}

export { INVEST_CATALOG, catalogForRole };
