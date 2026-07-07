"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function isAdminPath(pathname: string | null) {
  return pathname === "/admin" || Boolean(pathname?.startsWith("/admin/"));
}

export function ServiceWorkerRegister() {
  const pathname = usePathname();

  useEffect(() => {
    if (isAdminPath(pathname)) return;

    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* abaikan kalau gagal daftar */
      });
    }
  }, [pathname]);

  return null;
}
