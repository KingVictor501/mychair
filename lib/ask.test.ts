// lib/ask.test.ts
// WHAT IT'S FOR: automated checks of the rules in lib/ask.ts (no database or internet):
// the question limits, the hourly cap, and what a visitor is allowed to see.
// Run with `npm test`.
// WHY THE NAME: "<file>.test.ts" = the tests for <file>.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { askInputSchema, buildAskResponse, DEFAULT_HOURLY_CAP, isOverCap, parseHourlyCap } from "./ask";
import { REFUSAL_LINE } from "./rag";
import type { RagResult } from "./types";

const LABEL = "cancellation-and-no-show-policy.md · The cancellation window";

// Builds a fake engine result.
function result(overrides: Partial<RagResult>): RagResult {
  return {
    outcome: "answered",
    answer: "Up to **2 hours** before.",
    citations: [LABEL],
    citationsVerified: true,
    passages: [{ id: "1", source: "cancellation-and-no-show-policy.md", heading: "The cancellation window", text: "Cancel up to the window.", score: 0.6 }],
    blockedPassages: 0,
    tookMs: 1,
    ...overrides,
  };
}

test("questions are trimmed and limited to 3 to 300 characters", () => {
  assert.equal(askInputSchema.safeParse({ question: "  How late can I cancel?  " }).data?.question, "How late can I cancel?");
  assert.equal(askInputSchema.safeParse({ question: "hi" }).success, false);
  assert.equal(askInputSchema.safeParse({ question: "   " }).success, false);
  assert.equal(askInputSchema.safeParse({ question: "a".repeat(300) }).success, true);
  assert.equal(askInputSchema.safeParse({ question: "a".repeat(301) }).success, false);
  assert.equal(askInputSchema.safeParse({ question: 5 }).success, false);
  assert.equal(askInputSchema.safeParse({}).success, false);
});

test("the hourly cap reads the environment safely", () => {
  assert.equal(parseHourlyCap(undefined), DEFAULT_HOURLY_CAP);
  assert.equal(parseHourlyCap(""), DEFAULT_HOURLY_CAP);
  assert.equal(parseHourlyCap("abc"), DEFAULT_HOURLY_CAP);
  assert.equal(parseHourlyCap("0"), DEFAULT_HOURLY_CAP);
  assert.equal(parseHourlyCap("-5"), DEFAULT_HOURLY_CAP);
  assert.equal(parseHourlyCap("20000"), DEFAULT_HOURLY_CAP);
  assert.equal(parseHourlyCap("25"), 25);
});

test("the cap blocks at the limit, not after it", () => {
  assert.equal(isOverCap(59, 60), false);
  assert.equal(isOverCap(60, 60), true);
  assert.equal(isOverCap(500, 60), true);
});

test("an answered result shows its source receipt", () => {
  const body = buildAskResponse(result({}));
  assert.equal(body?.outcome, "answered");
  assert.deepEqual(body?.sources, [
    { document: "cancellation-and-no-show-policy.md", section: "The cancellation window", label: LABEL, excerpt: "Cancel up to the window." },
  ]);
});

test("a refusal is shown with no sources", () => {
  const body = buildAskResponse(result({ outcome: "refused", answer: REFUSAL_LINE, citations: [] }));
  assert.deepEqual(body, { outcome: "refused", answer: REFUSAL_LINE, sources: [] });
});

test("an answer with unverified citations is never shown", () => {
  assert.equal(buildAskResponse(result({ citationsVerified: false })), null);
});

test("a malformed reply is never shown", () => {
  assert.equal(buildAskResponse(result({ outcome: "malformed" })), null);
});

test("an answer whose citation matches no passage is never shown", () => {
  assert.equal(buildAskResponse(result({ citations: ["made-up.md · Nope"] })), null);
});
