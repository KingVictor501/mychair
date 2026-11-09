// lib/admin-auth.test.ts
// WHAT IT'S FOR: automated checks of the admin lock: right key opens it, everything else stays shut,
// and requireAdminKey gives the right error codes (401 wrong key, 503 not configured).
// Run with `npm test`.
// WHY THE NAME: "<file>.test.ts" = the tests for <file>.ts.

import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./api-error";
import { isValidAdminKey, requireAdminKey } from "./admin-auth";
import { drainPendingLogs } from "./logger";

const originalKey = process.env.ADMIN_API_KEY;
const originalLevel = process.env.LOG_LEVEL;
const realStdoutWrite = process.stdout.write.bind(process.stdout);
const realStderrWrite = process.stderr.write.bind(process.stderr);

// Keep test output quiet: the lock logs warnings on purpose.
beforeEach(() => {
  process.env.LOG_LEVEL = "error";
  process.stdout.write = (() => true) as typeof process.stdout.write;
  process.stderr.write = (() => true) as typeof process.stderr.write;
  drainPendingLogs();
});

afterEach(() => {
  process.stdout.write = realStdoutWrite;
  process.stderr.write = realStderrWrite;
  if (originalKey === undefined) delete process.env.ADMIN_API_KEY;
  else process.env.ADMIN_API_KEY = originalKey;
  if (originalLevel === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = originalLevel;
});

// Builds a fake request carrying an (optional) admin key header.
function requestWithKey(key?: string): Request {
  return new Request("http://localhost/api/search?q=test", {
    headers: key === undefined ? {} : { "x-admin-key": key },
  });
}

// Runs a function and returns the ApiError it throws (or fails the test if it doesn't throw).
function catchApiError(fn: () => void): ApiError {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof ApiError, "expected an ApiError");
    return error;
  }
  assert.fail("expected the function to throw");
}

test("the right key is accepted", () => {
  assert.equal(isValidAdminKey("abc123", "abc123"), true);
});

test("a wrong, empty, or missing key is refused", () => {
  assert.equal(isValidAdminKey("abc124", "abc123"), false);
  assert.equal(isValidAdminKey("", "abc123"), false);
  assert.equal(isValidAdminKey(null, "abc123"), false);
  assert.equal(isValidAdminKey("short", "a much longer expected key"), false);
});

test("if no key is configured on the server, nothing is accepted (not even an empty key)", () => {
  assert.equal(isValidAdminKey("", undefined), false);
  assert.equal(isValidAdminKey("anything", undefined), false);
  assert.equal(isValidAdminKey("", ""), false);
});

test("requireAdminKey lets the right key through", () => {
  process.env.ADMIN_API_KEY = "secret-value";
  assert.doesNotThrow(() => requireAdminKey(requestWithKey("secret-value")));
});

test("requireAdminKey gives a 401 for a wrong key and a missing key", () => {
  process.env.ADMIN_API_KEY = "secret-value";
  assert.equal(catchApiError(() => requireAdminKey(requestWithKey("nope"))).status, 401);
  assert.equal(catchApiError(() => requireAdminKey(requestWithKey())).status, 401);
});

test("requireAdminKey gives a 503 (not an open door) when the server has no key configured", () => {
  delete process.env.ADMIN_API_KEY;
  assert.equal(catchApiError(() => requireAdminKey(requestWithKey("anything"))).status, 503);
});

test("the typed key is never written to the logs", () => {
  process.env.ADMIN_API_KEY = "secret-value";
  process.env.LOG_LEVEL = "debug";
  catchApiError(() => requireAdminKey(requestWithKey("my-wrong-guess-12345")));
  assert.ok(!JSON.stringify(drainPendingLogs()).includes("my-wrong-guess-12345"));
});
