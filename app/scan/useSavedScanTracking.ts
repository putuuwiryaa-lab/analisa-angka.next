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
import { savedScanRevision } from "@/lib/shared/saved-scan";
import type { SavedScanSyncInfo } from "@/lib/shared/saved-scan-sync";
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
  const [verification, setVerification] = useState<{
    signature: string;
    checkedAt: string;
    statusById: SavedScanSyncInfo["statusById"];
  } | null>(null);
  useEffect(() => {
    treksRef.current = savedTreks;
  }, [savedTreks]);
  const trackingKey = JSON.stringify(
    savedTreks
      .filter((trek) => savedScanRequest(trek))
      .map((trek) => [
        trek.id,
        trek.savedAt,
        trek.marketId,
        trek.formula,
        trek.scanMode,
        trek.targetPos,
        trek.target2D,
        trek.target3D,
        trek.kolomHidup,
      ]),
  );

  const signature = JSON.stringify([trackingKey, marketRevision]);

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
      setRefreshError("");
      try {
        const response = await fetch("/api/scan/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ treks }),
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok || !Array.isArray(payload.results))
          throw new Error(payload.error || "Gagal memperbarui trek.");

        const results = payload.results as SavedScanRefreshResult[];
        const expected = new Map(treks.map((trek) => [trek.id, savedScanRevision(trek)]));
        const seen = new Set<string>();
        const statusById: SavedScanSyncInfo["statusById"] = {};
        for (const result of results) {
          if (
            !result ||
            typeof result.id !== "string" ||
            seen.has(result.id) ||
            result.revision !== expected.get(result.id) ||
            (!result.error && (!result.update || result.update.revision !== result.revision))
          ) {
            throw new Error("Respons sinkronisasi trek tidak lengkap atau tidak sesuai.");
          }
          seen.add(result.id);
          statusById[result.id] = result.error ? "failed" : "synced";
        }
        if (seen.size !== expected.size)
          throw new Error("Sebagian trek belum diperiksa. Silakan perbarui kembali.");
        if (!active) return;
        setSavedTreks((current) => mergeSavedScanUpdates(current, results));
        setVerification({
          signature,
          checkedAt: new Date().toISOString(),
          statusById,
        });
        setRefreshError("");
      } catch (reason) {
        if (!active || controller.signal.aborted) return;
        setVerification(null);
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
  }, [storageReady, trackingKey, marketRevision, signature, refreshVersion, setSavedTreks]);

  const refresh = useCallback(() => setRefreshVersion((value) => value + 1), []);
  const verified = verification?.signature === signature ? verification : null;
  const syncInfo: SavedScanSyncInfo = {
    refreshing: trackingKey !== "[]" && refreshing,
    refreshError,
    statusById: verified?.statusById ?? {},
    checkedAt: verified?.checkedAt ?? null,
  };
  return { ...syncInfo, refresh, syncInfo };
}
