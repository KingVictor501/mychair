// lib/vitals.test.ts
// WHAT IT'S FOR: automated checks of the site performance rules (no database): what a browser may
// send, how addresses become page patterns without IDs, and the good / needs work / poor limits.
// Run with `npm test`.
// WHY THE NAME: tests for lib/vitals.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { formatVital, pagePattern, rateVital, vitalInput } from "./vitals";

test("a web vitals reading is checked, and extra fields from the browser are dropped", () => {
  const ok = vitalInput.safeParse({ name: "LCP", value: 1800, rating: "good", page: "/pro", id: "v5-123", entries: [] });
  assert.equal(ok.success, true);
  if (ok.success) assert.deepEqual(Object.keys(ok.data).sort(), ["name", "page", "rating", "value"]);
  assert.equal(vitalInput.safeParse({ name: "FID", value: 10, rating: "good", page: "/" }).success, false, "unknown measure");
  assert.equal(vitalInput.safeParse({ name: "LCP", value: -1, rating: "good", page: "/" }).success, false);
  assert.equal(vitalInput.safeParse({ name: "LCP", value: 999999, rating: "good", page: "/" }).success, false, "absurd values refused");
});

test("pages are stored as patterns, with no IDs and no query", () => {
  assert.equal(pagePattern("/pro/clients/83eb6eea-b1c1-4fc5-a400-fe953f334ddf?tab=1"), "/pro/clients/[id]");
  assert.equal(pagePattern("/guest"), "/guest");
  assert.equal(pagePattern("https://evil.example/x"), "/", "only paths");
});

test("readings are rated with Google's limits", () => {
  assert.equal(rateVital("LCP", 2500), "good");
  assert.equal(rateVital("LCP", 3000), "needs-improvement");
  assert.equal(rateVital("LCP", 4001), "poor");
  assert.equal(rateVital("CLS", 0.05), "good");
  assert.equal(rateVital("INP", 600), "poor");
  assert.equal(formatVital("LCP", 1840), "1.8 s");
  assert.equal(formatVital("INP", 120), "120 ms");
  assert.equal(formatVital("CLS", 0.042), "0.04");
});
