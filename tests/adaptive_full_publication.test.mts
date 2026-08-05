import assert from "node:assert/strict";
import { runAdaptiveOnline as runAppAdaptive } from "../lib/adaptive/engine.ts";
import { runAdaptiveOnline as runServiceAdaptive } from "../adaptive-service/core/engine.mts";

const DRAWS = [
  "1234", "5678", "9012", "3456", "7890", "1122", "3344",
  "5566", "7788", "9900", "1357", "2468", "8642", "7531",
  "1029", "3847", "5610", "7293", "9475", "2751", "6308",
];

Deno.test("Next.js dan Adaptive service menerbitkan 18 selection yang identik", () => {
  const app = runAppAdaptive(DRAWS, "belakang", "ai", 4);
  const service = runServiceAdaptive(DRAWS, "belakang", "ai", 4);

  assert.equal(app.prediction.selections.length, 18);
  assert.equal(service.prediction.selections.length, 18);
  assert.deepEqual(app.prediction.selection, service.prediction.selection);
  assert.deepEqual(app.prediction.selections, service.prediction.selections);
  assert.deepEqual(app.prediction.pairProbabilities, service.prediction.pairProbabilities);
});
