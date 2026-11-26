// lib/demo/demo.test.ts
// WHAT IT'S FOR: automated checks of the demo catalog and the time-zone helpers (no database):
//   - the catalog is clearly fictional (example.com emails, 555-01xx phones) and complete,
//   - local shop times convert to the right UTC moment, including across daylight saving.
// Run with `npm test`.
// WHY THE NAME: tests for lib/demo/.

import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_SHOPS, DEMO_SUPER_ADMIN, demoDropInClients } from "./catalog";
import { staffName } from "../format";
import { demoId } from "./seed";
import { addDays, localDateParts, minutesToTime, timeToMinutes, zonedToUtc } from "./time";

test("three demo shops, each with 1 owner, 3 pros and a priced service list", () => {
  assert.deepEqual(DEMO_SHOPS.map((s) => s.businessType), ["barbershop", "nail_salon", "lash_studio"]);
  for (const shop of DEMO_SHOPS) {
    assert.equal(shop.pros.length, 3, shop.name);
    assert.ok(shop.services.length >= 7, shop.name);
    // At least one pro has custom prices, and they only name real services.
    const custom = shop.pros.filter((p) => p.customPrices);
    assert.ok(custom.length >= 1, shop.name);
    for (const p of custom) for (const name of Object.keys(p.customPrices ?? {})) assert.ok(shop.services.some((s) => s.name === name), name);
  }
});

test("every demo contact is fictional and unique", () => {
  const people = DEMO_SHOPS.flatMap((s) => [s.owner, ...s.pros, ...s.clients, ...demoDropInClients(s)]);
  for (const p of people) {
    assert.match(p.email, /@example\.com$/, p.email);
    assert.match(p.phone, /^\+1\d{3}55501\d{2}$/, p.phone);
  }
  assert.match(DEMO_SUPER_ADMIN.email, /@example\.com$/);
  assert.equal(new Set(people.map((p) => p.email)).size, people.length);
  assert.equal(new Set(people.map((p) => p.phone)).size, people.length);
});

test("local shop times convert to the right UTC moment, winter and summer", () => {
  const winter = { year: 2026, month: 11, day: 24, weekday: 2 };
  assert.equal(zonedToUtc(winter, "09:00", "America/New_York").toISOString(), "2026-11-24T14:00:00.000Z");
  const summer = { year: 2026, month: 7, day: 14, weekday: 2 };
  assert.equal(zonedToUtc(summer, "09:00", "America/New_York").toISOString(), "2026-07-14T13:00:00.000Z");
});

test("dates, weekdays and minutes are calculated correctly", () => {
  const d = localDateParts(new Date("2026-11-22T03:00:00Z"), "America/New_York");
  assert.deepEqual(d, { year: 2026, month: 11, day: 21, weekday: 6 });
  assert.deepEqual(addDays(d, 10), { year: 2026, month: 12, day: 1, weekday: 2 });
  assert.equal(timeToMinutes("13:30"), 810);
  assert.equal(minutesToTime(810), "13:30");
});

test("demo IDs are fixed per person and shop, unique, and valid UUIDs", () => {
  const keys = [DEMO_SUPER_ADMIN.email, ...DEMO_SHOPS.flatMap((s) => [s.slug, s.owner.email, ...s.pros.map((p) => p.email), ...s.clients.map((c) => c.email), ...demoDropInClients(s).map((c) => c.email)])];
  const ids = keys.map(demoId);
  assert.deepEqual(keys.map(demoId), ids, "same input, same ID every time");
  assert.equal(new Set(ids).size, ids.length, "no two demo records share an ID");
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("each shop gets 320 drop-in clients that never reuse a regular's first name", () => {
  for (const shop of DEMO_SHOPS) {
    const dropIns = demoDropInClients(shop);
    assert.equal(dropIns.length, 320, shop.name);
    const regulars = new Set(shop.clients.map((c) => c.name));
    assert.ok(dropIns.every((c) => !regulars.has(c.name)), "so searching a regular's name finds just them");
  }
});

test("pros and owners show first name and last initial, and no two in a shop look the same", () => {
  assert.equal(staffName("Ray", "Kendall"), "Ray K.");
  assert.equal(staffName("Ray", " kendall "), "Ray K.", "trims and capitalises");
  assert.equal(staffName("Ray", null), "Ray", "no last name: first name only");
  assert.equal(staffName("Ray", ""), "Ray");
  for (const shop of DEMO_SHOPS) {
    const staff = [shop.owner, ...shop.pros];
    assert.ok(staff.every((p) => p.lastName.trim().length > 0), `${shop.name}: everyone has a last name`);
    const labels = staff.map((p) => staffName(p.name, p.lastName));
    assert.equal(new Set(labels).size, labels.length, `${shop.name}: labels are all different`);
  }
});
