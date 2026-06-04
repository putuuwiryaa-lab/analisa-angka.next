"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

const REKAP_HISTORY_LIMIT = 9;

async function fetchRekapHistory(marketId: string, mode: "invest" | "top") {
  const { data, error } = await supabase
    .from("rekap_line_evaluations")
    .select("id,from_result,new_result,is_hit,evaluated_at")
    .eq("market_id", marketId)
    .eq("mode", mode)
    .order("evaluated_at", { ascending: false })
    .limit(REKAP_HISTORY_LIMIT);
  if (error) throw error;
  return (data || []).slice(0, REKAP_HISTORY_LIMIT);
}

export function RekapHistory({ marketId, mode }: { marketId: string; mode: "invest" | "top" }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["rekapHistory", marketId, mode],
    queryFn: () => fetchRekapHistory(marketId, mode),
    enabled: Boolean(marketId && mode),
  });

  const emptyBox = (text: string) => (
    <div className="rounded-2xl border border-border-soft bg-black/20 p-4 text-center text-[11px] font-black uppercase tracking-wide text-text-muted">
      {text}
    </div>
  );

  if (isLoading) return emptyBox("Memuat riwayat…");
  if (!rows.length) return emptyBox("Riwayat evaluasi belum ada");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="display text-xs text-text">Riwayat Evaluasi</span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-text-soft">9 Terbaru</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {rows.map((row: any) => (
          <div
            key={row.id}
            className="rounded-2xl border border-border-soft bg-black/25 p-2 text-center"
          >
            <div className="num text-[11px] font-black text-text">
              {row.from_result} → {row.new_result}
            </div>
            <div
              className={`mt-2 rounded-full px-1.5 py-1 text-[9px] font-black uppercase tracking-wide ${
                row.is_hit ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
              }`}
            >
              {row.is_hit ? "MASUK" : "ZONK"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
