"use client";

import { useEffect } from "react";

const ACCESS_CHECK_INTERVAL_MS = 30_000;

function loginUrl() {
  const next = `${window.location.pathname}${window.location.search}`;
  const params = new URLSearchParams({ next });
  return `/pin?${params.toString()}`;
}

export function AccessGuard() {
  useEffect(() => {
    let disposed = false;
    let redirecting = false;
    let requestInFlight = false;

    async function checkAccess() {
      if (disposed || redirecting || requestInFlight) return;
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
          redirecting = true;
          window.location.replace(loginUrl());
        }
      } catch {
        // Gangguan jaringan sementara tidak boleh mengeluarkan user dari aplikasi.
      } finally {
        requestInFlight = false;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void checkAccess();
    }

    void checkAccess();

    const intervalId = window.setInterval(() => {
      void checkAccess();
    }, ACCESS_CHECK_INTERVAL_MS);

    window.addEventListener("focus", checkAccess);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", checkAccess);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
