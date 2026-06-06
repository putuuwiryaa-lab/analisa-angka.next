"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Lock } from "lucide-react";
import { VipLoginPanel } from "@/components/auth/VipLoginPanel";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/Button";
import { UpgradeLockPanel } from "@/components/upgrade/UpgradeLockPanel";
import { canUseStatistics } from "@/lib/access/freeAccess";

export default function StatisticsAccessLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { role } = useAuth();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  function openLoginPanel() {
    setUpgradeOpen(false);
    setLoginOpen(true);
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
          Statistik dibatasi untuk pengguna Free agar performa server tetap stabil. Login VIP untuk membuka ranking statistik.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button size="lg" onClick={() => setUpgradeOpen(true)}>
            <Lock size={16} /> Aktivasi VIP
          </Button>
          <Button variant="ghost" size="lg" onClick={openLoginPanel}>
            <KeyRound size={16} /> Login VIP
          </Button>
        </div>
      </div>

      <UpgradeLockPanel open={upgradeOpen} onClose={() => setUpgradeOpen(false)} onOpenPin={openLoginPanel} title="Statistik VIP" />
      <VipLoginPanel open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
