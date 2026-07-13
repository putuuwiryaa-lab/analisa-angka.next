"use client";

import { use, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Share2, Target } from "lucide-react";
import { MODES, type ModeKey } from "@/components/analysis/modes";
import { PageTopBar } from "@/components/layout/PageTopBar";
import { cn } from "@/lib/cn";
import { fetchMarkets } from "@/lib/markets/client";

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeId(value: string) {
  return safeDecode(value).trim().toLowerCase();
}

async function fetchMarketName(marketId: string) {
  const markets = await fetchMarkets();
  const decodedMarketId = safeDecode(marketId);
  const requestedId = normalizeId(marketId);
  const market = markets.find((item) => {
    const id = item?.id ? normalizeId(String(item.id)) : "";
    const name = item?.name ? normalizeId(String(item.name)) : "";
    return id === requestedId || name === requestedId;
  });

  return market?.name || market?.id || decodedMarketId;
}

type MenuItem = {
  mode: ModeKey;
  subtitle: string;
  full?: boolean;
};

const MAIN_MENU: MenuItem[] = [
  { mode: "ai", subtitle: "Cari digit yang paling kuat" },
  { mode: "bbfs", subtitle: "Susun kumpulan digit pilihan" },
  { mode: "mati", subtitle: "Buang digit lemah per posisi", full: true },
  { mode: "jumlah", subtitle: "Filter berdasarkan jumlah 2D" },
  { mode: "shio", subtitle: "Filter berdasarkan shio 2D" },
];

function AnalysisMenuCard({ item, marketId, index }: { item: MenuItem; marketId: string; index: number }) {
  const { title, Icon } = MODES[item.mode];

  return (
    <Link
      href={`/analyze/${encodeURIComponent(safeDecode(marketId))}/${item.mode}`}
      data-mode={item.mode}
      className={cn(
        "pressable animate-soft-pop depth-1 group relative overflow-hidden rounded-3xl border p-3.5 text-left hover:border-border",
        item.full
          ? "col-span-2 flex min-h-[84px] items-center gap-3"
          : "flex min-h-[122px] flex-col items-start",
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 28}ms` }}
    >
      <span className="absolute inset-x-5 top-0 h-1 rounded-b-full bg-[var(--accent)] opacity-70" />
      <span
        className={cn(
          "depth-3 accent-text flex shrink-0 items-center justify-center rounded-2xl border transition-transform duration-150 group-hover:scale-[1.035]",
          item.full ? "h-12 w-12" : "h-11 w-11",
        )}
      >
        <Icon size={item.full ? 20 : 19} strokeWidth={1.9} />
      </span>

      <span className={cn("min-w-0", item.full ? "flex-1" : "mt-3 flex-1")}>
        <span className="accent-text display block text-[12px] leading-4">{title}</span>
        <span className="mt-1.5 block text-[10px] font-semibold leading-4 text-text-soft">{item.subtitle}</span>
      </span>

      <ChevronRight
        size={17}
        className={cn(
          "shrink-0 text-text-soft transition-transform duration-150 group-hover:translate-x-0.5",
          !item.full && "absolute bottom-3.5 right-3.5",
        )}
      />
    </Link>
  );
}

function SecondaryMenuCard({ mode, subtitle, marketId, index }: { mode: ModeKey; subtitle: string; marketId: string; index: number }) {
  const { title, Icon } = MODES[mode];

  return (
    <Link
      href={`/analyze/${encodeURIComponent(safeDecode(marketId))}/${mode}`}
      data-mode={mode}
      className="pressable animate-soft-pop depth-1 group flex min-h-[78px] items-center gap-3 rounded-3xl border p-3.5 text-left hover:border-border"
      style={{ animationDelay: `${Math.min(index, 8) * 28}ms` }}
    >
      <span className="depth-3 accent-text flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border">
        <Icon size={19} strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="accent-text display block text-[12px]">{title}</span>
        <span className="mt-1 block text-[10px] font-semibold leading-4 text-text-soft">{subtitle}</span>
      </span>
      <ChevronRight size={17} className="shrink-0 text-text-soft transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function ShareMenuCard({ index = 0 }: { index?: number }) {
  return (
    <Link
      href="/share-prediksi"
      data-mode="share-prediksi"
      className="pressable animate-soft-pop depth-3 group flex min-h-[72px] items-center gap-3 rounded-3xl border p-3.5 text-left hover:border-border hover:bg-white/[0.055]"
      style={{ animationDelay: `${Math.min(index, 8) * 28}ms` }}
    >
      <span className="depth-2 accent-text flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border">
        <Share2 size={19} strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="display block text-[12px] text-text">SHARE PREDIKSI</span>
        <span className="mt-1 block text-[10px] font-semibold leading-4 text-text-soft">Gabungkan dan bagikan beberapa pasaran</span>
      </span>
      <ChevronRight size={17} className="shrink-0 text-text-soft transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3 px-1">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-text-soft">{children}</p>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}

export default function AnalyzeMenuPage({ params }: { params: Promise<{ marketId: string }> }) {
  const { marketId } = use(params);
  const router = useRouter();
  const decodedMarketId = safeDecode(marketId);

  const { data: marketName = decodedMarketId } = useQuery({
    queryKey: ["marketName", decodedMarketId],
    queryFn: () => fetchMarketName(decodedMarketId),
    enabled: Boolean(decodedMarketId),
  });

  return (
    <div className="animate-rise space-y-4 pb-5">
      <PageTopBar title="Pilih Analisa" onBack={() => router.push("/")} />

      <section className="animate-soft-pop depth-accent rounded-3xl border p-4">
        <div className="flex items-center gap-3">
          <span className="depth-3 accent-text flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border">
            <Target size={21} strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="accent-text text-[10px] font-black uppercase tracking-[0.18em]">Pasaran Aktif</p>
            <h1 className="display mt-1 break-words text-xl leading-tight text-text">{marketName}</h1>
            <p className="mt-1.5 text-[10px] font-semibold leading-4 text-text-soft">Pilih metode analisa yang akan digunakan.</p>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>Analisa Utama</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          {MAIN_MENU.map((item, index) => (
            <AnalysisMenuCard key={item.mode} item={item} marketId={decodedMarketId} index={index} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Rekap & Bagikan</SectionTitle>
        <div className="space-y-2.5">
          <SecondaryMenuCard
            mode="rekap"
            subtitle="Gabungkan beberapa filter dalam satu hasil"
            marketId={decodedMarketId}
            index={MAIN_MENU.length}
          />
          <ShareMenuCard index={MAIN_MENU.length + 1} />
        </div>
      </section>
    </div>
  );
}
