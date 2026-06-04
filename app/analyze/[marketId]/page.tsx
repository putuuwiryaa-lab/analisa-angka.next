"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { ANALYSIS_MENU, CUSTOM_MENU, MODES, type ModeKey } from "@/components/analysis/modes";
import { Button } from "@/components/ui/Button";

async function fetchMarketName(marketId: string) {
  const { data } = await supabase.from("markets").select("name").eq("id", marketId).maybeSingle();
  return data?.name || marketId;
}

function SubMenuCard({ label, mode, marketId }: { label: string; mode: ModeKey; marketId: string }) {
  const { Icon } = MODES[mode];
  return (
    <Link
      href={`/analyze/${marketId}/${mode}`}
      data-mode={mode}
      className="group relative flex min-h-[68px] w-full items-center gap-3 overflow-hidden rounded-2xl border border-border-soft bg-surface px-4 py-3 text-left transition active:scale-[0.985] hover:border-border"
    >
      <div className="accent-bg-soft absolute inset-y-5 left-0 w-1 rounded-r-full" />
      <div className="accent-border accent-text flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border bg-white/[0.03]">
        <Icon size={20} strokeWidth={1.9} />
      </div>
      <span className="accent-text display flex-1 text-[13px]">{label}</span>
      <ChevronRight size={18} className="text-text-soft" />
    </Link>
  );
}

export default function AnalyzeMenuPage({ params }: { params: Promise<{ marketId: string }> }) {
  const { marketId } = use(params);
  const router = useRouter();

  const { data: marketName = marketId } = useQuery({
    queryKey: ["marketName", marketId],
    queryFn: () => fetchMarketName(marketId),
    enabled: !!marketId,
  });

  return (
    <div className="animate-rise pb-4">
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => router.push("/")}>
        <ArrowLeft size={16} /> Beranda
      </Button>

      <div className="mb-5 rounded-2xl border border-border-soft bg-surface p-5">
        <div className="rounded-2xl border border-border-soft bg-black/20 px-4 py-7 text-center">
          <h3 className="display break-words text-2xl text-text sm:text-3xl">{marketName}</h3>
        </div>
      </div>

      <p className="mb-3 px-1 text-[11px] font-black uppercase tracking-wider text-text-soft">Pilih Analisa</p>
      <div className="grid grid-cols-1 gap-3">
        {ANALYSIS_MENU.map((item) => (
          <SubMenuCard key={item.mode} label={item.label} mode={item.mode} marketId={marketId} />
        ))}
      </div>

      <p className="mb-3 mt-5 px-1 text-[11px] font-black uppercase tracking-wider text-text-soft">Racik Angka</p>
      <div className="grid grid-cols-1 gap-3">
        {CUSTOM_MENU.map((item) => (
          <SubMenuCard key={item.mode} label={item.label} mode={item.mode} marketId={marketId} />
        ))}
      </div>
    </div>
  );
}
