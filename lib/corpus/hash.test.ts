// lib/corpus/hash.test.ts
// WHAT IT'S FOR: checks the chunk fingerprint behaves: same input = same fingerprint,
// any change = a different one. This is what makes `npm run corpus:embed` safe to re-run.
// WHY THE NAME: "<file>.test.ts" = the tests for <file>.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkHash } from "./hash";

test("the same text and model always give the same fingerprint (64 hex characters)", () => {
  const a = chunkHash("faq.md > Boots\nBreak them in.", "model-a");
  assert.equal(a, chunkHash("faq.md > Boots\nBreak them in.", "model-a"));
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("changing the text OR the model changes the fingerprint", () => {
  const base = chunkHash("faq.md > Boots\nBreak them in.", "model-a");
  assert.notEqual(base, chunkHash("faq.md > Boots\nBreak them in!", "model-a"));
  assert.notEqual(base, chunkHash("faq.md > Boots\nBreak them in.", "model-b"));
});
