// lib/logger.test.ts
// WHAT IT'S FOR: automated checks of the logger: levels, JSON shape, and that secrets are hidden.
// Run with `npm test`.
// WHO USES IT: the test runner (`tsx --test`), never the app itself.
// WHY THE NAME: "<file>.test.ts" = the tests for <file>.ts.

import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { drainPendingLogs, getActiveLevel, log, type LogEntry } from "./logger";

// We swap process.stdout/stderr.write for a recorder during each test, so we can read what
// the logger printed. The originals are put back afterwards.
const realStdoutWrite = process.stdout.write.bind(process.stdout);
const realStderrWrite = process.stderr.write.bind(process.stderr);
let stdoutLines: string[] = [];
let stderrLines: string[] = [];
const originalLevel = process.env.LOG_LEVEL;

beforeEach(() => {
  stdoutLines = [];
  stderrLines = [];
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdoutLines.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrLines.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  drainPendingLogs();
});

afterEach(() => {
  process.stdout.write = realStdoutWrite;
  process.stderr.write = realStderrWrite;
  if (originalLevel === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = originalLevel;
});

// Reads the one JSON line the logger printed.
function parse(line: string): LogEntry {
  return JSON.parse(line) as LogEntry;
}

test("at LOG_LEVEL=info a debug line is not printed and not saved", () => {
  process.env.LOG_LEVEL = "info";
  log.debug("noisy_debug", { a: 1 });
  assert.equal(stdoutLines.length, 0);
  assert.equal(drainPendingLogs().length, 0);
});

test("at LOG_LEVEL=debug a debug line is printed and queued for saving", () => {
  process.env.LOG_LEVEL = "debug";
  log.debug("noisy_debug", { a: 1 });
  assert.equal(stdoutLines.length, 1);
  assert.equal(drainPendingLogs().length, 1);
});

test("each line is JSON with ts, level, event and details", () => {
  process.env.LOG_LEVEL = "debug";
  log.info("request_done", { method: "GET", status: 200, ms: 12 });
  const entry = parse(stdoutLines[0]);
  assert.equal(entry.level, "info");
  assert.equal(entry.event, "request_done");
  assert.deepEqual(entry.details, { method: "GET", status: 200, ms: 12 });
  assert.ok(!Number.isNaN(Date.parse(entry.ts)));
});

test("errors go to standard error, everything else to standard output", () => {
  process.env.LOG_LEVEL = "debug";
  log.error("request_failed", { route: "/api/x" });
  log.warn("slow", {});
  assert.equal(stderrLines.length, 1);
  assert.equal(stdoutLines.length, 1);
});

test("with LOG_TO_STDERR=1 every level goes to standard error and nothing to standard output", () => {
  process.env.LOG_LEVEL = "debug";
  process.env.LOG_TO_STDERR = "1";
  try {
    log.debug("a", {});
    log.info("b", {});
    log.warn("c", {});
    log.error("d", {});
  } finally {
    delete process.env.LOG_TO_STDERR;
  }
  assert.equal(stdoutLines.length, 0);
  assert.equal(stderrLines.length, 4);
});

test("a secret logged by mistake is hidden in the printed line AND the saved copy", () => {
  process.env.LOG_LEVEL = "info";
  log.info("login_attempt", {
    userId: "u_1",
    password: "hunter2",
    email: "jane@example.com",
    note: "contact jane@example.com",
  });
  const printed = stdoutLines[0];
  assert.ok(!printed.includes("hunter2"));
  assert.ok(!printed.includes("jane@example.com"));
  const saved = JSON.stringify(drainPendingLogs());
  assert.ok(!saved.includes("hunter2"));
  assert.ok(!saved.includes("jane@example.com"));
});

test("a missing or misspelled LOG_LEVEL falls back to info", () => {
  delete process.env.LOG_LEVEL;
  assert.equal(getActiveLevel(), "info");
  process.env.LOG_LEVEL = "loud";
  assert.equal(getActiveLevel(), "info");
});
