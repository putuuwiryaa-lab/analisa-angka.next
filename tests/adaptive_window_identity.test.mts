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

function seededDraws(count: number, initialSeed: number, pairRange = 100): string[] {
  let seed = initialSeed >>> 0;
  return Array.from({ length: count }, () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const pair = Math.floor((seed / 0x100000000) * pairRange);
    return `00${String(pair).padStart(2, "0")}`;
  });
}

const STABLE_DRAWS = seededDraws(170, 0x12345678);
const SHIFT_21_DRAWS = [
  ...seededDraws(149, 0x11111111),
  ...seededDraws(21, 0x22222222, 25),
];
const SHIFT_42_DRAWS = [
  ...seededDraws(128, 0x33333333),
  ...seededDraws(42, 0x44444444, 25),
];
const SHIFT_85_DRAWS = [
  ...seededDraws(85, 0x55555555),
  ...seededDraws(85, 0x66666666, 25),
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
  const appBefore = adaptiveExpert(buildAppExperts(STABLE_DRAWS, "belakang"));
  const appAfter = adaptiveExpert(buildAppExperts(SHIFT_21_DRAWS, "belakang"));
  const serviceBefore = adaptiveExpert(buildServiceExperts(STABLE_DRAWS, "belakang"));
  const serviceAfter = adaptiveExpert(buildServiceExperts(SHIFT_21_DRAWS, "belakang"));

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

Deno.test("detektor regime menahan noise dan memilih skala perubahan yang terbukti", () => {
  const scenarios = [
    { draws: STABLE_DRAWS, expected: 170 },
    { draws: SHIFT_21_DRAWS, expected: 21 },
    { draws: SHIFT_42_DRAWS, expected: 42 },
    { draws: SHIFT_85_DRAWS, expected: 85 },
  ];

  for (const scenario of scenarios) {
    const app = adaptiveExpert(buildAppExperts(scenario.draws, "belakang"));
    const service = adaptiveExpert(buildServiceExperts(scenario.draws, "belakang"));
    assert.equal(app.horizon, scenario.expected);
    assert.equal(service.horizon, scenario.expected);
    assert.deepEqual(service.pairProbabilities, app.pairProbabilities);
  }

  let falseShortWindows = 0;
  for (let trial = 1; trial <= 64; trial++) {
    const horizon = adaptiveExpert(
      buildServiceExperts(seededDraws(170, (0x9e3779b9 * trial) >>> 0), "belakang"),
    ).horizon;
    if (horizon < 170) falseShortWindows += 1;
  }
  assert.ok(falseShortWindows <= 1, `False short-window switches: ${falseShortWindows}/64`);
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
