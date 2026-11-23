// lib/rate-limit.test.ts
// WHAT IT'S FOR: tests the rate limit rules that need no database (lib/rate-limit.ts): reading
// the visitor's IP, the time windows, Retry-After, the scrambled keys, and the limits themselves.
// WHO USES IT: `npm test`.
// WHY THE NAME: tests for rate-limit.ts.

import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "./api-error";
import { clientIp, limitKey, RATE_LIMITS, retryAfterSec, windowStart } from "./rate-limit";

test("clientIp prefers the header Vercel sets and takes the first address", () => {
  assert.equal(clientIp(new Headers({ "x-vercel-forwarded-for": "203.0.113.7", "x-forwarded-for": "198.51.100.1" })), "203.0.113.7");
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
  assert.equal(clientIp(new Headers({ "x-real-ip": "203.0.113.9" })), "203.0.113.9");
});

test("clientIp falls back to unknown when there is no address", () => {
  assert.equal(clientIp(new Headers()), "unknown");
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "  " })), "unknown");
});

test("windowStart rounds down to the start of the window", () => {
  const t = Date.UTC(2026, 10, 23, 10, 7, 30);
  assert.equal(windowStart(t, 15).toISOString(), "2026-11-23T10:00:00.000Z");
  assert.equal(windowStart(t, 60).toISOString(), "2026-11-23T10:00:00.000Z");
  assert.equal(windowStart(Date.UTC(2026, 10, 23, 10, 15, 0), 15).toISOString(), "2026-11-23T10:15:00.000Z");
});

test("retryAfterSec counts down to the end of the window, never below 1", () => {
  assert.equal(retryAfterSec(Date.UTC(2026, 10, 23, 10, 7, 30), 15), 450);
  assert.equal(retryAfterSec(Date.UTC(2026, 10, 23, 10, 14, 59, 999), 15), 1);
});

test("limitKey is stable, case-blind, and never contains the IP, email or phone", () => {
  const a = limitKey("login_account", "Pat@Example.com", "secret-one");
  assert.equal(a, limitKey("login_account", "pat@example.com ", "secret-one"));
  assert.match(a, /^login_account:[0-9a-f]{32}$/);
  assert.ok(!a.includes("example"));
  assert.ok(!limitKey("login_ip", "203.0.113.7", "secret-one").includes("203"));
});

test("limitKey differs by limit and by secret", () => {
  assert.notEqual(limitKey("login_ip", "203.0.113.7", "s"), limitKey("demo_enter_ip", "203.0.113.7", "s"));
  assert.notEqual(limitKey("login_ip", "203.0.113.7", "s1"), limitKey("login_ip", "203.0.113.7", "s2"));
});

test("every limit is sensible and has a friendly message", () => {
  for (const [name, l] of Object.entries(RATE_LIMITS)) {
    assert.ok(l.max > 0 && l.windowMin > 0 && l.windowMin <= 60, name);
    assert.ok(l.message.length > 0, name);
  }
  // The per-account login limit is tighter than the per-IP one (a shop can share Wi-Fi).
  assert.ok(RATE_LIMITS.login_account.max < RATE_LIMITS.login_ip.max);
});

test("ApiError carries extra headers such as Retry-After", () => {
  const e = new ApiError(429, "RATE_LIMITED", "Too many.", { headers: { "Retry-After": "60" } });
  assert.equal(e.headers["Retry-After"], "60");
  assert.deepEqual(new ApiError(400, "X", "Bad.").headers, {});
});
