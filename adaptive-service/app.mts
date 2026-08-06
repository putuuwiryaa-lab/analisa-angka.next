import "./crons.mts";
import { adaptiveBatchReader } from "./batch-reader.mts";
import { adaptiveServiceHandler } from "./http.mts";
import { retiredLegacyPredictionStore } from "./legacy-endpoint.mts";

Deno.serve((request) => {
  const retiredEndpoint = retiredLegacyPredictionStore(request);
  if (retiredEndpoint) return retiredEndpoint;

  const url = new URL(request.url);
  if (url.pathname === "/snapshots/batch") {
    return adaptiveBatchReader(request);
  }
  return adaptiveServiceHandler(request);
});
