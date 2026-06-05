"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { ANALYSIS_MENU, CUSTOM_MENU, MODES, type ModeKey } from "@/components/analysis/modes";
import { Button } from "@/components/ui/Button";

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
  const response = await fetch("/api/markets", { cache: "no-store" });
  const json = await response.json();
  const decodedMarketId = safeDecode(marketId);

  if (!response.ok || !Array.isArray(json)) return decodedMarketId;

  const requestedId = normalizeId(marketId);
  const market = json.find((item: any) => {
    const id = item?.id ? normalizeId(String(item.id)) : "";
    const name = item?.name ? normalizeId(String(item.name)) : "";
    return id === requestedId || name === requestedId;
  });

  return market?.name || market?.id || decodedMarketId;
}

function SubMenuCard({
  label,
  mode,
  marketId,
  index = 0,
}: {
  label: string;
  mode: ModeKey;
  marketId: string;
  index?: number;
}) {
  const { Icon } = MODES[mode];
  return (
    <Link
      href={`/analyze/${encodeURIComponent(safeDecode(marketId))}/${mode}`}
      data-mode={mode}
      className="pressable animate-soft-pop group relative flex min-h-[72px] w-full items-center gap-3 overflow-hidden rounded-3xl border border-border-soft bg-surface px-4 py-3 text-left hover:border-border hover:bg-surface-2"
      style={{ animationDelay: `${Math.min(index, 8) * 28}ms` }}
    >
      <div className="accent-bg-soft absolute inset-y-5 left-0 w-1 rounded-r-full" />
      <div className="accent-border accent-text flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border bg-white/[0.035] transition-transform duration-150 group-hover:scale-[1.035]">
        <Icon size={20} strokeWidth={1.9} />
      </div>
      <span className="accent-text display flex-1 text-[13px]">{label}</span>
      <ChevronRight size={18} className="text-text-soft transition-transform duration-150 group-hover:translate-x-0.5" />
    </Link>
  );
}

export default function AnalyzeMenuPage({ params }: { params: Promise<{ marketId: string }> }) {
  const { marketId } = use(params);
  const router = useRouter();
  const decodedMarketId = safeDecode(marketId);

  const { data: marketName = decodedMarketId } = useQuery({
    queryKey: ["marketName", decodedMarketId],
    queryFn: () => fetchMarketName(decodedMarketId),
    enabled: !!decodedMarketId,
  });

  return (
    <div className="animate-rise pb-4">
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => router.push("/")}>
        <ArrowLeft size={16} /> Beranda
      </Button>

      <div className="animate-soft-pop mb-5 rounded-3xl border border-border-soft bg-surface p-4">
        <div className="rounded-3xl border border-border-soft bg-black/15 px-4 py-7 text-center">
          <h3 className="display break-words text-2xl text-text sm:text-3xl">{marketName}</h3>
        </div>
      </div>

      <p className="mb-3 px-1 text-[11px] font-black uppercase tracking-wider text-text-soft">Pilih Analisa</p>
      <div className="grid grid-cols-1 gap-3">
        {ANALYSIS_MENU.map((item, index) => (
          <SubMenuCard key={item.mode} label={item.label} mode={item.mode} marketId={decodedMarketId} index={index} />
        ))}
      </div>

      <p className="mb-3 mt-5 px-1 text-[11px] font-black uppercase tracking-wider text-text-soft">Racik Angka</p>
      <div className="grid grid-cols-1 gap-3">
        {CUSTOM_MENU.map((item, index) => (
          <SubMenuCard
            key={item.mode}
            label={item.label}
            mode={item.mode}
            marketId={decodedMarketId}
            index={ANALYSIS_MENU.length + index}
          />
        ))}
      </div>
    </div>
  );
}
