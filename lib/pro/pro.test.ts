// lib/pro/pro.test.ts
// WHAT IT'S FOR: automated checks of the pro-view rules (no database): the order an appointment
// can move in, who may change an appointment, and what a style card may contain.
// Run with `npm test`.
// WHY THE NAME: tests for lib/pro/.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { CurrentUser } from "../types";
import { canManageAppointment, canTransition, canViewCard, nextSteps, statusChangeInput, styleCardInput } from "./lifecycle";

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

test("a pro sees another pro's style card only on a day that client is booked with them", () => {
  const card = { proId: "pro-a", shopId: "shop-1" };
  assert.equal(canViewCard(person("pro", "pro-a", "shop-1"), card, false), true, "the card's own pro, any day");
  assert.equal(canViewCard(person("pro", "pro-b", "shop-1"), card, false), false, "another pro, not booked today");
  assert.equal(canViewCard(person("pro", "pro-b", "shop-1"), card, true), true, "another pro, booked today");
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
