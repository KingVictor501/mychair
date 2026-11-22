// lib/auth/auth.test.ts
// WHAT IT'S FOR: automated checks of login and permissions (no database, no browser):
//   - passwords: hashed, salted, checked correctly, never matching a wrong or empty hash,
//   - sessions: a signed token reads back; a tampered, expired, wrong-secret or unsigned token
//     is refused,
//   - email / phone parsing,
//   - the shared permission rules, including demo accounts being boxed into demo shops.
// Run with `npm test`.
// WHY THE NAME: tests for everything in lib/auth/.

import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { ApiError } from "../api-error";
import type { CurrentUser } from "../types";
import { normalizePhone, parseIdentifier } from "./identifier";
import { hashPassword, verifyPassword } from "./password";
import { canEnterDemo, canUseAdmin, canViewAs } from "./access-rules";
import { superAdminSettings } from "./super-admin";
import { assertShopAccess, canAccessShop, canSeeClient, requireRole, requireUser } from "./permissions";
import { createSessionToken, readSessionToken } from "./session";

const SECRET = "test-session-secret-that-is-at-least-32-chars";
const original = process.env.SESSION_SECRET;
beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
});
afterEach(() => {
  if (original === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = original;
});

test("a password hash checks out for the right password only, and is salted", async () => {
  const a = await hashPassword("correct horse");
  const b = await hashPassword("correct horse");
  assert.notEqual(a, b, "same password, different salt, different hash");
  assert.ok(!a.includes("correct horse"));
  assert.equal(await verifyPassword("correct horse", a), true);
  assert.equal(await verifyPassword("wrong horse", a), false);
  assert.equal(await verifyPassword("correct horse", null), false);
  assert.equal(await verifyPassword("correct horse", "not-a-hash"), false);
});

const OWNER = { userId: "11111111-1111-1111-1111-111111111111", role: "owner" as const, shopId: "s1", demo: false };

test("a signed session token reads back what was signed", async () => {
  const token = await createSessionToken(OWNER);
  assert.deepEqual(await readSessionToken(token), OWNER);
});

test("a tampered token is refused (role changed to super_admin)", async () => {
  const token = await createSessionToken(OWNER);
  const [header, payload, signature] = token.split(".");
  const claims = JSON.parse(Buffer.from(payload ?? "", "base64url").toString());
  claims.role = "super_admin";
  const forged = [header, Buffer.from(JSON.stringify(claims)).toString("base64url"), signature].join(".");
  assert.equal(await readSessionToken(forged), null);
});

test("a token signed with a different secret is refused", async () => {
  const token = await createSessionToken(OWNER);
  process.env.SESSION_SECRET = "a-completely-different-secret-of-32-plus-chars";
  assert.equal(await readSessionToken(token), null);
});

test("an expired token is refused", async () => {
  const expired = await new SignJWT({ role: "owner", shopId: "s1", demo: false })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(OWNER.userId)
    .setIssuer("mychair")
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(new TextEncoder().encode(SECRET));
  assert.equal(await readSessionToken(expired), null);
});

test("an unsigned token (alg none) and garbage are refused", async () => {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: OWNER.userId, role: "super_admin", iss: "mychair" })).toString("base64url");
  assert.equal(await readSessionToken(`${header}.${payload}.`), null);
  assert.equal(await readSessionToken("garbage"), null);
  assert.equal(await readSessionToken(undefined), null);
});

test("a short or missing SESSION_SECRET refuses to sign", async () => {
  process.env.SESSION_SECRET = "too-short";
  await assert.rejects(createSessionToken(OWNER));
});

test("emails and US phone numbers are recognized and cleaned", () => {
  assert.deepEqual(parseIdentifier(" Ben.FadeFactory@Example.com "), { kind: "email", value: "ben.fadefactory@example.com" });
  assert.deepEqual(parseIdentifier("(555) 010-1234"), { kind: "phone", value: "+15550101234" });
  assert.equal(normalizePhone("+1 555 010 1234"), "+15550101234");
  assert.equal(parseIdentifier("hello"), null);
  assert.equal(parseIdentifier("not@an"), null);
});

// People for the permission tests.
const user = (role: CurrentUser["role"], shopId: string | null, isDemo = false): CurrentUser => ({ id: `u-${role}`, role, shopId, name: role, isDemo });
const REAL_SHOP = { id: "real", isDemo: false };
const DEMO_SHOP = { id: "demo", isDemo: true };

function statusOf(fn: () => void): number | "ok" {
  try {
    fn();
    return "ok";
  } catch (e) {
    assert.ok(e instanceof ApiError);
    return e.status;
  }
}

test("not logged in is 401; the wrong role is 403", () => {
  assert.equal(statusOf(() => requireUser(null)), 401);
  assert.equal(statusOf(() => requireRole(user("client", "real"), "super_admin")), 403);
  assert.equal(statusOf(() => requireRole(user("owner", "real"), "owner", "super_admin")), "ok");
});

