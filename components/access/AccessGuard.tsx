"use client";

import { useEffect } from "react";

const ACCESS_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const ACCESS_CHECK_STORAGE_KEY = "analisa_access_checked_at";

function loginUrl() {
  const next = `${window.location.pathname}${window.location.search}`;
  const params = new URLSearchParams({ next });
  return `/pin?${params.toString()}`;
}

function lastCheckedAt() {
  try {
    const value = Number(window.localStorage.getItem(ACCESS_CHECK_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function markCheckedNow() {
  try {
    window.localStorage.setItem(ACCESS_CHECK_STORAGE_KEY, String(Date.now()));
  } catch {
    // Local storage dapat diblokir pada mode privasi tertentu.
  }
}

function clearCheckedAt() {
  try {
    window.localStorage.removeItem(ACCESS_CHECK_STORAGE_KEY);
  } catch {
    // Abaikan bila local storage tidak tersedia.
  }
}

function checkIsDue() {
  return Date.now() - lastCheckedAt() >= ACCESS_CHECK_INTERVAL_MS;
}

export function AccessGuard() {
  useEffect(() => {
    let disposed = false;
    let redirecting = false;
    let requestInFlight = false;
    let timeoutId: number | null = null;

    function scheduleNextCheck() {
      if (disposed) return;
      if (timeoutId !== null) window.clearTimeout(timeoutId);

      const elapsed = Date.now() - lastCheckedAt();
      const remaining = Math.max(1_000, ACCESS_CHECK_INTERVAL_MS - elapsed);

      timeoutId = window.setTimeout(() => {
        void checkAccess();
      }, remaining);
    }

    async function checkAccess() {
      if (disposed || redirecting || requestInFlight) return;

      if (!checkIsDue()) {
        scheduleNextCheck();
        return;
      }

      requestInFlight = true;

      try {
        const response = await fetch("/api/access/status", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
        });

        if (disposed) return;

        if (response.status === 401 || response.status === 403) {
          clearCheckedAt();
          redirecting = true;
          window.location.replace(loginUrl());
          return;
        }

        if (response.ok) markCheckedNow();
      } catch {
        // Gangguan jaringan sementara tidak boleh mengeluarkan user dari aplikasi.
      } finally {
        requestInFlight = false;
        if (!redirecting) scheduleNextCheck();
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void checkAccess();
    }

    void checkAccess();

    window.addEventListener("focus", checkAccess);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      window.removeEventListener("focus", checkAccess);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
