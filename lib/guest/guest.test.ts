// lib/guest/guest.test.ts
// WHAT IT'S FOR: automated checks of booking without an account (no database): which shops a
// guest can see, and what a guest booking may contain. Run with `npm test`.
// WHY THE NAME: tests for lib/guest/.

import { test } from "node:test";
import assert from "node:assert/strict";
import { guestBookingInput, guestCanSeeShop } from "./booking";

test("guests see real shops always, and demo shops only while demo mode is on", () => {
  assert.equal(guestCanSeeShop({ isDemo: false }, false), true);
  assert.equal(guestCanSeeShop({ isDemo: false }, true), true);
  assert.equal(guestCanSeeShop({ isDemo: true }, true), true);
  assert.equal(guestCanSeeShop({ isDemo: true }, false), false);
});

test("a guest booking needs a pro, service, time, first name and phone, and nothing else", () => {
  const good = { proId: "6f1c3d2e-8a4b-4c5d-9e6f-1a2b3c4d5e6f", serviceId: "7a1c3d2e-8a4b-4c5d-9e6f-1a2b3c4d5e6f", startsAt: "2026-12-01T15:00:00Z", name: "Sam", phone: "(212) 555-0199" };
  assert.equal(guestBookingInput.safeParse(good).success, true);
  assert.equal(guestBookingInput.safeParse({ ...good, name: "  " }).success, false, "a name is required");
  assert.equal(guestBookingInput.safeParse({ ...good, phone: "" }).success, false, "a phone is required");
  assert.equal(guestBookingInput.safeParse({ ...good, name: "x".repeat(41) }).success, false);
  assert.equal(guestBookingInput.safeParse({ ...good, clientId: good.proId }).success, false, "can't pick a client record");
});
