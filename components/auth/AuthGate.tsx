"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "./auth-context";
import { LoginGate } from "./LoginGate";
import { Logo } from "@/components/ui/Logo";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-surface ring-1 ring-white/10">
        <Logo className="h-10 w-10" />
      </div>
      <div className="flex items-center gap-2 text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Memverifikasi akses…</span>
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "LOADING") return <LoadingScreen />;
  if (status !== "READY") return <LoginGate />;
  return <>{children}</>;
}
