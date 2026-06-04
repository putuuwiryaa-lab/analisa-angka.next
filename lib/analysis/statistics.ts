export const statAccent = "#34d399";
export const statAccentSoft = "rgba(52,211,153,0.14)";
export const statGold = "#f6c96b";
export const MIN_WINS_15 = 13;
export const MIN_WINS_LAST_5 = 3;
export const MAX_LOSS_STREAK_ALLOWED = 2;
export const MARKET_STAT_SELECT = "id,market_id,market_name,group_key,group_label,mode,param,position,target_pair,analysis_scope,wins_15,wins_last_5,max_loss_streak,sample_size,score,previous_rank,rank_movement,latest_is_hit,latest_status,updated_at";

export type CategoryKey = "ai" | "ai_parity" | "ai_size" | "bbfs" | "off_digit" | "off_jumlah" | "off_shio";
export type VisibleCategoryKey = "ai" | "bbfs" | "off_digit" | "off_jumlah" | "off_shio";
export type TargetPair = "depan" | "tengah" | "belakang";
export type AnalysisScope = "default" | "4d" | "3d" | "2d_depan" | "2d_tengah" | "2d_belakang";
export type AiStatScope = "4d" | "3d" | "2d_depan" | "2d_tengah" | "2d_belakang";

export type MarketStatistic = {
  id?: string;
  market_id: string;
  market_name?: string;
  group_key: CategoryKey;
  group_label?: string;
  mode: string;
  param: number;
  position?: string;
  target_pair?: string;
  analysis_scope?: string;
  wins_15: number;
  wins_last_5: number;
  max_loss_streak: number;
  sample_size?: number;
  score?: number;
  previous_rank?: number | null;
  rank_movement?: number | null;
  latest_is_hit?: boolean | null;
  latest_status?: string | null;
  updated_at?: string;
};

export type RelatedStatsMap = Record<string, MarketStatistic[]>;
export type PositionPairMeta = { label: string; subtitle: string };

export const categories: Array<{ key: VisibleCategoryKey; title: string }> = [
  { key: "ai", title: "AI" },
  { key: "bbfs", title: "BBFS" },
  { key: "off_digit", title: "Posisi" },
  { key: "off_jumlah", title: "Jumlah" },
  { key: "off_shio", title: "Shio" },
];

export const targetPairs: Array<{ key: TargetPair; label: string }> = [
  { key: "depan", label: "Depan" },
  { key: "tengah", label: "Tengah" },
  { key: "belakang", label: "Belakang" },
];

export const aiScopes: Array<{ key: AiStatScope; label: string; subtitle: string; targetPair: TargetPair; analysisScope: "default" | "3d" | "4d" }> = [
  { key: "4d", label: "4D", subtitle: "AS + KOP + Kepala + Ekor", targetPair: "belakang", analysisScope: "4d" },
  { key: "3d", label: "3D", subtitle: "KOP + Kepala + Ekor", targetPair: "belakang", analysisScope: "3d" },
  { key: "2d_depan", label: "2D Depan", subtitle: "AS + KOP", targetPair: "depan", analysisScope: "default" },
  { key: "2d_tengah", label: "2D Tengah", subtitle: "KOP + Kepala", targetPair: "tengah", analysisScope: "default" },
  { key: "2d_belakang", label: "2D Belakang", subtitle: "Kepala + Ekor", targetPair: "belakang", analysisScope: "default" },
];

export const bbfsScopes: Array<{ key: AnalysisScope; label: string; subtitle: string; targetPair: TargetPair }> = [
  { key: "4d", label: "4D", subtitle: "AS + KOP + Kepala + Ekor", targetPair: "belakang" },
  { key: "3d", label: "3D", subtitle: "KOP + Kepala + Ekor", targetPair: "belakang" },
  { key: "2d_depan", label: "2D Depan", subtitle: "AS + KOP", targetPair: "depan" },
  { key: "2d_tengah", label: "2D Tengah", subtitle: "KOP + Kepala", targetPair: "tengah" },
  { key: "2d_belakang", label: "2D Belakang", subtitle: "Kepala + Ekor", targetPair: "belakang" },
];

export const positionPairs: Record<TargetPair, PositionPairMeta> = {
  depan: { label: "Depan", subtitle: "AS + KOP" },
  tengah: { label: "Tengah", subtitle: "KOP + Kepala" },
  belakang: { label: "Belakang", subtitle: "Kepala + Ekor" },
};

