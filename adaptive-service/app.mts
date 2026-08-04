import "./crons.mts";
import { adaptiveBatchSnapshotHandler } from "./batch-snapshots-http.mts";
import { adaptiveServiceHandler } from "./http.mts";

Deno.serve((request) => {
  const url = new URL(request.url);
  if (url.pathname === "/snapshots/batch") {
    return adaptiveBatchSnapshotHandler(request);
  }
  return adaptiveServiceHandler(request);
});
