"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Lock } from "lucide-react";
import { ANALYSIS_MENU, CUSTOM_MENU, MODES, type ModeKey } from "@/components/analysis/modes";
import { PinActivationPanel } from "@/components/auth/PinActivationPanel";
import { useAuth } from "@/components/auth/auth-context";
import { UpgradeLockPanel } from "@/components/upgrade/UpgradeLockPanel";
import { Button } from "@/components/ui/Button";
import { isModeLockedForRole } from "@/lib/access/freeAccess";

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

function VipBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/12 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-primary-soft">
      <Lock size={10} /> VIP
    </span>
  );
}

function SubMenuCard({
  label,
  mode,
  marketId,
  locked = false,
  onLockedClick,
  index = 0,
}: {
  label: string;
  mode: ModeKey;
  marketId: string;
  locked?: boolean;
  onLockedClick?: () => void;
  index?: number;
}) {
  const { Icon } = MODES[mode];
  const className = `pressable animate-soft-pop depth-1 group relative flex min-h-[72px] w-full items-center gap-3 overflow-hidden rounded-3xl border px-4 py-3 text-left hover:border-border ${
    locked ? "opacity-80 hover:bg-white/[0.045]" : ""
  }`;
  const content = (
    <>
      <div className="absolute inset-y-5 left-0 w-1 rounded-r-full bg-[var(--accent)] opacity-70" />
      <div className="depth-3 accent-text flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-transform duration-150 group-hover:scale-[1.035]">
        {locked ? <Lock size={20} strokeWidth={1.9} /> : <Icon size={20} strokeWidth={1.9} />}
      </div>
      <span className="accent-text display flex-1 text-[13px]">{label}</span>
      {locked ? (
        <VipBadge />
      ) : (
        <ChevronRight size={18} className="text-text-soft transition-transform duration-150 group-hover:translate-x-0.5" />
      )}
    </>
  );

  if (locked) {
    return (
      <button
        type="button"
        data-mode={mode}
        onClick={onLockedClick}
        className={className}
        style={{ animationDelay: `${Math.min(index, 8) * 28}ms` }}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={`/analyze/${encodeURIComponent(safeDecode(marketId))}/${mode}`}
      data-mode={mode}
      className={className}
      style={{ animationDelay: `${Math.min(index, 8) * 28}ms` }}
    >
      {content}
    </Link>
  );
}

export default function AnalyzeMenuPage({ params }: { params: Promise<{ marketId: string }> }) {
  const { marketId } = use(params);
  const router = useRouter();
  const { role } = useAuth();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const decodedMarketId = safeDecode(marketId);

  const { data: marketName = decodedMarketId } = useQuery({
    queryKey: ["marketName", decodedMarketId],
    queryFn: () => fetchMarketName(decodedMarketId),
    enabled: !!decodedMarketId,
  });

  function openPinPanel() {
    setUpgradeOpen(false);
    setPinOpen(true);
  }

  return (
    <div className="animate-rise pb-4">
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => router.push("/")}>
        <ArrowLeft size={16} /> Beranda
      </Button>

      <div className="animate-soft-pop depth-1 mb-5 rounded-3xl border p-4">
        <div className="depth-2 rounded-3xl border px-4 py-7 text-center">
          <h3 className="display break-words text-2xl text-text sm:text-3xl">{marketName}</h3>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-3 px-1">
        <p className="text-[11px] font-black uppercase tracking-wider text-text-soft">Pilih Analisa</p>
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <div className="grid grid-cols-1 gap-3">
        {ANALYSIS_MENU.map((item, index) => (
          <SubMenuCard
            key={item.mode}
            label={item.label}
            mode={item.mode}
            marketId={decodedMarketId}
            locked={isModeLockedForRole(role, item.mode)}
            onLockedClick={() => setUpgradeOpen(true)}
            index={index}
          />
        ))}
      </div>

      <div className="mb-3 mt-5 flex items-center gap-3 px-1">
        <p className="text-[11px] font-black uppercase tracking-wider text-text-soft">Racik Angka</p>
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <div className="grid grid-cols-1 gap-3">
        {CUSTOM_MENU.map((item, index) => (
          <SubMenuCard
            key={item.mode}
            label={item.label}
            mode={item.mode}
            marketId={decodedMarketId}
            locked={isModeLockedForRole(role, item.mode)}
            onLockedClick={() => setUpgradeOpen(true)}
            index={ANALYSIS_MENU.length + index}
          />
        ))}
      </div>

      <UpgradeLockPanel open={upgradeOpen} onClose={() => setUpgradeOpen(false)} onOpenPin={openPinPanel} />
      <PinActivationPanel open={pinOpen} onClose={() => setPinOpen(false)} />
    </div>
  );
}
