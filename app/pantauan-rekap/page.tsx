"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Binary,
  Boxes,
  Check,
  ChevronDown,
  Combine,
  Feather,
  Gauge,
  Grid3X3,
  Hash,
  Layers3,
  Lock,
  MoveHorizontal,
  PanelLeft,
  PanelRight,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { StatisticCard } from "@/components/statistics/StatisticCard";
import { useMarketStatistics, aiParamOptions } from "@/components/statistics/useMarketStatistics";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import {
  aiParamLabel,
  aiScopeMeta,
  aiScopes,
  bbfsParamLabel,
  bbfsScopeMeta,
  bbfsScopes,
  formatUpdatedAt,
  isAiFamilyCategory,
  positionPairSubtitle,
  targetPairLabel,
  targetPairs,
  type VisibleCategoryKey,
} from "@/lib/analysis/statistics";

type ModeOption = {
  key: VisibleCategoryKey;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
};

const MODE_OPTIONS: ModeOption[] = [
  { key: "ai", title: "Angka Ikut", subtitle: "Ranking digit terkuat", Icon: Activity },
  { key: "bbfs", title: "BBFS", subtitle: "Ranking kumpulan digit", Icon: Grid3X3 },
  { key: "off_digit", title: "Angka Mati", subtitle: "OFF digit per posisi", Icon: ShieldAlert },
  { key: "off_jumlah", title: "Jumlah Mati", subtitle: "OFF jumlah 2D", Icon: Hash },
  { key: "off_shio", title: "Shio Mati", subtitle: "OFF shio 2D", Icon: Gauge },
];

function scopeIcon(key: string): LucideIcon {
  if (key === "depan" || key === "2d_depan") return PanelLeft;
  if (key === "tengah" || key === "2d_tengah") return MoveHorizontal;
  if (key === "belakang" || key === "2d_belakang") return PanelRight;
  if (key === "3d") return Layers3;
  return Boxes;
}

function parameterIcon(category: string, value: number): LucideIcon {
  if ((category === "ai" || category === "ai_parity") && value === 7) return Binary;
  if ((category === "ai" || category === "ai_size") && value === 8) return Scale;
  if (category === "bbfs" && value === 10) return Combine;
  if (category.startsWith("off_")) {
    if (value === 1) return Feather;
    if (value === 2) return SlidersHorizontal;
    return ShieldCheck;
  }
  return Hash;
}

function bbfsParamOptions(scope: string) {
  return scope === "4d" ? [7, 8, 9] : [7, 8, 9, 10];
}

function parameterLabel(category: string, value: number) {
  if (category === "bbfs") return bbfsParamLabel(value);
  if (category === "ai" || category === "ai_parity" || category === "ai_size") {
    return value === 7 || value === 8 ? aiParamLabel(value) : `${value} Digit`;
  }
  if (category === "off_digit") return `${value} Digit OFF`;
  if (category === "off_jumlah") return `${value} Jumlah`;
  return `${value} Shio`;
}

function parameterHint(category: string, value: number) {
  if (!category.startsWith("off_")) return undefined;
  if (value === 1) return "Ringan";
  if (value === 2) return "Seimbang";
  return "Ketat";
}

function ModeButton({ option, active, full, onClick }: { option: ModeOption; active: boolean; full?: boolean; onClick: () => void }) {
  const { Icon } = option;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable flex min-h-[78px] items-center gap-3 rounded-2xl border px-3 py-3 text-left",
        full && "col-span-2",
        active ? "depth-accent accent-border" : "depth-3 hover:border-border hover:bg-white/[0.055]",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
          active ? "accent-bg-soft accent-text accent-border" : "depth-2 text-text-muted",
        )}
      >
        <Icon size={18} strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("display block text-[12px]", active ? "accent-text" : "text-text")}>{option.title}</span>
        <span className="mt-1 block text-[10px] font-semibold leading-4 text-text-soft">{option.subtitle}</span>
      </span>
      {active ? <Check size={16} className="shrink-0 text-accent" strokeWidth={2.4} /> : null}
    </button>
  );
}

function ChoiceButton({
  active,
  title,
  subtitle,
  Icon,
  full,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle?: string;
  Icon: LucideIcon;
  full?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable flex min-h-[62px] items-center justify-center gap-2 rounded-2xl border px-2.5 py-2.5 text-center",
        full && "col-span-full",
        active ? "accent-bg-soft accent-border text-text" : "depth-3 text-text-muted hover:border-border hover:bg-white/[0.055]",
      )}
    >
      <Icon size={16} strokeWidth={1.9} className={active ? "text-accent" : "text-text-soft"} />
      <span className="min-w-0">
        <span className="display block text-[11px] leading-4">{title}</span>
        {subtitle ? <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide text-text-soft">{subtitle}</span> : null}
      </span>
    </button>
  );
}

