export const TEMPORARY_PIN_BYPASS_UNTIL = Date.parse("2026-10-25T13:12:00.000Z");

export function isDenoDeployRuntime() {
  return process.env.DENO_DEPLOY === "true" || Boolean(process.env.DENO_DEPLOY_APP_ID);
}

export function isTemporaryPinBypassActive() {
  return isDenoDeployRuntime() && Date.now() < TEMPORARY_PIN_BYPASS_UNTIL;
}
