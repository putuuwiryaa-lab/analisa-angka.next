// Bypass sementara berakhir 9 November 2026 pukul 17:44:16 WITA (UTC+08:00).
export const TEMPORARY_PIN_BYPASS_UNTIL = Date.parse("2026-11-09T09:44:16.000Z");

export function isDenoDeployRuntime() {
  return process.env.DENO_DEPLOY === "true" || Boolean(process.env.DENO_DEPLOY_APP_ID);
}

export function isTemporaryPinBypassActive() {
  return isDenoDeployRuntime() && Date.now() < TEMPORARY_PIN_BYPASS_UNTIL;
}
