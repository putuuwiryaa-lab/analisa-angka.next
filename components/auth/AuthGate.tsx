"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

const PUBLIC_PATHS = ["/kode-login"];
const TOKEN_KEYS = ["aa_token", "supreme_token"];
const AUTH_KEYS = [
  "aa_token",
  "aa_role",
  "aa_expires_at",
  "aa_telegram_user_id",
  "supreme_token",
  "supreme_role",
  "supreme_device_id",
  "supreme_display_code",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function getStoredToken() {
  for (const key of TOKEN_KEYS) {
    const token = localStorage.getItem(key);
    if (token) return token;
  }

  return "";
}

function clearStoredAuth() {
  AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
}

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "allowed">("checking");

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (isPublicPath(pathname)) {
        setStatus("allowed");
        return;
      }

      const token = getStoredToken();

      if (!token) {
        clearStoredAuth();
        router.replace(`/kode-login?from=${encodeURIComponent(pathname || "/")}`);
        return;
      }

      setStatus("checking");

      try {
        const response = await fetch("/api/verify-session", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await response.json().catch(() => ({}));

        if (!cancelled && response.ok && json.success) {
          localStorage.setItem("aa_token", token);
          localStorage.setItem("aa_role", json.role || "TRIAL");
          localStorage.setItem("aa_expires_at", json.expires_at || "");
          localStorage.setItem("aa_telegram_user_id", String(json.telegram_user_id || ""));
          localStorage.setItem("supreme_token", token);
          localStorage.setItem("supreme_role", json.role || "TRIAL");
          setStatus("allowed");
          return;
        }
      } catch {
        // Lanjut ke redirect di bawah.
      }

      if (!cancelled) {
        clearStoredAuth();
        router.replace(`/kode-login?from=${encodeURIComponent(pathname || "/")}`);
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (status !== "allowed") {
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
