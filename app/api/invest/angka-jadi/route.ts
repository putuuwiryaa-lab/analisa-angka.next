import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { verifyActiveTelegramSession } from "@/lib/server/telegram-session";
import { runAnalysis } from "@/lib/server/engines/predictionEngine";
import {
  buildCustomDigitLines,
  bbfsScopeToTargetPair,
  customFocusPairs,
  customFocusToBBFSScope,
  type CustomFocus,
  type TargetPair,
} from "@/lib/analysis/customDigit";
import { toNumberList } from "@/lib/analysis/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMULA_VERSION = "invest-angka-jadi-v1";
const CACHE_TTL_HOURS = 12;
const CACHE_CLEANUP_GRACE_HOURS = 24;

type InvestFilter = { kind: string; param: number };
type AnalysisScope = "default" | "4d" | "3d" | "2d_depan" | "2d_tengah" | "2d_belakang";

type MarketRow = {
  id?: string | null;
  slug?: string | null;
  code?: string | null;
  name?: string | null;
  title?: string | null;
  history_data?: string | null;
  historyData?: string | null;
  history?: string | null;
  data?: string | null;
  results?: string | null;
  result?: string | null;
};

function normalizeMarketId(value: string) {
  try {
    return decodeURIComponent(value).trim().toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

function marketIdOf(market: MarketRow) {
  return String(market.id ?? market.slug ?? market.code ?? market.name ?? "");
}

function marketNameOf(market: MarketRow) {
  return String(market.name ?? market.title ?? market.id ?? market.slug ?? "Pasaran");
}

function extractHistoryData(market: MarketRow) {
  return String(
    market.history_data ?? market.historyData ?? market.history ?? market.data ?? market.results ?? market.result ?? "",
  );
}

function parseHistoryTokens(historyData: string) {
  return historyData
    .split(/[\s\n\r\t,;|]+/)
    .map((token) => token.trim())
    .filter((token) => /^\d{4}$/.test(token));
}

function sanitizePair(value: unknown): TargetPair {
  return value === "depan" || value === "tengah" || value === "belakang" ? value : "belakang";
}

function sanitizeFilters(value: unknown): InvestFilter[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      kind: String((item as any)?.kind || "").trim(),
      param: Number((item as any)?.param || 0),
    }))
    .filter((item) => item.kind && Number.isInteger(item.param) && item.param > 0 && item.param <= 9)
    .sort((a, b) => (a.kind === b.kind ? a.param - b.param : a.kind.localeCompare(b.kind)));
}

function stableFiltersKey(filters: InvestFilter[]) {
  return filters.map((item) => `${item.kind}:${item.param}`).join("|");
}

