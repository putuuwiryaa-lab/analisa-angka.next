import { runAdaptiveReconciliation } from "./reconcile.mts";

Deno.cron(
  "adaptive-market-reconciliation",
  "*/15 * * * *",
  { backoffSchedule: [60_000, 300_000, 900_000] },
  async () => {
    const summary = await runAdaptiveReconciliation({
      trigger: "cron",
      marketLimit: 4,
    });
    console.log("[adaptive-reconciliation:cron]", {
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
