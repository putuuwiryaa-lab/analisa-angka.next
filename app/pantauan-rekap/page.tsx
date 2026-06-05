"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, RefreshCw } from "lucide-react";
import { StatisticCard } from "@/components/statistics/StatisticCard";
import { useMarketStatistics, aiParamOptions } from "@/components/statistics/useMarketStatistics";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import {
  aiParamLabel,
  aiScopeMeta,
  aiScopes,
  aiScopeSubtitle,
  bbfsScopeMeta,
  bbfsScopes,
  categories,
  formatUpdatedAt,
  positionPairSubtitle,
  statAccent,
  statGold,
  targetPairLabel,
  targetPairs,
} from "@/lib/analysis/statistics";

function Pill({
  active,
  tone = "emerald",
  full = false,
  onClick,
  children,
}: {
  active: boolean;
  tone?: "emerald" | "gold";
  full?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeBg =
    tone === "gold"
      ? "linear-gradient(135deg,#f6c96b,#facc15)"
      : "linear-gradient(135deg,#34d399,#22c55e)";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-[52px] rounded-2xl border px-2 py-3 text-[11px] font-black uppercase tracking-wide transition active:scale-[0.98]",
        full && "col-span-full",
        !active && "border-border-soft bg-white/[0.045] text-text-muted",
      )}
      style={
        active
          ? { background: activeBg, color: tone === "gold" ? "#120d02" : "#03120d", borderColor: "transparent" }
          : undefined
      }
    >
      {children}
    </button>
  );
}

function SectionLabel({ title, right }: { title: string; right?: string }) {
  return (
    <div className="mb-3 flex items-center gap-3 px-1">
      <span className="text-[11px] font-black uppercase tracking-wide" style={{ color: statAccent }}>
        {title}
      </span>
      <span className="h-px flex-1 bg-white/10" />
      {right && <span className="max-w-[48%] truncate text-[11px] font-bold uppercase tracking-wide text-text-soft">{right}</span>}
    </div>
  );
}

