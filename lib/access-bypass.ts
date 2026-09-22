export const TEMPORARY_PIN_BYPASS_UNTIL = Date.parse("2026-09-29T12:06:00.000Z");

export function isDenoDeployRuntime() {
  return process.env.DENO_DEPLOY === "true" || Boolean(process.env.DENO_DEPLOY_APP_ID);
}

export function isTemporaryPinBypassActive() {
  return isDenoDeployRuntime() && Date.now() < TEMPORARY_PIN_BYPASS_UNTIL;
}
