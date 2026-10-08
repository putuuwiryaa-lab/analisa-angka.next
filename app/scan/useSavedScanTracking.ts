"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { mergeSavedScanUpdates, savedScanRequest } from "@/lib/shared/saved-scan-state";
import type { SavedScanRefreshResult } from "@/lib/shared/saved-scan";
import type { SavedTrek } from "./_lib";

export function useSavedScanTracking(
  savedTreks: SavedTrek[],
  setSavedTreks: Dispatch<SetStateAction<SavedTrek[]>>,
  storageReady: boolean,
  marketRevision: string,
) {
  const treksRef = useRef(savedTreks);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  useEffect(() => {
    treksRef.current = savedTreks;
  }, [savedTreks]);
  const trackingKey = JSON.stringify(
    savedTreks
      .filter((trek) => savedScanRequest(trek))
      .map((trek) => [
        trek.id,
        trek.marketId,
        trek.formula,
        trek.scanMode,
        trek.targetPos,
        trek.target2D,
        trek.target3D,
        trek.kolomHidup,
      ]),
  );

  useEffect(() => {
    if (!storageReady || trackingKey === "[]") return;
    let active = true;
    let inFlight = false;
    let controller: AbortController | null = null;
    async function refresh() {
      if (!active || inFlight || document.visibilityState === "hidden") return;
      const treks = treksRef.current.flatMap((saved) => {
        const request = savedScanRequest(saved);
        return request ? [request] : [];
      });
      if (!treks.length) return;
      inFlight = true;
      controller = new AbortController();
      setRefreshing(true);
      try {
        const response = await fetch("/api/scan/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ treks }),
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || !Array.isArray(payload.results))
          throw new Error(payload.error || "Gagal memperbarui trek.");
        if (!active) return;
        setSavedTreks((current) =>
          mergeSavedScanUpdates(current, payload.results as SavedScanRefreshResult[]),
        );
        setRefreshError("");
      } catch (reason) {
        if (!active || controller.signal.aborted) return;
        setRefreshError(reason instanceof Error ? reason.message : "Gagal memperbarui trek.");
      } finally {
        inFlight = false;
        if (active) setRefreshing(false);
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [storageReady, trackingKey, marketRevision, refreshVersion, setSavedTreks]);

  const refresh = useCallback(() => setRefreshVersion((value) => value + 1), []);
  return { refreshing: trackingKey !== "[]" && refreshing, refreshError, refresh };
}
