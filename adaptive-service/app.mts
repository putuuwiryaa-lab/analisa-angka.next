import "./crons.mts";
import { adaptiveServiceHandler } from "./http.mts";

Deno.serve(adaptiveServiceHandler);
