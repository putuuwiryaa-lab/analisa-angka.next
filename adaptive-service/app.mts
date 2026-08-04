import "./crons.mts";
import { adaptiveBatchReader } from "./batch-reader.mts";
import { adaptiveServiceHandler } from "./http.mts";

Deno.serve((request) => {
  const url = new URL(request.url);
  if (url.pathname === "/snapshots/batch") {
    return adaptiveBatchReader(request);
  }
  return adaptiveServiceHandler(request);
});
