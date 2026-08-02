import assert from "node:assert/strict";
import { test } from "node:test";
import { HistoryDataFormatError, parseStrictHistory } from "../lib/engine/history";
import { tokenizeHistory } from "../lib/shared/history";

test("tokenizeHistory accepts all supported separators", () => {
  assert.deepEqual(tokenizeHistory("1234 5678\n9012\t3456,7890;2468|1357"), [
    "1234",
    "5678",
    "9012",
    "3456",
    "7890",
    "2468",
    "1357",
  ]);
});

test("parseStrictHistory accepts comma, semicolon, and pipe separators", () => {
  assert.deepEqual(parseStrictHistory("1234,5678;9012|3456"), ["1234", "5678", "9012", "3456"]);
});

test("parseStrictHistory still rejects tokens that are not exactly four digits", () => {
  assert.throws(
    () => parseStrictHistory("1234,567;90a2|34567"),
    (error: unknown) => {
      assert.ok(error instanceof HistoryDataFormatError);
      assert.deepEqual(error.invalidTokens, ["567 (urutan 2)", "90a2 (urutan 3)", "34567 (urutan 4)"]);
      return true;
    },
  );
});