function StepHeader({ number, title, subtitle }: { number: number; title: string; subtitle: string }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <span className="accent-bg-soft accent-border accent-text flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-black">
        {number}
      </span>
      <div className="min-w-0">
        <p className="display text-[12px] text-text">{title}</p>
        <p className="mt-1 text-[10px] font-semibold leading-4 text-text-soft">{subtitle}</p>
      </div>
    </div>
  );
}

export default function StatisticsPage() {
  const router = useRouter();
  const s = useMarketStatistics();
  const [visibleCount, setVisibleCount] = useState(20);

  const isPosition = s.category === "off_digit";
  const isBBFS = s.category === "bbfs";
  const isAiFamily = isAiFamilyCategory(s.category);
  const selectedAI = aiScopeMeta(s.aiScope);
  const selectedBBFS = bbfsScopeMeta(s.bbfsScope);
  const selectedMode = MODE_OPTIONS.find((item) => item.key === s.category) || MODE_OPTIONS[0];

  const paramOptions =
    s.category === "ai_parity"
      ? [7]
      : s.category === "ai_size"
        ? [8]
        : s.category === "ai"
          ? aiParamOptions(s.aiScope)
          : isBBFS
            ? bbfsParamOptions(s.bbfsScope)
            : [1, 2, 3];

  const targetLabel = isBBFS
    ? selectedBBFS.label
    : isAiFamily
      ? selectedAI.label
      : `2D ${targetPairLabel(s.targetPair)}`;
  const outputLabel = parameterLabel(s.category, s.param);
  const filterLabel = `${selectedMode.title} · ${targetLabel} · ${outputLabel}`;

  const allItems = s.items.slice(0, 100);
  const topItems = allItems.slice(0, visibleCount);
  const latestUpdate = allItems[0]?.updated_at;
  const isLockedStatistic = Boolean(s.error && /vip|akses|fitur analisa gratis/i.test(s.error));
  const hasMore = topItems.length < allItems.length;

  useEffect(() => {
    setVisibleCount(20);
  }, [s.category, s.aiScope, s.bbfsScope, s.targetPair, s.param]);

  return (
    <div data-mode="statistics" className="animate-rise space-y-4 pb-5">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
          <ArrowLeft size={16} /> Beranda
        </Button>
        <button
          type="button"
          onClick={() => s.refetch()}
          className="pressable depth-3 flex h-11 w-11 items-center justify-center rounded-2xl border text-text-muted hover:border-border hover:bg-white/[0.075]"
          aria-label="Refresh statistik"
        >
          <RefreshCw size={17} className={s.isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      <section className="animate-soft-pop depth-accent rounded-3xl border p-4">
        <div className="flex items-start gap-3">
          <div className="depth-3 accent-text flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border">
            <BarChart3 size={21} strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="accent-text text-[10px] font-black uppercase tracking-[0.18em]">Statistik Pasaran</p>
            <h1 className="display mt-1 text-2xl text-text">Ranking Performa</h1>
            <p className="mt-1.5 text-[11px] font-semibold leading-5 text-text-muted">
              Bandingkan pasaran berdasarkan riwayat 15 hasil terakhir.
            </p>
          </div>
        </div>

        <div className="depth-2 mt-4 flex items-center gap-3 rounded-2xl border px-3 py-3">
          <SlidersHorizontal size={16} className="shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-wide text-text-soft">Ranking aktif</p>
            <p className="mt-1 truncate text-[11px] font-black uppercase tracking-wide text-text">{filterLabel}</p>
          </div>
          <span className="shrink-0 text-[9px] font-bold text-text-soft">{formatUpdatedAt(latestUpdate)}</span>
        </div>
      </section>

      <section className="animate-soft-pop depth-1 rounded-3xl border p-4">
        <StepHeader number={1} title="Pilih metode" subtitle="Tentukan jenis analisa yang ingin dibandingkan." />
        <div className="grid grid-cols-2 gap-2">
          {MODE_OPTIONS.map((item, index) => (
            <ModeButton
              key={item.key}
              option={item}
              active={item.key === s.category}
              full={index === MODE_OPTIONS.length - 1}
              onClick={() => s.setCategory(item.key)}
            />
          ))}
        </div>

        <div className="my-4 h-px bg-white/10" />

        <StepHeader
          number={2}
          title={isAiFamily || isBBFS ? "Pilih target" : "Pilih posisi 2D"}
          subtitle={isAiFamily || isBBFS ? "Tentukan cakupan angka yang dinilai." : "Tentukan bagian hasil yang ingin dibandingkan."}
        />

        {isAiFamily ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {aiScopes.map((item) => (
                <ChoiceButton
                  key={item.key}
                  active={s.aiScope === item.key}
                  title={item.label}
                  Icon={scopeIcon(item.key)}
                  full={item.key === "2d_belakang"}
                  onClick={() => s.setAiScope(item.key)}
                />
              ))}
            </div>
            <p className="mt-2 rounded-2xl bg-white/[0.035] px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-text-soft">
              {selectedAI.subtitle}
            </p>
          </>
        ) : isBBFS ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {bbfsScopes.map((item) => (
                <ChoiceButton
                  key={item.key}
                  active={s.bbfsScope === item.key}
                  title={item.label}
                  Icon={scopeIcon(item.key)}
                  full={item.key === "2d_belakang"}
                  onClick={() => s.setBbfsScope(item.key)}
                />
              ))}
            </div>
            <p className="mt-2 rounded-2xl bg-white/[0.035] px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-text-soft">
              {selectedBBFS.subtitle}
            </p>
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {targetPairs.map((item) => (
                <ChoiceButton
                  key={item.key}
                  active={s.targetPair === item.key}
                  title={item.label}
                  Icon={scopeIcon(item.key)}
                  onClick={() => s.setTargetPair(item.key)}
                />
              ))}
            </div>
            <p className="mt-2 rounded-2xl bg-white/[0.035] px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-text-soft">
              {positionPairSubtitle(s.targetPair)}
            </p>
          </>
        )}

        <div className="my-4 h-px bg-white/10" />

        <StepHeader
          number={3}
          title={isAiFamily || isBBFS ? "Pilih output" : "Pilih tingkat OFF"}
          subtitle={isAiFamily || isBBFS ? "Tentukan jumlah atau jenis digit yang diranking." : "Semakin tinggi, semakin ketat filternya."}
        />
        <div className="grid grid-cols-3 gap-2">
          {paramOptions.map((value) => (
            <ChoiceButton
              key={value}
              active={s.param === value}
              title={parameterLabel(s.category, value)}
              subtitle={parameterHint(s.category, value)}
              Icon={parameterIcon(s.category, value)}
              full={(isAiFamily && value >= 7) || (isBBFS && value === 10)}
              onClick={() => s.setParam(value)}
            />
          ))}
        </div>

        <div className="accent-bg-soft accent-border mt-4 flex items-center gap-2 rounded-2xl border px-3 py-2.5">
          <Check size={15} className="shrink-0 text-accent" strokeWidth={2.4} />
          <p className="min-w-0 truncate text-[10px] font-black uppercase tracking-wide text-text">{filterLabel}</p>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <p className="display text-sm text-text">Ranking Pasaran</p>
            <p className="mt-1 text-[10px] font-semibold text-text-soft">
              {s.isFetching ? "Memperbarui data…" : `${allItems.length} pasaran ditemukan`}
            </p>
          </div>
          {allItems.length > 0 ? (
            <span className="text-[10px] font-black uppercase tracking-wide text-text-soft">
              {topItems.length}/{allItems.length}
            </span>
          ) : null}
        </div>

        {s.loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}
          </div>
        ) : topItems.length ? (
          <>
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

            {hasMore ? (
              <button
                type="button"
                onClick={() => setVisibleCount((current) => Math.min(current + 20, allItems.length))}
                className="pressable depth-3 mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border px-4 text-[11px] font-black uppercase tracking-wide text-text-muted hover:border-border hover:bg-white/[0.055]"
              >
                <ChevronDown size={16} /> Tampilkan Berikutnya
              </button>
            ) : null}
          </>
        ) : (
          <div className="animate-soft-pop depth-1 rounded-3xl border p-7 text-center">
            <div className="depth-2 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border text-text-soft">
              {isLockedStatistic ? <Lock /> : <BarChart3 />}
            </div>
            <p className="display text-sm text-text">
              {isLockedStatistic ? "Statistik Lanjutan VIP" : "Belum ada ranking"}
            </p>
            <p className="mx-auto mt-3 max-w-sm text-xs leading-5 text-text-muted">
              {isLockedStatistic
                ? "Fitur analisa ini sudah tersedia gratis. Statistik performa mendalam tetap menjadi bagian dari akses VIP untuk evaluasi metode yang lebih lengkap."
                : s.error
                  ? s.error
                  : `Belum ada pasaran yang masuk kriteria ${filterLabel}.`}
            </p>
            {!isLockedStatistic ? (
              <Button variant="ghost" className="mt-5" onClick={() => s.refetch()}>
                Muat Ulang
              </Button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
