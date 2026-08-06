import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNextPath } from "../lib/shared/safeNextPath";

test("safeNextPath preserves local paths, query strings, and fragments", () => {
  assert.equal(
    safeNextPath("/scan?view=adaptive#hasil", "/"),
    "/scan?view=adaptive#hasil",
  );
});

test("safeNextPath rejects absolute and protocol-relative URLs", () => {
  assert.equal(safeNextPath("https://evil.example/path", "/admin"), "/admin");
  assert.equal(safeNextPath("//evil.example/path", "/admin"), "/admin");
});

test("safeNextPath rejects backslash-based cross-origin redirects", () => {
  assert.equal(safeNextPath("/\\evil.example", "/"), "/");

  const encodedBackslash = new URLSearchParams("next=%2F%5Cevil.example").get("next");
  assert.equal(safeNextPath(encodedBackslash, "/admin"), "/admin");
});

test("safeNextPath rejects encoded protocol-relative redirects after query decoding", () => {
  const encodedSlashes = new URLSearchParams("next=%2F%2Fevil.example").get("next");
  assert.equal(safeNextPath(encodedSlashes, "/"), "/");
});

test("safeNextPath rejects control characters and falls back for empty input", () => {
  assert.equal(safeNextPath("/scan\nnext", "/admin"), "/admin");
  assert.equal(safeNextPath(null, "/admin"), "/admin");
});
