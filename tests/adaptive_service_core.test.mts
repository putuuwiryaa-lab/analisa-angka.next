import assert from "node:assert/strict";
import { runAdaptiveOnline as runAppEngine } from "../lib/adaptive/engine.ts";
import { runAdaptiveOnline as runServiceEngine } from "../adaptive-service/core/engine.mts";

const DRAWS = [
  "1234", "5678", "9012", "3456", "7890", "1122", "3344", "5566", "7788", "9900",
  "1357", "2468", "8642", "7531", "1029", "3847", "5610", "7293", "9475", "2751",
  "6184", "4307", "9526", "1748", "8063", "3915", "5270", "6481", "2196", "7854",
  "4632", "9081", "3527", "1469", "6705", "8314", "2940", "7158", "5802", "3697",
];

function assertNumbersClose(left: readonly number[], right: readonly number[]) {
  assert.equal(left.length, right.length);
  for (let index = 0; index < left.length; index++) {
    assert.ok(Math.abs(left[index] - right[index]) < 1e-12, `index ${index}`);
  }
}

Deno.test("service-local Adaptive core identik dengan engine aplikasi", () => {
  for (const target of ["depan", "tengah", "belakang"] as const) {
    for (const method of ["ai", "bbfs"] as const) {
      const app = runAppEngine(DRAWS, target, method, 7);
      const service = runServiceEngine(DRAWS, target, method, 7);

      assert.equal(service.prediction.engineVersion, app.prediction.engineVersion);
      assert.equal(service.prediction.configVersion, app.prediction.configVersion);
      assert.deepEqual(service.prediction.selection, app.prediction.selection);
      assert.deepEqual(service.prediction.replay, app.prediction.replay);
      assert.deepEqual(service.state, app.state);
      assertNumbersClose(service.prediction.pairProbabilities, app.prediction.pairProbabilities);
      assertNumbersClose(service.prediction.leftProbabilities, app.prediction.leftProbabilities);
      assertNumbersClose(service.prediction.rightProbabilities, app.prediction.rightProbabilities);
    }
  }
});

Deno.test("service-local core mempertahankan incremental state", () => {
  const appFirst = runAppEngine(DRAWS.slice(0, 30), "belakang", "bbfs", 7);
  const serviceFirst = runServiceEngine(DRAWS.slice(0, 30), "belakang", "bbfs", 7);
  const appNext = runAppEngine(DRAWS, "belakang", "bbfs", 7, appFirst.state);
  const serviceNext = runServiceEngine(DRAWS, "belakang", "bbfs", 7, serviceFirst.state);

  assert.equal(serviceNext.prediction.replay.mode, "incremental");
  assert.deepEqual(serviceNext.state, appNext.state);
  assert.deepEqual(serviceNext.prediction.selection, appNext.prediction.selection);
  assertNumbersClose(serviceNext.prediction.pairProbabilities, appNext.prediction.pairProbabilities);
});
