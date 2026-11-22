// lib/pro/pro.test.ts
// WHAT IT'S FOR: automated checks of the pro-view rules (no database): the order an appointment
// can move in, who may change an appointment, and what a style card may contain.
// Run with `npm test`.
// WHY THE NAME: tests for lib/pro/.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { CurrentUser } from "../types";
import { groupVisits } from "./visits";
import { canBookFor, canManageAppointment, canTransition, canViewCard, nextSteps, proSettingsInput, statusChangeInput, styleCardInput } from "./lifecycle";

test("appointments move in the right order and final statuses stay final", () => {
  assert.equal(canTransition("waiting", "in_chair"), true);
  assert.equal(canTransition("waiting", "no_show"), true);
  assert.equal(canTransition("waiting", "cancelled"), true);
  assert.equal(canTransition("in_chair", "completed"), true);
  assert.equal(canTransition("waiting", "completed"), false, "can't skip the chair");
  assert.equal(canTransition("completed", "cancelled"), false);
  assert.equal(canTransition("no_show", "in_chair"), false);
  assert.deepEqual(nextSteps("cancelled"), []);
});

test("completing needs a payment status; other steps don't", () => {
  assert.equal(statusChangeInput.safeParse({ status: "completed" }).success, false);
  assert.equal(statusChangeInput.safeParse({ status: "completed", paymentStatus: "cash" }).success, true);
  assert.equal(statusChangeInput.safeParse({ status: "in_chair" }).success, true);
  assert.equal(statusChangeInput.safeParse({ status: "waiting" }).success, false, "can't move back to waiting");
  assert.equal(statusChangeInput.safeParse({ status: "completed", paymentStatus: "bitcoin" }).success, false);
});

const person = (role: CurrentUser["role"], id: string, shopId: string | null): CurrentUser => ({ id, role, shopId, name: id, isDemo: false });
const APPT = { proId: "pro-a", shopId: "shop-1" };

test("only the appointment's own pro, an owner of that shop, or the Super Admin may change it", () => {
  assert.equal(canManageAppointment(person("pro", "pro-a", "shop-1"), APPT), true);
  assert.equal(canManageAppointment(person("pro", "pro-b", "shop-1"), APPT), false, "another pro in the same shop");
  assert.equal(canManageAppointment(person("owner", "own-1", "shop-1"), APPT), true);
  assert.equal(canManageAppointment(person("owner", "own-2", "shop-2"), APPT), false, "another shop's owner");
  assert.equal(canManageAppointment(person("super_admin", "admin", null), APPT), true);
  assert.equal(canManageAppointment(person("client", "c1", "shop-1"), APPT), false);
});

test("a pro sees another pro's style card at any time when the client is also theirs", () => {
  const card = { proId: "pro-a", shopId: "shop-1" };
  assert.equal(canViewCard(person("pro", "pro-a", "shop-1"), card, false), true, "the card's own pro, any day");
  assert.equal(canViewCard(person("pro", "pro-b", "shop-1"), card, false), false, "another pro, not their client");
  assert.equal(canViewCard(person("pro", "pro-b", "shop-1"), card, true), true, "another pro who also has the client, any day");
  assert.equal(canViewCard(person("pro", "pro-c", "shop-2"), card, true), false, "a pro in another shop, never");
  assert.equal(canViewCard(person("owner", "own-1", "shop-1"), card, false), true);
  assert.equal(canViewCard(person("owner", "own-2", "shop-2"), card, false), false);
  assert.equal(canViewCard(person("super_admin", "admin", null), card, false), true);
  assert.equal(canViewCard(person("client", "c1", "shop-1"), card, true), false);
});

test("a style card accepts sensible input and refuses oversized or extra fields", () => {
  const good = { preferences: { guard: "#2 on the sides" }, notes: "Likes it short.", usualServiceId: null, timeEstimateMin: 45 };
  assert.equal(styleCardInput.safeParse(good).success, true);
  assert.equal(styleCardInput.safeParse({ ...good, notes: "x".repeat(2001) }).success, false);
  assert.equal(styleCardInput.safeParse({ ...good, timeEstimateMin: 2 }).success, false);
  assert.equal(styleCardInput.safeParse({ ...good, clientEmail: "a@b.co" }).success, false, "no extra fields");
  const many = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`k${i}`, "v"]));
  assert.equal(styleCardInput.safeParse({ ...good, preferences: many }).success, false);
});

