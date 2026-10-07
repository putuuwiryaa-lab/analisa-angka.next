"use client";

import { WorkspacePlaceholder } from "@/components/layout/WorkspacePlaceholder";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AutoScanItem,
  AutoScanResult,
  Posisi,
  ScanMode,
  Target2D,
  Target3D,
} from "@/lib/engine/types";
import { useMarketsQuery } from "@/lib/markets/useMarketsQuery";
import ScanFields from "./_components/ScanFields";
import ScanResultSection, { trekId } from "./_components/ScanResultSection";
import SavedTreksSection from "./_components/SavedTreksSection";
import TrekDetailModal from "./_components/TrekDetailModal";
import {
  buildSavedGroups,
  detailCopyText,
  LEGACY_STORAGE_KEY,
  liveDetail,
  MODE_OPTIONS,
  predictionValues,
  readStoredTreks,
  savedDetail,
  STORAGE_KEY,
} from "./_lib";
import type { DetailData, Market, SavedTrek } from "./_lib";

const MemoScanFields = memo(ScanFields);
const MemoScanResultSection = memo(ScanResultSection);
const MemoSavedTreksSection = memo(SavedTreksSection);

type CompletedScan = {
  marketId: string;
  marketName: string;
  result: AutoScanResult;
};

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

export default function ScanPageClient() {
  const {
    data: sharedMarkets = [],
    isPending: marketsPending,
    error: marketsQueryError,
  } = useMarketsQuery();
  const markets = sharedMarkets as Market[];
  const marketsLoading = marketsPending && markets.length === 0;
  const [marketId, setMarketId] = useState("");
  const [scanMode, setScanMode] = useState<ScanMode>("ai_2d_belakang");
  const [targetPos, setTargetPos] = useState<Posisi>("K");
  const [target2D, setTarget2D] = useState<Target2D>("belakang");
  const [target3D, setTarget3D] = useState<Target3D>("belakang");
  const [rounds, setRounds] = useState(14);
  const [patah, setPatah] = useState(0);
  const [digitCount, setDigitCount] = useState(4);
  const [stopScan, setStopScan] = useState(1);
  const [completedScan, setCompletedScan] = useState<CompletedScan | null>(null);
  const [viewItem, setViewItem] = useState<AutoScanItem | null>(null);
  const [viewSaved, setViewSaved] = useState<SavedTrek | null>(null);
  const [savedTreks, setSavedTreks] = useState<SavedTrek[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [savedId, setSavedId] = useState("");
  const scanVersionRef = useRef(0);

  useEffect(() => {
    setSavedTreks(readStoredTreks());
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (marketId || markets.length === 0) return;
    const defaultMarket =
      markets.find((market) => /singapore|sgp/i.test(`${market.id} ${market.name}`)) ?? markets[0];
    if (defaultMarket) setMarketId(defaultMarket.id);
  }, [marketId, markets]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedTreks));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // State sesi tetap tersedia walau penyimpanan browser ditolak.
    }
  }, [savedTreks, storageReady]);

  const selectedMarket = useMemo(
    () => markets.find((market) => market.id === marketId) ?? null,
    [marketId, markets],
  );
  const result = completedScan?.result ?? null;
  const title = useMemo(
    () =>
      String(
        completedScan?.marketName || selectedMarket?.name || selectedMarket?.id || "Pasaran",
      ).toUpperCase(),
    [completedScan?.marketName, selectedMarket?.id, selectedMarket?.name],
  );
  const savedGroups = useMemo(() => buildSavedGroups(savedTreks), [savedTreks]);
  const marketsError =
    marketsQueryError instanceof Error
      ? marketsQueryError.message
      : marketsQueryError
        ? "Gagal memuat pasaran."
        : "";
  const visibleError = error || marketsError;

  const invalidateScanOutput = useCallback(() => {
    scanVersionRef.current += 1;
    setCompletedScan(null);
    setViewItem(null);
    setViewSaved(null);
    setSavedId("");
    setError("");
    setLoading(false);
  }, []);

  const changeMarket = useCallback(
    (value: string) => {
      if (value === marketId) return;
      invalidateScanOutput();
      setMarketId(value);
    },
    [invalidateScanOutput, marketId],
  );

  const changeMode = useCallback(
    (mode: ScanMode) => {
      if (mode === scanMode) return;
      invalidateScanOutput();
      setScanMode(mode);
      setDigitCount(MODE_OPTIONS.find((item) => item.value === mode)?.digits ?? 7);
    },
    [invalidateScanOutput, scanMode],
  );

  const changeRounds = useCallback(
    (value: number) => {
      if (value === rounds) return;
      invalidateScanOutput();
      setRounds(value);
      setPatah((current) => Math.min(current, value));
    },
    [invalidateScanOutput, rounds],
  );

  const changePatah = useCallback(
    (value: number) => {
      if (value === patah) return;
      invalidateScanOutput();
      setPatah(value);
    },
    [invalidateScanOutput, patah],
  );

  const changeTargetPos = useCallback(
    (value: Posisi) => {
      if (value === targetPos) return;
      invalidateScanOutput();
      setTargetPos(value);
    },
    [invalidateScanOutput, targetPos],
  );

  const changeTarget2D = useCallback(
    (value: Target2D) => {
      if (value === target2D) return;
      invalidateScanOutput();
      setTarget2D(value);
    },
    [invalidateScanOutput, target2D],
  );

  const changeTarget3D = useCallback(
    (value: Target3D) => {
      if (value === target3D) return;
      invalidateScanOutput();
      setTarget3D(value);
    },
    [invalidateScanOutput, target3D],
  );

  const changeDigitCount = useCallback(
    (value: number) => {
      if (value === digitCount) return;
      invalidateScanOutput();
      setDigitCount(value);
    },
    [digitCount, invalidateScanOutput],
  );

  const changeStopScan = useCallback(
    (value: number) => {
      if (value === stopScan) return;
      invalidateScanOutput();
      setStopScan(value);
    },
    [invalidateScanOutput, stopScan],
  );

  const runScan = useCallback(async () => {
    if (!marketId) {
      setError("Pilih pasaran terlebih dahulu.");
      return;
    }

    const requestVersion = scanVersionRef.current + 1;
    scanVersionRef.current = requestVersion;
    const request = {
      marketId,
      scanMode,
      targetPos,
      target2D,
      target3D,
      rounds,
      patah,
      digitCount,
      stopScan,
    };
    const requestMarket = selectedMarket;

    setLoading(true);
    setError("");
    setCompletedScan(null);
    setViewItem(null);
    setViewSaved(null);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: request.marketId,
          scanMode: request.scanMode,
          targetPos: request.targetPos,
          target2D: request.target2D,
          target3D: request.target3D,
          L: request.rounds,
          patah: request.patah,
          digitCount: request.digitCount,
          stopScan: request.stopScan,
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.error) throw new Error(data?.error || "Scan gagal.");
      if (requestVersion !== scanVersionRef.current) return;

      setCompletedScan({
        marketId: request.marketId,
        marketName: String(data.market || requestMarket?.name || requestMarket?.id || "Pasaran"),
        result: data.result,
      });
    } catch (reason) {
      if (requestVersion !== scanVersionRef.current) return;
      setError(reason instanceof Error ? reason.message : "Scan gagal.");
    } finally {
      if (requestVersion === scanVersionRef.current) setLoading(false);
    }
  }, [
    digitCount,
    marketId,
    patah,
    rounds,
    scanMode,
    selectedMarket,
    stopScan,
    target2D,
    target3D,
    targetPos,
  ]);

  const saveTrek = useCallback(
    (item: AutoScanItem) => {
      if (!completedScan) return;

      const completedMarketId = completedScan.marketId;
      const completedMarketName = completedScan.marketName.toUpperCase();
      const completedResult = completedScan.result;
      const id = trekId(completedMarketId, item);
      const saved: SavedTrek = {
        version: 2,
        id,
        savedAt: new Date().toISOString(),
        marketId: completedMarketId,
        marketName: completedMarketName,
        scanMode: item.scanMode,
        targetPos: item.targetPos,
        target2D: item.target2D,
        target3D: item.target3D,
        digitCount: completedResult.config.digitCount,
        L: completedResult.config.L,
        patah: completedResult.config.patah,
        formula: item.formula,
        code: item.code,
        kolomHidup: [...item.kolomHidup],
        activeColumns: item.activeColumns,
        predictionValues: predictionValues(item),
        snapshotRows: item.result.rows.map((row) => ({
          ...row,
          deret: [...row.deret],
          targetDigits:
            Array.isArray(row.targetDigits) && row.targetDigits.length
              ? [...row.targetDigits]
              : [row.targetDigit],
        })),
        savedLatestDraw: item.result.latestDraw,
      };
      setSavedTreks((current) => [saved, ...current.filter((trek) => trek.id !== id)].slice(0, 50));
      setSavedId(id);
      window.setTimeout(() => setSavedId(""), 1400);
    },
    [completedScan],
  );

  const deleteTrek = useCallback((id: string) => {
    setSavedTreks((current) => current.filter((item) => item.id !== id));
    setViewSaved((current) => (current?.id === id ? null : current));
  }, []);

  const copyDetail = useCallback(async (detail: DetailData, id: string) => {
    await copyText(detailCopyText(detail));
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(""), 1400);
  }, []);

  const viewLiveItem = useCallback((item: AutoScanItem) => {
    setViewSaved(null);
    setViewItem(item);
  }, []);

  const viewSavedTrek = useCallback((item: SavedTrek) => {
    setViewItem(null);
    setViewSaved(item);
  }, []);

  const closeLiveItem = useCallback(() => setViewItem(null), []);
  const closeSavedTrek = useCallback(() => setViewSaved(null), []);

  const liveDigitCount = result?.config.digitCount ?? digitCount;
  const live = useMemo(
    () => (viewItem ? liveDetail(viewItem, title, liveDigitCount) : null),
    [liveDigitCount, title, viewItem],
  );
  const saved = useMemo(() => (viewSaved ? savedDetail(viewSaved) : null), [viewSaved]);

  const copyLiveDetail = useCallback(() => {
    if (!live) return;
    void copyDetail(live, viewItem?.code ?? "live");
  }, [copyDetail, live, viewItem?.code]);

  const copySavedDetail = useCallback(() => {
    if (!saved || !viewSaved) return;
    void copyDetail(saved, viewSaved.id);
  }, [copyDetail, saved, viewSaved]);

  return (
    <div className="animate-fade-in desktop-workspace space-y-4">
      <div className="desktop-controls space-y-4">
        <MemoScanFields
          markets={markets}
          marketId={marketId}
          selectedMarket={selectedMarket}
          marketsLoading={marketsLoading}
          rounds={rounds}
          patah={patah}
          scanMode={scanMode}
          targetPos={targetPos}
          target2D={target2D}
          target3D={target3D}
          digitCount={digitCount}
          stopScan={stopScan}
          loading={loading}
          onMarketChange={changeMarket}
          onRoundsChange={changeRounds}
          onPatahChange={changePatah}
          onModeChange={changeMode}
          onTargetPosChange={changeTargetPos}
          onTarget2DChange={changeTarget2D}
          onTarget3DChange={changeTarget3D}
          onDigitCountChange={changeDigitCount}
          onStopScanChange={changeStopScan}
          onScan={runScan}
        />
        {visibleError ? (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 p-3 text-sm font-bold text-danger">
            {visibleError}
          </div>
        ) : null}
      </div>
      <div className="desktop-results space-y-4">
        {completedScan ? (
          <MemoScanResultSection
            result={completedScan.result}
            marketTitle={title}
            marketId={completedScan.marketId}
            savedId={savedId}
            onSave={saveTrek}
            onView={viewLiveItem}
          />
        ) : (
          <WorkspacePlaceholder
            title="Hasil Scan"
            description="Atur parameter di panel kiri lalu jalankan Scan. Hasil rumus dan trek tersimpan akan tampil di sini."
            busy={loading}
          />
        )}
        <MemoSavedTreksSection
          total={savedTreks.length}
          groups={savedGroups}
          onView={viewSavedTrek}
          onDelete={deleteTrek}
        />
      </div>
      {live ? (
        <TrekDetailModal
          data={live}
          copied={copiedId === viewItem?.code}
          onCopy={copyLiveDetail}
          onClose={closeLiveItem}
        />
      ) : null}
      {saved && viewSaved ? (
        <TrekDetailModal
          data={saved}
          copied={copiedId === viewSaved.id}
          onCopy={copySavedDetail}
          onClose={closeSavedTrek}
        />
      ) : null}
    </div>
  );
}
