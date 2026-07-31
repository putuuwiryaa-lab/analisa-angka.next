export const TEMPORARY_PIN_BYPASS_UNTIL = Date.parse("2026-08-07T09:08:00.000Z");

export function isDenoDeployRuntime() {
  return process.env.DENO_DEPLOY === "true" || Boolean(process.env.DENO_DEPLOY_APP_ID);
}

export function isTemporaryPinBypassActive() {
  return isDenoDeployRuntime() && Date.now() < TEMPORARY_PIN_BYPASS_UNTIL;
}
