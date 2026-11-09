// lib/embeddings.test.ts
// WHAT IT'S FOR: automated checks of the parts of lib/embeddings.ts that don't need the internet:
// splitting into batches and validating OpenAI's answer. Run with `npm test`.
// WHY THE NAME: "<file>.test.ts" = the tests for <file>.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { EXPECTED_DIMENSIONS, parseEmbeddingResponse, splitIntoBatches } from "./embeddings";

// A fake embedding: the right number of numbers, all the same value.
function fakeEmbedding(value: number): number[] {
  return new Array<number>(EXPECTED_DIMENSIONS).fill(value);
}

test("splitIntoBatches cuts a list into groups of at most the batch size", () => {
  assert.deepEqual(splitIntoBatches([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(splitIntoBatches([], 3), []);
  assert.deepEqual(splitIntoBatches([1, 2], 5), [[1, 2]]);
});

test("parseEmbeddingResponse returns the embeddings in the order the texts were sent", () => {
  // OpenAI includes an index; we put them back in order even if they arrive shuffled.
  const json = {
    data: [
      { index: 1, embedding: fakeEmbedding(2) },
      { index: 0, embedding: fakeEmbedding(1) },
    ],
  };
  const result = parseEmbeddingResponse(json, 2);
  assert.equal(result[0][0], 1);
  assert.equal(result[1][0], 2);
});

test("parseEmbeddingResponse refuses a wrong count, wrong size, or garbage", () => {
  assert.throws(() => parseEmbeddingResponse({ data: [] }, 1));
  assert.throws(() => parseEmbeddingResponse({ data: [{ index: 0, embedding: [1, 2, 3] }] }, 1));
  assert.throws(() => parseEmbeddingResponse({ data: [{ index: 5, embedding: fakeEmbedding(1) }] }, 1));
  assert.throws(() => parseEmbeddingResponse({ data: [{ index: 0, embedding: "nope" }] }, 1));
  assert.throws(() => parseEmbeddingResponse(null, 1));
  assert.throws(() => parseEmbeddingResponse("hello", 1));
});

test("parseEmbeddingResponse refuses two items with the same index (one would be missing)", () => {
  const json = {
    data: [
      { index: 0, embedding: fakeEmbedding(1) },
      { index: 0, embedding: fakeEmbedding(2) },
    ],
  };
  assert.throws(() => parseEmbeddingResponse(json, 2));
});