test("people reach only their own shop; the Super Admin reaches any real shop", () => {
  assert.equal(canAccessShop(user("owner", "real"), REAL_SHOP), true);
  assert.equal(canAccessShop(user("owner", "other"), REAL_SHOP), false);
  assert.equal(canAccessShop(user("super_admin", null), REAL_SHOP), true);
  assert.equal(statusOf(() => assertShopAccess(user("pro", "other"), REAL_SHOP)), 404);
  assert.equal(statusOf(() => assertShopAccess(user("pro", "real"), null)), 404);
});

test("demo accounts are boxed into demo shops, even a demo Super Admin", () => {
  assert.equal(canAccessShop(user("super_admin", null, true), DEMO_SHOP), true);
  assert.equal(canAccessShop(user("super_admin", null, true), REAL_SHOP), false);
  assert.equal(canAccessShop(user("owner", "demo", true), DEMO_SHOP), true);
  assert.equal(canAccessShop(user("owner", "real", true), REAL_SHOP), false);
});

test("a pro sees only their own clients; owners see all; clients see none", () => {
  const pro = user("pro", "real");
  assert.equal(canSeeClient(pro, ["u-pro"]), true);
  assert.equal(canSeeClient(pro, ["someone-else"]), false);
  assert.equal(canSeeClient(user("owner", "real"), []), true);
  assert.equal(canSeeClient(user("client", "real"), ["u-client"]), false);
});

test("only a real Super Admin acting as themselves can use the admin tools", () => {
  assert.equal(canUseAdmin({ role: "super_admin", isDemo: false }, {}), true);
  assert.equal(canUseAdmin({ role: "super_admin", isDemo: true }, {}), false, "the demo Super Admin is boxed out");
  assert.equal(canUseAdmin({ role: "super_admin", isDemo: false }, { actorId: "admin-1" }), false, "not while viewing as someone");
  assert.equal(canUseAdmin({ role: "owner", isDemo: false }, {}), false);
  assert.equal(canUseAdmin(null, null), false);
});

test("view as works for owners and pros only, and demo accounts only while demo mode is on", () => {
  assert.equal(canViewAs({ role: "owner", isDemo: false }, false), true);
  assert.equal(canViewAs({ role: "pro", isDemo: false }, false), true);
  assert.equal(canViewAs({ role: "client", isDemo: false }, true), false, "never a client");
  assert.equal(canViewAs({ role: "super_admin", isDemo: false }, true), false, "never another Super Admin");
  assert.equal(canViewAs({ role: "pro", isDemo: true }, false), false);
  assert.equal(canViewAs({ role: "pro", isDemo: true }, true), true);
});

test("the demo page only opens demo owners and pros in demo shops while demo mode is on", () => {
  const demoShop = { isDemo: true };
  assert.equal(canEnterDemo({ role: "owner", isDemo: true }, demoShop, true), true);
  assert.equal(canEnterDemo({ role: "pro", isDemo: true }, demoShop, true), true);
  assert.equal(canEnterDemo({ role: "pro", isDemo: true }, demoShop, false), false, "demo mode off");
  assert.equal(canEnterDemo({ role: "pro", isDemo: false }, demoShop, true), false, "a real account, never");
  assert.equal(canEnterDemo({ role: "pro", isDemo: true }, { isDemo: false }, true), false, "a real shop, never");
  assert.equal(canEnterDemo({ role: "client", isDemo: true }, demoShop, true), false, "not a client");
  assert.equal(canEnterDemo({ role: "super_admin", isDemo: true }, demoShop, true), false, "not the demo Super Admin");
});

test("a view-as session token keeps the Super Admin's ID", async () => {
  const token = await createSessionToken({ userId: "u-owner", role: "owner", shopId: "s1", demo: false, actorId: "u-admin" });
  const claims = await readSessionToken(token);
  assert.equal(claims?.actorId, "u-admin");
  assert.equal(claims?.userId, "u-owner");
  const normal = await readSessionToken(await createSessionToken({ userId: "u1", role: "pro", shopId: "s1", demo: false }));
  assert.equal(normal?.actorId, undefined, "normal sessions have no actor");
});

test("the Super Admin settings need a real email and a password of 12 or more characters", () => {
  const ok = superAdminSettings({ SUPER_ADMIN_EMAIL: " Me@Example.com ", SUPER_ADMIN_PASSWORD: "a-long-password-1" });
  assert.deepEqual(ok, { ok: true, settings: { email: "me@example.com", password: "a-long-password-1", name: "Admin" } });
  assert.equal(superAdminSettings({ SUPER_ADMIN_EMAIL: "", SUPER_ADMIN_PASSWORD: "a-long-password-1" }).ok, false);
  assert.equal(superAdminSettings({ SUPER_ADMIN_EMAIL: "not-an-email", SUPER_ADMIN_PASSWORD: "a-long-password-1" }).ok, false);
  assert.equal(superAdminSettings({ SUPER_ADMIN_EMAIL: "me@example.com", SUPER_ADMIN_PASSWORD: "short" }).ok, false, "too short");
});
