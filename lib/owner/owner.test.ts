// lib/owner/owner.test.ts
// WHAT IT'S FOR: automated checks of the owner view's rules (no database): the pricing input,
// the pay label and the revenue date ranges. Run with `npm test`.
// WHY THE NAME: tests for lib/owner/.

import { test } from "node:test";
import assert from "node:assert/strict";
import { payLabel, pricingInput, revenueRanges } from "./rules";

const SVC = "6f1c3d2e-8a4b-4c5d-9e6f-1a2b3c4d5e6f";

test("a pricing change takes a mode and sensible prices, and nothing else", () => {
  assert.equal(pricingInput.safeParse({ priceMode: "custom", prices: [{ serviceId: SVC, priceCents: 4500 }] }).success, true);
  assert.equal(pricingInput.safeParse({ priceMode: "standard", prices: [] }).success, true);
  assert.equal(pricingInput.safeParse({ priceMode: "custom", prices: [{ serviceId: SVC, priceCents: null }] }).success, true, "null = use the standard price");
  assert.equal(pricingInput.safeParse({ priceMode: "cheap", prices: [] }).success, false);
  assert.equal(pricingInput.safeParse({ priceMode: "custom", prices: [{ serviceId: SVC, priceCents: -1 }] }).success, false, "no negative prices");
  assert.equal(pricingInput.safeParse({ priceMode: "custom", prices: [{ serviceId: SVC, priceCents: 100_001 }] }).success, false, "no prices over $1,000");
  assert.equal(pricingInput.safeParse({ priceMode: "custom", prices: [{ serviceId: SVC, priceCents: 45.5 }] }).success, false, "whole cents only");
  assert.equal(pricingInput.safeParse({ priceMode: "custom", prices: [], payAmount: 0 }).success, false, "can't sneak in pay changes");
});

test("pay structure reads in plain words", () => {
  assert.equal(payLabel("chair_rent", 25000), "Chair rent $250/mo");
  assert.equal(payLabel("commission", 45), "Commission 45%");
  assert.equal(payLabel(null, null), "Not set");
});

test("revenue ranges start at midnight today, Monday and the 1st, in the shop's time zone", () => {
  // Wednesday 26 Nov 2026, 3pm in New York (20:00 UTC).
  const r = revenueRanges(new Date("2026-11-26T20:00:00Z"), "America/New_York");
  assert.equal(r.today.toISOString(), "2026-11-26T05:00:00.000Z");
  assert.equal(r.week.toISOString(), "2026-11-23T05:00:00.000Z", "Monday 23 Nov");
  assert.equal(r.month.toISOString(), "2026-11-01T04:00:00.000Z", "1 Nov, still daylight time");
});
