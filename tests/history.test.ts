import { HistoryDataFormatError, parseStrictHistory } from "../lib/engine/history.ts";
import { tokenizeHistory } from "../lib/shared/history.ts";

function assertEquals<T>(actual: T, expected: T) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
  }
}

Deno.test("tokenizeHistory accepts all supported separators", () => {
  assertEquals(tokenizeHistory("1234 5678\n9012\t3456,7890;2468|1357"), [
    "1234",
    "5678",
    "9012",
    "3456",
    "7890",
    "2468",
    "1357",
  ]);
});

Deno.test("parseStrictHistory accepts comma, semicolon, and pipe separators", () => {
  assertEquals(parseStrictHistory("1234,5678;9012|3456"), ["1234", "5678", "9012", "3456"]);
});

Deno.test("parseStrictHistory still rejects tokens that are not exactly four digits", () => {
  try {
    parseStrictHistory("1234,567;90a2|34567");
    throw new Error("Expected HistoryDataFormatError");
  } catch (error) {
    if (!(error instanceof HistoryDataFormatError)) throw error;
    assertEquals(error.invalidTokens, ["567 (urutan 2)", "90a2 (urutan 3)", "34567 (urutan 4)"]);
  }
});
