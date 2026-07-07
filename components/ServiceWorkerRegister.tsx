"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function isAdminPath(pathname: string | null) {
  return pathname === "/admin" || Boolean(pathname?.startsWith("/admin/"));
}

function removeManifestLink() {
  document.querySelectorAll('link[rel="manifest"]').forEach((item) => item.remove());
}

function ensureManifestLink() {
  if (document.querySelector('link[rel="manifest"]')) return;

  const link = document.createElement("link");
  link.rel = "manifest";
  link.href = "/manifest.webmanifest";
  document.head.appendChild(link);
}

export function ServiceWorkerRegister() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (isAdminPath(pathname)) {
      removeManifestLink();
      return;
    }

    ensureManifestLink();

    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* abaikan kalau gagal daftar */
      });
    }
  }, [pathname]);

  return null;
}
