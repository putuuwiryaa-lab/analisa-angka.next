"use client";

import type { ReactNode } from "react";

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAuth(): any {
  return { token: "", verifying: false, loading: false };
}
