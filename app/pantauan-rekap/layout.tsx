"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Lock } from "lucide-react";
import { PinActivationPanel } from "@/components/auth/PinActivationPanel";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/Button";
import { UpgradeLockPanel } from "@/components/upgrade/UpgradeLockPanel";
import { canUseStatistics } from "@/lib/access/freeAccess";

export default function StatisticsAccessLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { role } = useAuth();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  function openPinPanel() {
    setUpgradeOpen(false);
    setPinOpen(true);
  }

  if (canUseStatistics(role)) return <>{children}</>;

  return (
    <div className="animate-rise space-y-5 pb-4">
      <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
        <ArrowLeft size={16} /> Beranda
      </Button>

      <div className="depth-1 rounded-3xl border p-6 text-center">
        <div className="depth-3 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border text-primary-soft">
          <Lock size={24} />
        </div>
        <p className="display text-xl text-text">Statistik VIP</p>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-text-muted">
          Statistik pasaran tersedia untuk VIP. Aktivasi PIN untuk membuka ranking statistik dan semua mode lanjutan.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button size="lg" onClick={() => setUpgradeOpen(true)}>
            <Lock size={16} /> Aktivasi VIP
          </Button>
          <Button variant="ghost" size="lg" onClick={openPinPanel}>
            <KeyRound size={16} /> Masukkan PIN
          </Button>
        </div>
      </div>

      <UpgradeLockPanel open={upgradeOpen} onClose={() => setUpgradeOpen(false)} onOpenPin={openPinPanel} title="Statistik VIP" />
      <PinActivationPanel open={pinOpen} onClose={() => setPinOpen(false)} />
    </div>
  );
}
