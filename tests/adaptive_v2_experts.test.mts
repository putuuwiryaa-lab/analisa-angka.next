import assert from "node:assert/strict";
import { buildBaselineExperts } from "../adaptive-service/core/experts.mts";
import {
  ADAPTIVE_ENGINE_VERSION,
  ADAPTIVE_MAX_HISTORY,
  ADAPTIVE_REPLAY_WARMUP,
  ADAPTIVE_SELECTION_COUNT,
  ADAPTIVE_TARGETS,
} from "../adaptive-service/core/types.mts";

const HISTORY_170 = Array.from({ length: 170 }, (_, index) => {
  const a = (index * 7 + 1) % 10;
  const c = (index * 3 + 4) % 10;
  const k = (index * 9 + 2) % 10;
  const e = (index * 5 + 6) % 10;
  return `${a}${c}${k}${e}`;
});

Deno.test("Adaptive V2 contract fokus belakang dan 170 result", () => {
  assert.equal(ADAPTIVE_ENGINE_VERSION, "hf-apie-v2-back");
  assert.deepEqual(ADAPTIVE_TARGETS, ["belakang"]);
  assert.equal(ADAPTIVE_SELECTION_COUNT, 11);
  assert.equal(ADAPTIVE_MAX_HISTORY, 170);
  assert.equal(ADAPTIVE_REPLAY_WARMUP, 28);
});

Deno.test("Adaptive V2 membangun tepat 28 expert yang beragam", () => {
  const experts = buildBaselineExperts(HISTORY_170, "belakang");
  assert.equal(experts.length, 28);
  assert.equal(new Set(experts.map((expert) => expert.id)).size, 28);

  const families = new Set(experts.map((expert) => expert.family));
  for (const family of [
    "null",
    "positional-frequency",
    "direct-pair-frequency",
    "bayesian-pair",
    "recency",
    "transition",
    "markov",
    "recurrence",
    "momentum",
    "regime",
    "structural",
    "context",
  ]) {
    assert.ok(families.has(family), `family ${family} harus tersedia`);
  }

  assert.ok(experts.some((expert) => expert.id === "uniform-null:170"));
  assert.ok(experts.some((expert) => expert.id === "direct-pair-frequency:170"));
  assert.ok(experts.some((expert) => expert.id === "cross-position-conditional:170"));
  assert.ok(experts.some((expert) => expert.id === "variable-order-pair:170"));
  assert.ok(experts.some((expert) => expert.horizon === 170));

  const totalWeight = experts.reduce((sum, expert) => sum + expert.weight, 0);
  assert.ok(Math.abs(totalWeight - 1) < 1e-12);
  for (const expert of experts) {
    assert.equal(expert.pairProbabilities.length, 100);
    assert.ok(Math.abs(expert.pairProbabilities.reduce((sum, value) => sum + value, 0) - 1) < 1e-10);
    assert.ok((expert.effectiveHistory ?? 0) <= ADAPTIVE_MAX_HISTORY);
  }
});

Deno.test("expert V2 hanya memakai reservoir 170 terakhir", () => {
  const older = Array.from({ length: 20 }, (_, index) => `${index % 10}999`);
  const withOlderPrefix = buildBaselineExperts([...older, ...HISTORY_170], "belakang");
  const exact170 = buildBaselineExperts(HISTORY_170, "belakang");

  assert.deepEqual(
    withOlderPrefix.map((expert) => ({ id: expert.id, matrix: expert.pairProbabilities })),
    exact170.map((expert) => ({ id: expert.id, matrix: expert.pairProbabilities })),
  );
});
