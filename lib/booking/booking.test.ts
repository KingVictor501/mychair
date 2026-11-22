// lib/booking/booking.test.ts
// WHAT IT'S FOR: automated checks of the booking rules (no database): open times respect hours,
// breaks, existing appointments, the past and the booking window; prices follow standard vs.
// custom; the cancellation window. Run with `npm test`.
// WHY THE NAME: tests for lib/booking/.

import { test } from "node:test";
import assert from "node:assert/strict";
import { canClientCancel, combineServices, effectivePrice, MAX_SERVICES, openSlots, parseLocalDate, parseServiceIds, type Rule } from "./slots";

const TZ = "America/New_York";
const TUESDAY = { year: 2026, month: 11, day: 24, weekday: 2 };
const RULES: Rule[] = [
  { kind: "work", startTime: "09:00", endTime: "12:00" },
  { kind: "break", startTime: "10:00", endTime: "10:30" },
];
// "Now" is the day before, so nothing on Tuesday is in the past.
const MONDAY_NOON = new Date("2026-11-23T17:00:00Z");

const times = (slots: Array<{ time: string }>) => slots.map((s) => s.time);

test("slots fill working hours in 15-minute steps and skip the break", () => {
  const slots = openSlots({ date: TUESDAY, timeZone: TZ, rules: RULES, busy: [], durationMin: 30, now: MONDAY_NOON, bookingWindowDays: 5 });
  assert.deepEqual(times(slots), ["09:00", "09:15", "09:30", "10:30", "10:45", "11:00", "11:15", "11:30"]);
  assert.equal(slots[0]?.startsAt, "2026-11-24T14:00:00.000Z");
});

test("a booked appointment blocks every slot that would overlap it", () => {
  const busy = [{ startsAt: new Date("2026-11-24T16:00:00Z"), endsAt: new Date("2026-11-24T16:45:00Z") }]; // 11:00–11:45 local
  const slots = openSlots({ date: TUESDAY, timeZone: TZ, rules: RULES, busy, durationMin: 30, now: MONDAY_NOON, bookingWindowDays: 5 });
  assert.deepEqual(times(slots), ["09:00", "09:15", "09:30", "10:30"]);
});

test("a long service only fits where the whole length is free", () => {
  const slots = openSlots({ date: TUESDAY, timeZone: TZ, rules: RULES, busy: [], durationMin: 90, now: MONDAY_NOON, bookingWindowDays: 5 });
  assert.deepEqual(times(slots), ["10:30"]);
});

test("past times and days beyond the booking window are not offered", () => {
  const tuesdayTenFifteen = new Date("2026-11-24T15:15:00Z");
  const later = openSlots({ date: TUESDAY, timeZone: TZ, rules: RULES, busy: [], durationMin: 30, now: tuesdayTenFifteen, bookingWindowDays: 5 });
  assert.deepEqual(times(later), ["10:30", "10:45", "11:00", "11:15", "11:30"]);
  const tooFar = openSlots({ date: TUESDAY, timeZone: TZ, rules: RULES, busy: [], durationMin: 30, now: new Date("2026-11-10T12:00:00Z"), bookingWindowDays: 5 });
  assert.deepEqual(tooFar, []);
});

test("custom prices apply only to pros on custom pricing", () => {
  assert.equal(effectivePrice("custom", 5000, 4000), 5000);
  assert.equal(effectivePrice("custom", null, 4000), 4000);
  assert.equal(effectivePrice("standard", 5000, 4000), 4000);
});

test("clients can cancel only before the cancellation window", () => {
  const start = new Date("2026-11-24T15:00:00Z");
  assert.equal(canClientCancel(start, 2, new Date("2026-11-24T12:59:00Z")), true);
  assert.equal(canClientCancel(start, 2, new Date("2026-11-24T13:01:00Z")), false);
});

test("dates are read strictly", () => {
  assert.deepEqual(parseLocalDate("2026-11-24"), TUESDAY);
  assert.equal(parseLocalDate("2026-02-30"), null);
  assert.equal(parseLocalDate("11/24/2026"), null);
});

test("several services add up to one visit, in the order picked", () => {
  const offered = [
    { id: "fade", durationMin: 45, priceCents: 3500 },
    { id: "beard", durationMin: 20, priceCents: 1500 },
    { id: "towel", durationMin: 15, priceCents: 1000 },
  ];
  const both = combineServices(offered, ["beard", "fade"]);
  assert.equal(both.ok, true);
  if (both.ok) {
    assert.deepEqual(both.services.map((s) => s.id), ["beard", "fade"]);
    assert.equal(both.durationMin, 65);
    assert.equal(both.priceCents, 5000);
  }
  assert.equal(combineServices(offered, []).ok, false, "at least one");
  assert.equal(combineServices(offered, ["fade", "fade"]).ok, false, "no repeats");
  assert.equal(combineServices(offered, ["fade", "lashes"]).ok, false, "only what this pro offers");
  const many = Array.from({ length: MAX_SERVICES + 1 }, (_, i) => ({ id: `s${i}`, durationMin: 10, priceCents: 100 }));
  assert.equal(combineServices(many, many.map((s) => s.id)).ok, false, `no more than ${MAX_SERVICES}`);
});

test("the services list in a URL is read as IDs separated by commas", () => {
  assert.deepEqual(parseServiceIds("a,b, c"), ["a", "b", "c"]);
  assert.deepEqual(parseServiceIds(""), []);
  assert.deepEqual(parseServiceIds(null), []);
});
