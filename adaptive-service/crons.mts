import { runAdaptiveReconciliation } from "./reconcile.mts";

const fallbackCronEnabled =
  Deno.env.get("ADAPTIVE_FALLBACK_CRON_ENABLED")?.trim().toLowerCase() === "true";

if (fallbackCronEnabled) {
  Deno.cron(
    "adaptive-market-reconciliation-fallback",
    "37 3 * * *",
    { backoffSchedule: [300_000] },
    async () => {
      const summary = await runAdaptiveReconciliation({
        trigger: "cron",
        marketLimit: 4,
      });
      console.log("[adaptive-reconciliation:fallback-cron]", {
        runId: summary.runId,
        status: summary.status,
        marketsProcessed: summary.marketsProcessed,
        targetsProcessed: summary.targetsProcessed,
        settledPredictions: summary.settledPredictions,
        remainingMarkets: summary.remainingMarkets,
        errorCount: summary.errorCount,
      });
    },
  );
} else {
  console.log(
    "[adaptive-reconciliation] Fallback cron nonaktif; menunggu trigger ingestion scraper.",
  );
}