export function formatUpdatedAt(value?: string) {
  if (!value) return "Belum ada update";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Belum ada update";
  return date.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function targetPairLabel(value?: string) {
  if (value === "depan") return "Depan";
  if (value === "tengah") return "Tengah";
  if (value === "belakang") return "Belakang";
  return "Semua";
}

export function aiScopeMeta(value?: string) {
  return aiScopes.find((item) => item.key === value) || aiScopes[4];
}

export function aiScopeLabel(value?: string) {
  if (value === "default") return "AI 2D";
  return aiScopeMeta(value).label;
}

export function aiScopeSubtitle(value?: string) {
  return aiScopeMeta(value).subtitle;
}

export function aiParamLabel(value: number) {
  if (value === 7) return "Ganjil Genap";
  if (value === 8) return "Besar Kecil";
  return String(value);
}

export function aiParamGroupKey(value: number): CategoryKey {
  if (value === 7) return "ai_parity";
  if (value === 8) return "ai_size";
  return "ai";
}

export function aiParamStatParam(value: number) {
  return value === 7 || value === 8 ? 1 : value;
}

export function bbfsScopeMeta(value?: string) {
  return bbfsScopes.find((item) => item.key === value) || bbfsScopes[4];
}

export function bbfsScopeLabel(value?: string) {
  return bbfsScopeMeta(value).label;
}

export function bbfsScopeSubtitle(value?: string) {
  return bbfsScopeMeta(value).subtitle;
}

export function positionPairSubtitle(value?: string) {
  if (value === "depan" || value === "tengah" || value === "belakang") return positionPairs[value].subtitle;
  return "AS + KOP";
}

function cleanLabel(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function statTitle(item: MarketStatistic) {
  if (item.group_key === "ai") return cleanLabel(`${aiScopeLabel(item.analysis_scope)} ${item.analysis_scope === "default" ? targetPairLabel(item.target_pair) : ""} ${aiParamLabel(item.param)}`);
  if (item.group_key === "ai_parity") return cleanLabel(`${aiScopeLabel(item.analysis_scope)} Ganjil Genap ${item.analysis_scope === "default" ? targetPairLabel(item.target_pair) : ""}`);
  if (item.group_key === "ai_size") return cleanLabel(`${aiScopeLabel(item.analysis_scope)} Besar Kecil ${item.analysis_scope === "default" ? targetPairLabel(item.target_pair) : ""}`);
  if (item.group_key === "bbfs") return `BBFS ${bbfsScopeLabel(item.analysis_scope)} ${item.param}`;
  if (item.group_key === "off_digit") return `2D ${targetPairLabel(item.target_pair)} · OFF ${item.param}`;
  if (item.group_key === "off_jumlah") return `OFF Jumlah ${targetPairLabel(item.target_pair)} ${item.param}`;
  if (item.group_key === "off_shio") return `OFF Shio ${targetPairLabel(item.target_pair)} ${item.param}`;
  return item.group_label || "Statistik";
}

export function shortStatTitle(item: MarketStatistic) {
  if (item.group_key === "ai") return cleanLabel(`${aiScopeLabel(item.analysis_scope)} ${item.analysis_scope === "default" ? targetPairLabel(item.target_pair) : ""} ${aiParamLabel(item.param)}`);
  if (item.group_key === "ai_parity") return cleanLabel(`${aiScopeLabel(item.analysis_scope)} Ganjil Genap ${item.analysis_scope === "default" ? targetPairLabel(item.target_pair) : ""}`);
  if (item.group_key === "ai_size") return cleanLabel(`${aiScopeLabel(item.analysis_scope)} Besar Kecil ${item.analysis_scope === "default" ? targetPairLabel(item.target_pair) : ""}`);
  if (item.group_key === "bbfs") return `BBFS ${bbfsScopeLabel(item.analysis_scope)} ${item.param}`;
  if (item.group_key === "off_digit") return `2D ${targetPairLabel(item.target_pair)} OFF ${item.param}`;
  if (item.group_key === "off_jumlah") return `Jumlah ${item.param} ${targetPairLabel(item.target_pair)}`;
  if (item.group_key === "off_shio") return `Shio ${item.param} ${targetPairLabel(item.target_pair)}`;
  return item.group_label || "Statistik";
}

export function statIdentity(item: MarketStatistic) {
  return [item.market_id, item.group_key, item.mode, item.param, item.position || "all", item.target_pair || "all", item.analysis_scope || "default"].join("|");
}

export function relatedGroupKey(item: MarketStatistic) {
  if (item.group_key === "bbfs") return `${item.group_key}|${item.analysis_scope || "default"}`;
  if (item.group_key === "ai" || item.group_key === "ai_parity" || item.group_key === "ai_size") return `${item.group_key}|${item.analysis_scope || "default"}|${item.target_pair || "all"}`;
  if (item.group_key === "off_jumlah" || item.group_key === "off_shio") return `${item.group_key}|${item.target_pair || "all"}`;
  if (item.group_key === "off_digit") return `${item.group_key}|${item.target_pair || "all"}`;
  return item.group_key;
}

export function strictnessValue(item: MarketStatistic) {
  if (item.group_key === "ai" || item.group_key === "bbfs") return -Number(item.param || 99);
  if (item.group_key === "ai_parity" || item.group_key === "ai_size") return -1;
  if (item.group_key === "off_digit" || item.group_key === "off_jumlah" || item.group_key === "off_shio") return Number(item.param || 0);
  return 0;
}

export function preferredRelated(a: MarketStatistic, b: MarketStatistic) {
  const strictA = strictnessValue(a);
  const strictB = strictnessValue(b);
  if (strictA !== strictB) return strictA > strictB ? a : b;
  const scoreA = Number(a.score || 0);
  const scoreB = Number(b.score || 0);
  if (scoreA !== scoreB) return scoreA > scoreB ? a : b;
  return Number(a.wins_last_5 || 0) >= Number(b.wins_last_5 || 0) ? a : b;
}

export function relatedLabels(item: MarketStatistic, relatedStats: RelatedStatsMap) {
  const currentIdentity = statIdentity(item);
  const currentGroup = relatedGroupKey(item);
  const bestByGroup = new Map<string, MarketStatistic>();
  for (const related of relatedStats[item.market_id] || []) {
    if (statIdentity(related) === currentIdentity) continue;
    const groupKey = relatedGroupKey(related);
    if (groupKey === currentGroup) continue;
    const existing = bestByGroup.get(groupKey);
    bestByGroup.set(groupKey, existing ? preferredRelated(existing, related) : related);
  }
  return Array.from(bestByGroup.values()).sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 3).map(shortStatTitle);
}

export function badgeLabel(item: MarketStatistic) {
  if (item.wins_15 >= 14) return "Unggulan";
  if (item.wins_15 >= MIN_WINS_15) return "Stabil";
  if (item.wins_last_5 >= 5) return "Naik";
  return "Cek";
}

export function marketUrl(item: MarketStatistic) {
  return `/analyze/${item.market_id}`;
}

export function movementText(value?: number | null) {
  const movement = Number(value || 0);
  if (movement > 0) return `▲${movement}`;
  if (movement < 0) return `▼${Math.abs(movement)}`;
  if (value === 0) return "●";
  return "";
}

export function movementTone(item: MarketStatistic) {
  const movement = Number(item.rank_movement || 0);
  if (movement > 0) return { text: "#03120d", bg: "#4ade80", border: "#bbf7d0", shadow: "0 0 0 1px rgba(255,255,255,0.22) inset, 0 0 20px rgba(74,222,128,0.55)" };
  if (movement < 0) {
    const latestZonk = item.latest_is_hit === false || item.latest_status === "ZONK" || item.latest_status === "TIDAK MASUK";
    if (latestZonk) return { text: "#190407", bg: "#fb7185", border: "#fecdd3", shadow: "0 0 0 1px rgba(255,255,255,0.22) inset, 0 0 20px rgba(251,113,133,0.58)" };
    return { text: "#171002", bg: "#facc15", border: "#fef08a", shadow: "0 0 0 1px rgba(255,255,255,0.22) inset, 0 0 20px rgba(250,204,21,0.55)" };
  }
  return { text: "#d1d5db", bg: "rgba(255,255,255,0.12)", border: "rgba(255,255,255,0.24)", shadow: "0 0 12px rgba(255,255,255,0.08)" };
}