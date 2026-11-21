// lib/mcp-auth.test.ts
// WHAT IT'S FOR: automated checks of the live MCP server's lock: the right Bearer key opens it,
// a missing or wrong key gets 401, and a server with no MCP_API_KEY set refuses everything (503).
// Run with `npm test`.
// WHY THE NAME: "<file>.test.ts" = the tests for <file>.ts.

import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./api-error";
import { drainPendingLogs } from "./logger";
import { bearerToken, requireMcpKey } from "./mcp-auth";

const originalKey = process.env.MCP_API_KEY;
const originalLevel = process.env.LOG_LEVEL;
const realStdoutWrite = process.stdout.write.bind(process.stdout);
const realStderrWrite = process.stderr.write.bind(process.stderr);

// A made-up key used only in these tests.
const TEST_KEY = "test-mcp-key-not-real";

// Keep test output quiet: the lock logs warnings on purpose.
beforeEach(() => {
  process.env.LOG_LEVEL = "error";
  process.env.MCP_API_KEY = TEST_KEY;
  process.stdout.write = (() => true) as typeof process.stdout.write;
  process.stderr.write = (() => true) as typeof process.stderr.write;
  drainPendingLogs();
});

afterEach(() => {
  process.stdout.write = realStdoutWrite;
  process.stderr.write = realStderrWrite;
  if (originalKey === undefined) delete process.env.MCP_API_KEY;
  else process.env.MCP_API_KEY = originalKey;
  if (originalLevel === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = originalLevel;
  drainPendingLogs();
});

// Builds a pretend request, with or without an Authorization header.
function requestWith(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) headers.set("authorization", authorization);
  return new Request("http://localhost/api/mcp", { method: "POST", headers });
}

// Runs requireMcpKey and returns the status it threw, or "open" if it let the request through.
function outcome(request: Request): number | "open" {
  try {
    requireMcpKey(request);
    return "open";
  } catch (error) {
    assert.ok(error instanceof ApiError);
    return error.status;
  }
}

test("bearerToken reads the key from 'Bearer <key>' and nothing else", () => {
  assert.equal(bearerToken("Bearer abc123"), "abc123");
  assert.equal(bearerToken("bearer abc123"), "abc123");
  assert.equal(bearerToken(null), null);
  assert.equal(bearerToken("abc123"), null);
  assert.equal(bearerToken("Basic abc123"), null);
  assert.equal(bearerToken("Bearer "), null);
});

test("the right key opens the lock", () => {
  assert.equal(outcome(requestWith(`Bearer ${TEST_KEY}`)), "open");
});

test("a missing key gets 401", () => {
  assert.equal(outcome(requestWith()), 401);
});

test("a wrong key gets 401", () => {
  assert.equal(outcome(requestWith("Bearer wrong-key")), 401);
});

test("the admin key header does not open the MCP lock", () => {
  const request = new Request("http://localhost/api/mcp", { method: "POST", headers: { "x-admin-key": TEST_KEY } });
  assert.equal(outcome(request), 401);
});

test("with no MCP_API_KEY on the server, every request is refused with 503", () => {
  delete process.env.MCP_API_KEY;
  assert.equal(outcome(requestWith(`Bearer ${TEST_KEY}`)), 503);
});
