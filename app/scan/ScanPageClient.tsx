"use client";

import { useEffect, useMemo, useState } from "react";
import type { AutoScanItem, AutoScanResult, Posisi, ScanMode, Target2D, Target3D } from "@/lib/engine/types";
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
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketId, setMarketId] = useState("");
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [scanMode, setScanMode] = useState<ScanMode>("ai_2d_belakang");
  const [targetPos, setTargetPos] = useState<Posisi>("K");
  const [target2D, setTarget2D] = useState<Target2D>("belakang");
  const [target3D, setTarget3D] = useState<Target3D>("belakang");
  const [rounds, setRounds] = useState(14);
  const [patah, setPatah] = useState(0);
  const [digitCount, setDigitCount] = useState(4);
  const [stopScan, setStopScan] = useState(3);
  const [marketName, setMarketName] = useState("");
  const [result, setResult] = useState<AutoScanResult | null>(null);
  const [viewItem, setViewItem] = useState<AutoScanItem | null>(null);
  const [viewSaved, setViewSaved] = useState<SavedTrek | null>(null);
  const [savedTreks, setSavedTreks] = useState<SavedTrek[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [savedId, setSavedId] = useState("");

  useEffect(() => {
    fetch("/api/markets")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Gagal memuat pasaran.");
        return Array.isArray(data) ? data : [];
      })
      .then((data: Market[]) => {
        setMarkets(data);
        const defaultMarket = data.find((market) => /singapore|sgp/i.test(`${market.id} ${market.name}`)) ?? data[0];
        if (defaultMarket) setMarketId(defaultMarket.id);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Gagal memuat pasaran."))
      .finally(() => setMarketsLoading(false));
    setSavedTreks(readStoredTreks());
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedTreks));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // State sesi tetap tersedia walau penyimpanan browser ditolak.
    }
  }, [savedTreks, storageReady]);

  useEffect(() => {
    if (!viewItem && !viewSaved) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setViewItem(null);
        setViewSaved(null);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [viewItem, viewSaved]);

  const selectedMarket = markets.find((market) => market.id === marketId) ?? null;
  const title = String(marketName || selectedMarket?.name || selectedMarket?.id || "Pasaran").toUpperCase();
  const savedGroups = useMemo(() => buildSavedGroups(savedTreks), [savedTreks]);

  function changeMode(mode: ScanMode) {
    setScanMode(mode);
    setDigitCount(MODE_OPTIONS.find((item) => item.value === mode)?.digits ?? 7);
    if (mode === "experiment_x7") {
      setRounds(7);
      setPatah(0);
      setStopScan(1);
    }
  }

  async function runScan() {
    if (!marketId) return setError("Pilih pasaran terlebih dahulu.");
    setLoading(true);
    setError("");
    setResult(null);
    setViewItem(null);
    setViewSaved(null);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId, scanMode, targetPos, target2D, target3D, L: rounds, patah, digitCount, stopScan }),
      });
      const data = await response.json();
      if (!response.ok || data?.error) throw new Error(data?.error || "Scan gagal.");
      setMarketName(String(data.market || selectedMarket?.name || selectedMarket?.id || "Pasaran"));
      setResult(data.result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Scan gagal.");
    } finally {
      setLoading(false);
    }
  }

  function saveTrek(item: AutoScanItem) {
    if (!result || !marketId) return;
    const id = trekId(marketId, item);
    const saved: SavedTrek = {
      version: 2,
      id,
      savedAt: new Date().toISOString(),
      marketId,
      marketName: title,
      scanMode: item.scanMode,
      targetPos: item.targetPos,
      target2D: item.target2D,
      target3D: item.target3D,
      digitCount: result.config.digitCount,
      L: result.config.L,
      patah: result.config.patah,
      formula: item.formula,
      code: item.code,
      kolomHidup: [...item.kolomHidup],
      activeColumns: item.activeColumns,
      predictionValues: predictionValues(item),
      snapshotRows: item.result.rows.map((row) => ({
        ...row,
        deret: [...row.deret],
        targetDigits: Array.isArray(row.targetDigits) && row.targetDigits.length ? [...row.targetDigits] : [row.targetDigit],
      })),
      savedLatestDraw: item.result.latestDraw,
    };
    setSavedTreks((current) => [saved, ...current.filter((trek) => trek.id !== id)].slice(0, 50));
    setSavedId(id);
    window.setTimeout(() => setSavedId(""), 1400);
  }

  function deleteTrek(id: string) {
    setSavedTreks((current) => current.filter((item) => item.id !== id));
    setViewSaved((current) => current?.id === id ? null : current);
  }

  async function copyDetail(detail: DetailData, id: string) {
    await copyText(detailCopyText(detail));
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(""), 1400);
  }

  const live = viewItem ? liveDetail(viewItem, title, result?.config.digitCount ?? digitCount) : null;
  const saved = viewSaved ? savedDetail(viewSaved) : null;

  return (
    <div className="animate-rise space-y-4">
      <ScanFields markets={markets} marketId={marketId} selectedMarket={selectedMarket} marketsLoading={marketsLoading} rounds={rounds} patah={patah} scanMode={scanMode} targetPos={targetPos} target2D={target2D} target3D={target3D} digitCount={digitCount} stopScan={stopScan} loading={loading} onMarketChange={setMarketId} onRoundsChange={setRounds} onPatahChange={setPatah} onModeChange={changeMode} onTargetPosChange={setTargetPos} onTarget2DChange={setTarget2D} onTarget3DChange={setTarget3D} onDigitCountChange={setDigitCount} onStopScanChange={setStopScan} onScan={runScan} />
      {error ? <div className="rounded-2xl border border-danger/30 bg-danger/10 p-3 text-sm font-bold text-danger">{error}</div> : null}
      {result ? <ScanResultSection result={result} marketTitle={title} marketId={marketId} savedId={savedId} onSave={saveTrek} onView={(item) => { setViewSaved(null); setViewItem(item); }} /> : null}
      <SavedTreksSection total={savedTreks.length} groups={savedGroups} onView={(item) => { setViewItem(null); setViewSaved(item); }} onDelete={deleteTrek} />
      {live ? <TrekDetailModal data={live} copied={copiedId === viewItem?.code} onCopy={() => copyDetail(live, viewItem?.code ?? "live")} onClose={() => setViewItem(null)} /> : null}
      {saved && viewSaved ? <TrekDetailModal data={saved} copied={copiedId === viewSaved.id} onCopy={() => copyDetail(saved, viewSaved.id)} onClose={() => setViewSaved(null)} /> : null}
    </div>
  );
}