test("a pro books with another pro only if that pro allows it, and only in the same shop", () => {
  const ray = person("pro", "ray", "shop-1");
  assert.equal(canBookFor(ray, { id: "ray", shopId: "shop-1", allowOthersToBook: false }), true, "always with themselves");
  assert.equal(canBookFor(ray, { id: "tia", shopId: "shop-1", allowOthersToBook: true }), true, "Tia allows it");
  assert.equal(canBookFor(ray, { id: "leo", shopId: "shop-1", allowOthersToBook: false }), false, "Leo doesn't");
  assert.equal(canBookFor(ray, { id: "annie", shopId: "shop-2", allowOthersToBook: true }), false, "another shop, never");
  assert.equal(canBookFor(person("client", "c1", "shop-1"), { id: "tia", shopId: "shop-1", allowOthersToBook: true }), false, "not for clients");
});

test("pro settings accept a true/false toggle and nothing else", () => {
  assert.equal(proSettingsInput.safeParse({ allowOthersToBook: true }).success, true);
  assert.equal(proSettingsInput.safeParse({ allowOthersToBook: "yes" }).success, false);
  assert.equal(proSettingsInput.safeParse({ allowOthersToBook: false, priceMode: "custom" }).success, false, "no sneaking in other fields");
});

test("everything on the same day is one visit: completed, no-show or rescheduled", () => {
  const tz = "America/New_York";
  const appts = [
    // Tue 18 Nov: a fade at 10:00 and a beard trim at 10:45, both done.
    { id: "b", startsAt: "2026-11-18T15:45:00Z", services: ["Beard trim"], priceCents: 1500, status: "completed" },
    { id: "a", startsAt: "2026-11-18T15:00:00Z", services: ["Skin fade"], priceCents: 3500, status: "completed" },
    // Sat 15 Nov: came for a two-service appointment; a later one was cancelled. Still "completed".
    { id: "d", startsAt: "2026-11-15T19:00:00Z", services: ["Edge-up"], priceCents: 1500, status: "cancelled" },
    { id: "c", startsAt: "2026-11-15T14:00:00Z", services: ["Cut + beard", "Hot towel shave"], priceCents: 9000, status: "completed" },
    // Thu 13 Nov: didn't come.
    { id: "f", startsAt: "2026-11-13T15:00:00Z", services: ["Skin fade"], priceCents: 3500, status: "no_show" },
    // Wed 12 Nov: cancelled = rescheduled.
    { id: "e", startsAt: "2026-11-12T15:00:00Z", services: ["Skin fade"], priceCents: 3500, status: "cancelled" },
    // Today, not marked yet: not a visit outcome, so it's left out.
    { id: "g", startsAt: "2026-11-11T15:00:00Z", services: ["Skin fade"], priceCents: 3500, status: "waiting" },
  ];
  const visits = groupVisits(appts, tz);
  assert.equal(visits.length, 4, "four days with an outcome; the unmarked one is left out");
  assert.deepEqual(visits[0], { key: "2026-11-18", startsAt: "2026-11-18T15:00:00Z", services: ["Skin fade", "Beard trim"], totalCents: 5000, outcome: "completed" });
  assert.deepEqual(visits[1]!.services, ["Cut + beard", "Hot towel shave"], "only what they came for; 'Cut + beard' stays one service");
  assert.equal(visits[1]!.totalCents, 9000, "the cancelled one isn't charged");
  assert.equal(visits[2]!.outcome, "no_show");
  assert.equal(visits[2]!.totalCents, null, "no cost for a no-show");
  assert.equal(visits[3]!.outcome, "rescheduled");
  assert.equal(visits[3]!.totalCents, null, "no cost for a rescheduled visit");
});

test("visits are split by the shop's local day, not the UTC day", () => {
  // 11pm and 11:30pm in New York on 18 Nov are already 19 Nov in UTC; still one visit on the 18th.
  const visits = groupVisits(
    [
      { id: "x", startsAt: "2026-11-19T04:30:00Z", services: ["Edge-up"], priceCents: 1500, status: "completed" },
      { id: "y", startsAt: "2026-11-19T04:00:00Z", services: ["Skin fade"], priceCents: 3500, status: "completed" },
    ],
    "America/New_York",
  );
  assert.equal(visits.length, 1);
  assert.equal(visits[0]!.key, "2026-11-18");
});
