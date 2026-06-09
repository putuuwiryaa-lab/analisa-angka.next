"use client";

import type { ReactNode } from "react";

// Auth tidak lagi memblok tampilan. Role di-resolve di background oleh AuthProvider,
// sehingga first paint tidak menunggu /api/verify. Komponen ini kini sekadar
// pembungkus agar layout.tsx tidak perlu ikut diubah.
export function AuthGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
