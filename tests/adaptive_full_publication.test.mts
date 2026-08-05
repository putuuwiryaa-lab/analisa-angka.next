import assert from "node:assert/strict";
import { runAdaptiveOnline as runAppAdaptive } from "../lib/adaptive/engine.ts";
import { runAdaptiveOnline as runServiceAdaptive } from "../adaptive-service/core/engine.mts";
import {
  requestedSelectionBelongsToPublication,
  validateFullAdaptivePublication,
} from "../adaptive-service/core/publication.mts";

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
  assert.equal(validateFullAdaptivePublication(service.prediction.selections), null);
  assert.equal(
    requestedSelectionBelongsToPublication(
      service.prediction.selection,
      service.prediction.selections,
    ),
    true,
  );
});

Deno.test("validator menolak publication yang kurang atau terduplikasi", () => {
  const prediction = runServiceAdaptive(DRAWS, "depan", "bbfs", 7).prediction;

  assert.match(
    validateFullAdaptivePublication(prediction.selections.slice(0, 17)) ?? "",
    /tepat 18 selection/,
  );

  const duplicate = [
    ...prediction.selections.slice(0, 17),
    prediction.selections[0],
  ];
  assert.match(
    validateFullAdaptivePublication(duplicate) ?? "",
    /terduplikasi|belum tersedia/,
  );
});

Deno.test("validator menolak digit duplikat dalam satu selection", () => {
  const prediction = runServiceAdaptive(DRAWS, "tengah", "ai", 4).prediction;
  const invalid = prediction.selections.map((selection, index) =>
    index === 0
      ? { ...selection, digits: [selection.digits[0], selection.digits[0]] }
      : selection
  );

  assert.match(
    validateFullAdaptivePublication(invalid) ?? "",
    /tidak konsisten|tidak boleh duplikat/,
  );
});
