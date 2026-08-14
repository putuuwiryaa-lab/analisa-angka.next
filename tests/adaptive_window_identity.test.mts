import assert from "node:assert/strict";
import {
  ADAPTIVE_WINDOW_EXPERT_ID as APP_ADAPTIVE_WINDOW_EXPERT_ID,
  buildBaselineExperts as buildAppExperts,
} from "../lib/adaptive/experts.ts";
import { resolveExpertWeights as resolveAppWeights } from "../lib/adaptive/learning.ts";
import {
  ADAPTIVE_WINDOW_EXPERT_ID as SERVICE_ADAPTIVE_WINDOW_EXPERT_ID,
  buildBaselineExperts as buildServiceExperts,
} from "../adaptive-service/core/experts.mts";
import { resolveExpertWeights as resolveServiceWeights } from "../adaptive-service/core/weights.mts";
import type { AdaptiveExpertOutput } from "../lib/adaptive/types.ts";

const DRAWS = [
  "1234", "5678", "9012", "3456", "7890", "1122", "3344", "5566", "7788", "9900",
  "1357", "2468", "8642", "7531", "1029", "3847", "5610", "7293", "9475", "2751",
  "6184", "4307", "9526", "1748", "8063", "3915", "5270", "6481", "2196", "7854",
  "4632",
];

function adaptiveExpert(experts: readonly AdaptiveExpertOutput[]): AdaptiveExpertOutput {
  const found = experts.find((expert) => expert.family === "regime");
  assert.ok(found, "expert adaptive-window tidak ditemukan");
  return found;
}

function legacyWeights(
  experts: readonly AdaptiveExpertOutput[],
  weights: Readonly<Record<string, number>>,
): Record<string, number> {
  const adaptive = adaptiveExpert(experts);
  const migrated = { ...weights };
  const adaptiveWeight = migrated[adaptive.id];
  delete migrated[adaptive.id];
  migrated[`adaptive-window:${adaptive.horizon}`] = adaptiveWeight;
  return migrated;
}

Deno.test("ID adaptive-window tetap stabil ketika horizon berubah", () => {
  const appBefore = adaptiveExpert(buildAppExperts(DRAWS.slice(0, 30), "belakang"));
  const appAfter = adaptiveExpert(buildAppExperts(DRAWS, "belakang"));
  const serviceBefore = adaptiveExpert(buildServiceExperts(DRAWS.slice(0, 30), "belakang"));
  const serviceAfter = adaptiveExpert(buildServiceExperts(DRAWS, "belakang"));

  assert.equal(APP_ADAPTIVE_WINDOW_EXPERT_ID, "adaptive-window");
  assert.equal(SERVICE_ADAPTIVE_WINDOW_EXPERT_ID, APP_ADAPTIVE_WINDOW_EXPERT_ID);
  assert.equal(appBefore.id, APP_ADAPTIVE_WINDOW_EXPERT_ID);
  assert.equal(appAfter.id, APP_ADAPTIVE_WINDOW_EXPERT_ID);
  assert.notEqual(appBefore.horizon, appAfter.horizon);
  assert.equal(serviceBefore.id, APP_ADAPTIVE_WINDOW_EXPERT_ID);
  assert.equal(serviceAfter.id, APP_ADAPTIVE_WINDOW_EXPERT_ID);
  assert.equal(serviceBefore.horizon, appBefore.horizon);
  assert.equal(serviceAfter.horizon, appAfter.horizon);
});

Deno.test("bobot adaptive-window lama dimigrasikan tanpa reset atau renormalisasi", () => {
  const appExperts = buildAppExperts(DRAWS.slice(0, 30), "belakang");
  const appBaseline = resolveAppWeights(appExperts);
  assert.deepEqual(
    resolveAppWeights(appExperts, legacyWeights(appExperts, appBaseline)),
    appBaseline,
  );

  const serviceExperts = buildServiceExperts(DRAWS.slice(0, 30), "belakang");
  const serviceBaseline = resolveServiceWeights(serviceExperts);
  assert.deepEqual(
    resolveServiceWeights(serviceExperts, legacyWeights(serviceExperts, serviceBaseline)),
    serviceBaseline,
  );
});
