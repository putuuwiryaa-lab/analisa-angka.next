"use client";

import { useEffect } from "react";

const ACCESS_CHECK_INTERVAL_MS = 8 * 60 * 60 * 1000;
const ACCESS_RETRY_INITIAL_MS = 30 * 1000;
const ACCESS_RETRY_MAX_MS = 15 * 60 * 1000;
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
  const checkedAt = Date.now();

  try {
    window.localStorage.setItem(ACCESS_CHECK_STORAGE_KEY, String(checkedAt));
  } catch {
    // Local storage dapat diblokir pada mode privasi tertentu.
  }

  return checkedAt;
}

function clearCheckedAt() {
  try {
    window.localStorage.removeItem(ACCESS_CHECK_STORAGE_KEY);
  } catch {
    // Abaikan bila local storage tidak tersedia.
  }
}

export function AccessGuard() {
  useEffect(() => {
    let disposed = false;
    let redirecting = false;
    let requestInFlight = false;
    let timeoutId: number | null = null;
    let checkedAt = lastCheckedAt();
    let retryDelayMs = ACCESS_RETRY_INITIAL_MS;

    function latestCheckedAt() {
      checkedAt = Math.max(checkedAt, lastCheckedAt());
      return checkedAt;
    }

    function checkIsDue() {
      return Date.now() - latestCheckedAt() >= ACCESS_CHECK_INTERVAL_MS;
    }

    function clearScheduledCheck() {
      if (timeoutId === null) return;
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }

    function scheduleCheck(delayMs: number) {
      if (disposed || redirecting) return;
      clearScheduledCheck();

      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        void checkAccess();
      }, delayMs);
    }

    function scheduleNextCheck() {
      const elapsed = Date.now() - latestCheckedAt();
      const remaining = Math.max(1_000, ACCESS_CHECK_INTERVAL_MS - elapsed);
      scheduleCheck(remaining);
    }

    function scheduleRetryCheck() {
      const delayMs = retryDelayMs;
      retryDelayMs = Math.min(ACCESS_RETRY_MAX_MS, retryDelayMs * 2);
      scheduleCheck(delayMs);
    }

    async function checkAccess() {
      if (disposed || redirecting || requestInFlight) return;

      if (!checkIsDue()) {
        scheduleNextCheck();
        return;
      }

      clearScheduledCheck();
      requestInFlight = true;
      let nextSchedule: "normal" | "retry" | null = null;

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
          checkedAt = 0;
          clearCheckedAt();
          redirecting = true;
          window.location.replace(loginUrl());
          return;
        }

        if (!response.ok) {
          nextSchedule = "retry";
          return;
        }

        checkedAt = markCheckedNow();
        retryDelayMs = ACCESS_RETRY_INITIAL_MS;
        nextSchedule = "normal";
      } catch {
        // Gangguan jaringan sementara tidak boleh mengeluarkan user dari aplikasi.
        if (!disposed) nextSchedule = "retry";
      } finally {
        requestInFlight = false;
        if (disposed || redirecting) return;

        if (nextSchedule === "normal") scheduleNextCheck();
        if (nextSchedule === "retry") scheduleRetryCheck();
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
      clearScheduledCheck();
      window.removeEventListener("focus", checkAccess);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
