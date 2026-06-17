"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";

const PUBLIC_PATHS = ["/kode-login", "/theme-preview"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, verifying } = useAuth();
  const publicPath = isPublicPath(pathname);

  useEffect(() => {
    if (publicPath || verifying || token) return;
    router.replace(`/kode-login?from=${encodeURIComponent(pathname || "/")}`);
  }, [pathname, publicPath, router, token, verifying]);

  if (publicPath) {
    return <>{children}</>;
  }

  if (verifying || !token) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center px-6 text-center">
        <div className="depth-1 rounded-3xl border p-5 text-sm font-bold text-text-muted">
          Memeriksa akses...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