function cacheKey(input: {
  marketId: string;
  pair: TargetPair;
  filters: InvestFilter[];
  latestResult: string;
}) {
  const raw = [input.marketId, input.pair, stableFiltersKey(input.filters), input.latestResult, FORMULA_VERSION].join("::");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function normalizeScopeForType(type: string, scope: AnalysisScope): AnalysisScope {
  if (type === "ai" && (scope === "2d_depan" || scope === "2d_tengah" || scope === "2d_belakang")) return "default";
  return scope;
}

function runEngine(type: string, data: string[], param: number, targetPair: TargetPair, scope: AnalysisScope = "default") {
  const isBBFS = type === "bbfs";
  const rawScope = scope;
  const safeScope = normalizeScopeForType(type, rawScope);
  const engineType = isBBFS ? "ai" : type;
  const result = runAnalysis(engineType, data, param, {
    analysisScope: safeScope,
    targetPair,
    forceDigitResult: isBBFS,
  }) as any;
  return result?.data || result;
}

async function loadMarketData(marketId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("markets").select("*");
  if (error) throw error;

  const requested = normalizeMarketId(marketId);
  const market = ((data || []) as MarketRow[]).find((item) => {
    const id = normalizeMarketId(marketIdOf(item));
    const name = normalizeMarketId(marketNameOf(item));
    return id === requested || name === requested;
  });

  if (!market) throw new Error(`Data histori ${marketId} belum disetup oleh Admin!`);

  const history = parseHistoryTokens(extractHistoryData(market));
  if (history.length < 17) {
    throw new Error(`Data ${marketNameOf(market)} kurang. Minimal 17 result, terbaca ${history.length}.`);
  }

  return {
    market,
    history: history.slice(-200),
    latestResult: history[history.length - 1] || "----",
  };
}

function stateFromInvestFilters(pair: TargetPair, filters: InvestFilter[]) {
  const customAiDigitByPair: Partial<Record<TargetPair, 2 | 4 | 6>> = {};
  const customAiParityByPair: Partial<Record<TargetPair, boolean>> = {};
  const customAiSizeByPair: Partial<Record<TargetPair, boolean>> = {};
  const customOffJumlahCountByPair: Partial<Record<TargetPair, number>> = {};
  const customOffShioCountByPair: Partial<Record<TargetPair, number>> = {};
  let customBBFSDigit: 7 | 8 | 9 | null = null;
  let customOffAsCount: number | null = null;
  let customOffKopCount: number | null = null;
  let customOffKepalaCount: number | null = null;
  let customOffEkorCount: number | null = null;

  const pos = pair === "depan" ? { d1: "as", d2: "kop" } : pair === "tengah" ? { d1: "kop", d2: "kepala" } : { d1: "kepala", d2: "ekor" };

  for (const filter of filters) {
    if (filter.kind === "ai" && [2, 4, 6].includes(filter.param)) customAiDigitByPair[pair] = filter.param as 2 | 4 | 6;
    if (filter.kind === "parity") customAiParityByPair[pair] = true;
    if (filter.kind === "size") customAiSizeByPair[pair] = true;
    if (filter.kind === "bbfs" && [7, 8, 9].includes(filter.param)) customBBFSDigit = filter.param as 7 | 8 | 9;
    if (filter.kind === "off_jumlah") customOffJumlahCountByPair[pair] = filter.param;
    if (filter.kind === "off_shio") customOffShioCountByPair[pair] = filter.param;
    if (filter.kind === "off_kepala") {
      if (pos.d1 === "as") customOffAsCount = filter.param;
      if (pos.d1 === "kop") customOffKopCount = filter.param;
      if (pos.d1 === "kepala") customOffKepalaCount = filter.param;
    }
    if (filter.kind === "off_ekor") {
      if (pos.d2 === "kop") customOffKopCount = filter.param;
      if (pos.d2 === "kepala") customOffKepalaCount = filter.param;
      if (pos.d2 === "ekor") customOffEkorCount = filter.param;
    }
  }

  return {
    customFocus: pair,
    customAiDigitByPair,
    customAiParityByPair,
    customAiSizeByPair,
    customAi3dDigit: null,
    customAi3dParity: false,
    customAi3dSize: false,
    customAi4dDigit: null,
    customBBFSDigit,
    customOffAsCount,
    customOffKopCount,
    customOffKepalaCount,
    customOffEkorCount,
    customOffJumlahCountByPair,
    customOffShioCountByPair,
  };
}

async function generateAngkaJadi(data: string[], pair: TargetPair, filters: InvestFilter[]) {
  const state = stateFromInvestFilters(pair, filters);
  const pairs = customFocusPairs(pair);

  const aiByPair: Partial<Record<TargetPair, number[]>> = {};
  const aiParityByPair: Partial<Record<TargetPair, string>> = {};
  const aiSizeByPair: Partial<Record<TargetPair, string>> = {};
  const jumlahByPair: Partial<Record<TargetPair, number[]>> = {};
  const shioByPair: Partial<Record<TargetPair, number[]>> = {};
  const matiCache: Partial<Record<number, any>> = {};
  let bbfsGlobal: number[] = [];

  for (const target of pairs) {
    const aiDigit = state.customAiDigitByPair[target];
    const jumlahCount = state.customOffJumlahCountByPair[target];
    const shioCount = state.customOffShioCountByPair[target];

    if (aiDigit) aiByPair[target] = toNumberList(runEngine("ai", data, aiDigit, target)?.result);
    if (state.customAiParityByPair[target]) {
      const raw = runEngine("ai", data, 7, target)?.result;
      aiParityByPair[target] = String((Array.isArray(raw) ? raw[0] : raw) || "").trim().toUpperCase();
    }
    if (state.customAiSizeByPair[target]) {
      const raw = runEngine("ai", data, 8, target)?.result;
      aiSizeByPair[target] = String((Array.isArray(raw) ? raw[0] : raw) || "").trim().toUpperCase();
    }
    if (jumlahCount) jumlahByPair[target] = toNumberList(runEngine("jumlah", data, jumlahCount, target)?.result);
    if (shioCount) shioByPair[target] = toNumberList(runEngine("shio", data, shioCount, target)?.result);
  }

  if (state.customBBFSDigit) {
    const bbfsScope = customFocusToBBFSScope(pair as CustomFocus);
    const bbfsTargetPair = bbfsScopeToTargetPair(bbfsScope);
    bbfsGlobal = toNumberList(runEngine("bbfs", data, state.customBBFSDigit, bbfsTargetPair, bbfsScope)?.result);
  }

  const getMati = (count: number | null) => {
    if (!count) return null;
    if (!matiCache[count]) matiCache[count] = runEngine("mati", data, count, "belakang");
    return matiCache[count];
  };

  const matiAs = getMati(state.customOffAsCount);
  const matiKop = getMati(state.customOffKopCount);
  const matiKepala = getMati(state.customOffKepalaCount);
  const matiEkor = getMati(state.customOffEkorCount);
  const offAs = state.customOffAsCount ? toNumberList(matiAs?.AS?.result) : [];
  const offKop = state.customOffKopCount ? toNumberList(matiKop?.KOP?.result) : [];
  const offKepala = state.customOffKepalaCount ? toNumberList(matiKepala?.KEPALA?.result) : [];
  const offEkor = state.customOffEkorCount ? toNumberList(matiEkor?.EKOR?.result) : [];

  const lines = buildCustomDigitLines({
    focus: pair,
    aiByPair,
    aiParityByPair,
    aiSizeByPair,
    bbfsGlobal,
    offAs,
    offKop,
    offKepala,
    offEkor,
    jumlahByPair,
    shioByPair,
  });

  return {
    lines,
    focus: pair,
    customFocus: pair,
    aiByPair,
    aiParityByPair,
    aiSizeByPair,
    bbfsGlobal,
    offAs,
    offKop,
    offKepala,
    offEkor,
    jumlahByPair,
    shioByPair,
  };
}

async function readCache(key: string) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("invest_angka_jadi_cache")
      .select("angka_jadi, line_count, created_at, expires_at")
      .eq("cache_key", key)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error) return null;
    return data as any;
  } catch {
    return null;
  }
}

