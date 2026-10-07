import Link from "next/link";
import {
  type MarketStatistic,
  marketUrl,
  movementText,
  movementTone,
} from "@/lib/analysis/statistics";
import { formatMarketName } from "@/lib/markets/format";

export function StatisticTable({
  items,
  filterLabel,
}: {
  items: MarketStatistic[];
  filterLabel: string;
}) {
  return (
    <div className="depth-1 hidden overflow-hidden rounded-2xl border lg:block">
      <table className="w-full table-fixed text-left text-sm">
        <caption className="sr-only">
          Ranking Pasaran — {filterLabel}. Riwayat dari 15 hasil dan terbaru dari 5 hasil terakhir.
        </caption>
        <colgroup>
          <col className="w-10" />
          <col />
          <col className="w-16" />
          <col className="w-16" />
          <col className="w-16" />
        </colgroup>
        <thead className="border-b border-border-soft bg-white/[0.035] text-xs text-text-muted">
          <tr>
            <th scope="col" className="px-2 py-3 text-center">
              #
            </th>
            <th scope="col" className="px-2 py-3">
              Pasaran
            </th>
            <th scope="col" className="px-2 py-3 text-center">
              Riwayat
            </th>
            <th scope="col" className="px-2 py-3 text-center">
              Terbaru
            </th>
            <th scope="col" className="px-2 py-3">
              <span className="sr-only">Tindakan</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const name = formatMarketName(item.market_name, item.market_id);
            const movement = movementText(item.rank_movement);
            const tone = movementTone(item);
            return (
              <tr
                key={item.id || item.market_id}
                className={`border-b border-border-soft last:border-0 hover:bg-white/[0.04] ${index === 0 ? "accent-bg-soft" : ""}`}
              >
                <td className="num px-2 py-3 text-center font-black text-text-muted">
                  {index + 1}
                </td>
                <th scope="row" className="break-words px-2 py-3 font-bold leading-5 text-text">
                  {name}
                  {movement ? (
                    <span
                      role="img"
                      className="mt-1 block w-fit rounded-md border px-1.5 text-xs font-semibold"
                      style={{
                        color: tone.text,
                        backgroundColor: tone.bg,
                        borderColor: tone.border,
                      }}
                      aria-label={
                        Number(item.rank_movement) > 0
                          ? `Naik ${item.rank_movement} peringkat`
                          : Number(item.rank_movement) < 0
                            ? `Turun ${Math.abs(Number(item.rank_movement))} peringkat`
                            : "Peringkat tetap"
                      }
                    >
                      {movement}
                    </span>
                  ) : null}
                </th>
                <td className="num accent-text px-2 py-3 text-center font-black">
                  {item.wins_15}/15
                </td>
                <td className="num accent-text px-2 py-3 text-center font-black">
                  {item.wins_last_5}/5
                </td>
                <td className="px-2 py-3">
                  <Link
                    href={marketUrl(item)}
                    prefetch={false}
                    aria-label={`Buka pasaran ${name}`}
                    className="accent-bg-soft accent-border accent-text flex min-h-10 items-center justify-center rounded-xl border px-2 text-xs font-bold hover:bg-white/[0.08]"
                  >
                    Buka
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
