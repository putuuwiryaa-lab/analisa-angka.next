import {
  type MarketStatistic,
  type RelatedStatsMap,
  badgeLabel,
  bbfsScopeSubtitle,
  marketUrl,
  movementText,
  movementTone,
  positionPairSubtitle,
  relatedLabels,
  statTitle,
} from "@/lib/analysis/statistics";

const solidAccentStyle = {
  background: "linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 76%,#2ec96f))",
  color: "#03120d",
};

export function StatisticCard({
  item,
  index,
  relatedStats,
  onOpen,
}: {
  item: MarketStatistic;
  index: number;
  relatedStats: RelatedStatsMap;
  onOpen: (url: string) => void;
}) {
  const marketName = item.market_name || item.market_id;
  const topRank = index === 0;
  const alsoLabels = relatedLabels(item, relatedStats);
  const movement = movementText(item.rank_movement);
  const tone = movementTone(item);

  return (
    <div
      className={
        topRank
          ? "animate-soft-pop depth-accent overflow-hidden rounded-3xl border p-3 text-left sm:p-4"
          : "animate-soft-pop depth-1 overflow-hidden rounded-3xl border p-3 text-left sm:p-4"
      }
      style={{ animationDelay: `${Math.min(index, 10) * 24}ms` }}
    >
      <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
        <div className="flex w-10 shrink-0 flex-col items-center gap-1.5 sm:w-14">
          <div
            className={
              topRank
                ? "display flex h-10 w-10 items-center justify-center rounded-2xl text-[11px] shadow-sm sm:h-12 sm:w-12 sm:text-[13px]"
                : "display accent-text depth-3 flex h-10 w-10 items-center justify-center rounded-2xl border text-[11px] sm:h-12 sm:w-12 sm:text-[13px]"
            }
            style={topRank ? solidAccentStyle : undefined}
          >
            #{index + 1}
          </div>
          {movement && (
            <span
              className="display mt-1 flex min-h-6 min-w-10 items-center justify-center rounded-xl border px-2 py-1 text-[10px] leading-none sm:min-h-7 sm:min-w-14 sm:px-3 sm:py-1.5 sm:text-xs"
              style={{ color: tone.text, backgroundColor: tone.bg, borderColor: tone.border, boxShadow: tone.shadow }}
            >
              {movement}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="display break-words text-[1.05rem] leading-tight text-text sm:text-base">{marketName}</p>
              <p className="accent-text mt-1 break-words text-[10px] font-black uppercase leading-4 tracking-wide sm:text-[11px]">
                {statTitle(item)}
              </p>
              {item.group_key === "off_digit" && (
                <p className="mt-1 text-[10px] font-black uppercase leading-4 tracking-wide text-text-muted sm:text-[11px]">
                  {positionPairSubtitle(item.target_pair)}
                </p>
              )}
              {item.group_key === "bbfs" && (
                <p className="mt-1 text-[10px] font-black uppercase leading-4 tracking-wide text-text-muted sm:text-[11px]">
                  {bbfsScopeSubtitle(item.analysis_scope)}
                </p>
              )}
            </div>
            <span className="accent-bg-soft accent-text w-fit shrink-0 rounded-full border border-border-soft px-2.5 py-1 text-[10px] font-black uppercase tracking-wide sm:text-[11px]">
              {badgeLabel(item)}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="depth-2 min-w-0 rounded-2xl border p-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-text-muted sm:text-[10px]">Riwayat</p>
              <p className="display accent-text text-[13px] sm:text-sm">
                {item.wins_15}/15
              </p>
            </div>
            <div className="depth-2 min-w-0 rounded-2xl border p-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-text-muted sm:text-[10px]">Terbaru</p>
              <p className="display accent-text text-[13px] sm:text-sm">
                {item.wins_last_5}/5
              </p>
            </div>
          </div>

          {alsoLabels.length > 0 && (
            <div className="depth-2 mt-3 rounded-2xl border px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-text-muted sm:text-[10px]">Juga unggul</p>
              <p className="accent-text mt-1 line-clamp-3 break-words text-[10px] font-black uppercase leading-4 tracking-wide sm:text-[11px]">
                {alsoLabels.join(" · ")}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => onOpen(marketUrl(item))}
            className="pressable accent-bg-soft accent-text accent-border mt-3 min-h-11 w-full rounded-2xl border px-4 py-2.5 text-[11px] font-black uppercase tracking-wide hover:bg-white/[0.06]"
            style={topRank ? solidAccentStyle : undefined}
          >
            Buka Pasaran
          </button>
        </div>
      </div>
    </div>
  );
}