async function writeCache(params: {
  key: string;
  marketId: string;
  pair: TargetPair;
  filters: InvestFilter[];
  latestResult: string;
  result: Record<string, any>;
}) {
  try {
    const supabase = createAdminClient();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();

    await supabase
      .from("invest_angka_jadi_cache")
      .delete()
      .lt("expires_at", new Date(Date.now() - CACHE_CLEANUP_GRACE_HOURS * 60 * 60 * 1000).toISOString());

    await supabase.from("invest_angka_jadi_cache").upsert({
      cache_key: params.key,
      market_id: params.marketId,
      pair: params.pair,
      filters_json: params.filters,
      latest_result: params.latestResult,
      formula_version: FORMULA_VERSION,
      angka_jadi: params.result,
      line_count: Array.isArray(params.result.lines) ? params.result.lines.length : 0,
      expires_at: expiresAt,
    });
  } catch {
    // Cache table is optional. If it does not exist yet, calculation still returns normally.
  }
}

export async function POST(request: Request) {
  const access = await verifyActiveTelegramSession(request.headers);
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const marketId = String(body.marketId || body.market_id || "").trim();
    const pair = sanitizePair(body.pair);
    const filters = sanitizeFilters(body.filters);

    if (!marketId || !filters.length) {
      return NextResponse.json({ success: false, error: "Request Angka Jadi tidak valid." }, { status: 400 });
    }

    const { market, history, latestResult } = await loadMarketData(marketId);
    const key = cacheKey({ marketId: marketIdOf(market), pair, filters, latestResult });
    const cached = await readCache(key);

    if (cached?.angka_jadi) {
      return NextResponse.json({
        success: true,
        cached: true,
        formula_version: FORMULA_VERSION,
        market_id: marketIdOf(market),
        market_name: marketNameOf(market),
        pair,
        latest_result: latestResult,
        ...cached.angka_jadi,
      });
    }

    const result = await generateAngkaJadi(history, pair, filters);
    await writeCache({ key, marketId: marketIdOf(market), pair, filters, latestResult, result });

    return NextResponse.json({
      success: true,
      cached: false,
      formula_version: FORMULA_VERSION,
      market_id: marketIdOf(market),
      market_name: marketNameOf(market),
      pair,
      latest_result: latestResult,
      ...result,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal membuat Angka Jadi Invest.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