export default function StatisticsPage() {
  const router = useRouter();
  const s = useMarketStatistics();

  const isPosition = s.category === "off_digit";
  const isBBFS = s.category === "bbfs";
  const isAI = s.category === "ai";
  const selectedAI = aiScopeMeta(s.aiScope);
  const selectedBBFS = bbfsScopeMeta(s.bbfsScope);
  const categoryMeta = categories.find((c) => c.key === s.category) || categories[0];

  const paramOptions = isAI ? aiParamOptions(s.aiScope) : isBBFS ? [7, 8, 9] : [1, 2, 3];
  const filterLabel = isBBFS
    ? `${categoryMeta.title} ${selectedBBFS.label} ${s.param} Angka`
    : isAI
      ? `${selectedAI.label} ${aiParamLabel(s.param)}`
      : isPosition
        ? `2D ${targetPairLabel(s.targetPair)} OFF ${s.param}`
        : `${categoryMeta.title} ${targetPairLabel(s.targetPair)} OFF ${s.param}`;

  const topItems = s.items.slice(0, 100);
  const latestUpdate = topItems[0]?.updated_at;

  return (
    <div className="animate-rise space-y-5 pb-4">
      <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
        <ArrowLeft size={16} /> Beranda
      </Button>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-300/20 bg-surface p-5">
        <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: statAccent }}>
              Statistik Pasaran
            </p>
            <h2 className="display mt-2 text-3xl text-text">Ranking</h2>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {filterLabel} · {topItems.length} pasaran
            </p>
          </div>
          <button
            onClick={() => s.refetch()}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border-soft bg-white/[0.055] text-text-muted active:scale-95"
            aria-label="Refresh statistik"
          >
            <RefreshCw size={19} className={s.isFetching ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-emerald-300/15 bg-black/30 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-text-soft">Mode</p>
            <p className="display mt-1 truncate text-[12px]" style={{ color: statAccent }}>{filterLabel}</p>
          </div>
          <div className="rounded-2xl border border-amber-200/15 bg-black/30 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-text-soft">Update</p>
            <p className="display mt-1 truncate text-[11px]" style={{ color: statGold }}>{formatUpdatedAt(latestUpdate)}</p>
          </div>
        </div>
      </div>

      {/* Kategori */}
      <section>
        <SectionLabel title="Mode Statistik" />
        <div className="grid grid-cols-5 gap-1.5 rounded-2xl border border-border-soft bg-surface p-2">
          {categories.map((item) => (
            <Pill key={item.key} active={item.key === s.category} onClick={() => s.setCategory(item.key)}>
              {item.title}
            </Pill>
          ))}
        </div>
      </section>

      {/* Filter */}
      <section>
        <SectionLabel title="Filter Ranking" right={filterLabel} />
        <div className="space-y-4 rounded-2xl border border-border-soft bg-surface p-4">
          {isAI && (
            <div className="space-y-3 rounded-2xl border border-border-soft bg-black/20 p-3">
              <div className="grid grid-cols-2 gap-2">
                {aiScopes.map((item) => (
                  <Pill
                    key={item.key}
                    active={s.aiScope === item.key}
                    full={item.key === "2d_belakang"}
                    onClick={() => s.setAiScope(item.key)}
                  >
                    {item.label}
                  </Pill>
                ))}
              </div>
              <p className="rounded-2xl border border-border-soft bg-black/30 px-3 py-2.5 text-center text-[11px] font-black uppercase tracking-wide text-text-soft">
                {aiScopeSubtitle(s.aiScope)}
              </p>
            </div>
          )}

          {isBBFS && (
            <div className="space-y-3 rounded-2xl border border-border-soft bg-black/20 p-3">
              <div className="grid grid-cols-2 gap-2">
                {bbfsScopes.map((item) => (
                  <Pill
                    key={item.key}
                    active={s.bbfsScope === item.key}
                    full={item.key === "2d_belakang"}
                    onClick={() => s.setBbfsScope(item.key)}
                  >
                    {item.label}
                  </Pill>
                ))}
              </div>
              <p className="rounded-2xl border border-border-soft bg-black/30 px-3 py-2.5 text-center text-[11px] font-black uppercase tracking-wide text-text-soft">
                {selectedBBFS.subtitle}
              </p>
            </div>
          )}

          {!isAI && !isBBFS && (
            <div className="space-y-3 rounded-2xl border border-border-soft bg-black/20 p-3">
              <div className="grid grid-cols-3 gap-2">
                {targetPairs.map((item) => (
                  <Pill key={item.key} active={s.targetPair === item.key} onClick={() => s.setTargetPair(item.key)}>
                    {item.label}
                  </Pill>
                ))}
              </div>
              {isPosition && (
                <p className="rounded-2xl border border-border-soft bg-black/30 px-3 py-2.5 text-center text-[11px] font-black uppercase tracking-wide text-text-soft">
                  {positionPairSubtitle(s.targetPair)}
                </p>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-amber-200/15 bg-black/20 p-3">
            <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-text-soft">Parameter</p>
            <div className="grid grid-cols-3 gap-2">
              {paramOptions.map((value) => (
                <Pill
                  key={value}
                  tone="gold"
                  active={s.param === value}
                  full={isAI && value >= 7}
                  onClick={() => s.setParam(value)}
                >
                  {isAI ? aiParamLabel(value) : String(value)}
                </Pill>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Hasil */}
      <section>
        <SectionLabel title="Hasil Ranking" right={`${topItems.length} pasaran`} />
        {s.loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
        ) : topItems.length ? (
          <div className="grid gap-3">
            {topItems.map((item, index) => (
              <StatisticCard
                key={item.id || `${item.market_id}-${item.group_key}-${item.param}-${item.position}-${item.target_pair}-${item.analysis_scope}`}
                item={item}
                index={index}
                relatedStats={s.relatedStats}
                onOpen={(url) => router.push(url)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border-soft bg-surface p-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border-soft bg-black/30 text-text-soft">
              <BarChart3 />
            </div>
            <p className="display text-sm text-text">Belum ada ranking</p>
            <p className="mx-auto mt-3 max-w-sm text-xs leading-5 text-text-muted">
              {s.error
                ? "Statistik belum bisa dimuat. Pastikan evaluator statistik sudah berjalan."
                : `Belum ada pasaran yang masuk kriteria ${filterLabel}.`}
            </p>
            <Button variant="ghost" className="mt-5" onClick={() => s.refetch()}>
              Muat Ulang
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
      
