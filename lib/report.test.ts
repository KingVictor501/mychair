// lib/report.test.ts
// WHAT IT'S FOR: automated checks of the report rules in lib/report.ts (no database or internet):
// the security thresholds and the flat row. Run with `npm test`.
// WHY THE NAME: "<file>.test.ts" = the tests for <file>.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { AUTH_FAILURES_ATTENTION_AT, buildReport, evaluateSecurity, type ReportInputs } from "./report";

const NOW = new Date("2026-11-15T02:00:00.000Z");

// A healthy week; each test changes one thing.
function inputs(overrides: Partial<ReportInputs>): ReportInputs {
  return {
    now: NOW,
    requests: 100,
    serverErrors5xx: 2,
    unauthorized401: 0,
    forbidden403: 0,
    tooMany429: 0,
    badRequests400: 3,
    p50Ms: 120.4,
    p95Ms: 900.6,
    questionsAsked: 10,
    answered: 8,
    refused: 2,
    injectionBlocked: 0,
    authFailures: 0,
    capHits: 0,
    corpusChunks: 118,
    corpusChunksFlagged: 0,
    newestLogAt: new Date("2026-11-15T01:30:00.000Z"),
    adminKeySet: true,
    anthropicKeySet: true,
    logLevelOk: true,
    ...overrides,
  };
}

test("a healthy week is ok with no notes", () => {
  assert.deepEqual(evaluateSecurity(inputs({})), { status: "ok", notes: [] });
});

test("each alarming condition makes the status attention", () => {
  const cases: Array<[Partial<ReportInputs>, string]> = [
    [{ corpusChunksFlagged: 1 }, "corpus_chunk_flagged"],
    [{ authFailures: AUTH_FAILURES_ATTENTION_AT }, "auth_failures_high"],
    [{ adminKeySet: false }, "admin_key_missing"],
    [{ anthropicKeySet: false }, "anthropic_key_missing"],
    [{ logLevelOk: false }, "log_level_not_info"],
    [{ newestLogAt: new Date("2026-11-13T00:00:00.000Z") }, "logging_stale"],
    [{ newestLogAt: null }, "logging_stale"],
    [{ capHits: 1 }, "hourly_cap_hit"],
  ];
  for (const [change, note] of cases) {
    const result = evaluateSecurity(inputs(change));
    assert.equal(result.status, "attention", note);
    assert.ok(result.notes.includes(note), note);
  }
});

test("a blocked injection and a few auth failures are noted but stay ok", () => {
  const result = evaluateSecurity(inputs({ injectionBlocked: 2, authFailures: AUTH_FAILURES_ATTENTION_AT - 1 }));
  assert.equal(result.status, "ok");
  assert.deepEqual(result.notes, ["injection_blocked", "auth_failures_some"]);
});

test("the report is one flat row with rounded numbers", () => {
  const report = buildReport(inputs({}));
  assert.equal(report.status, "ok");
  assert.equal(report.week_start, "2026-11-08");
  assert.equal(report.week_end, "2026-11-15");
  assert.equal(report.error_rate_pct, 2);
  assert.equal(report.p50_ms, 120);
  assert.equal(report.p95_ms, 901);
  assert.equal(report.logging_alive, true);
  assert.equal(report.security_status, "ok");
  assert.equal(report.security_notes, "none");
  for (const value of Object.values(report)) {
    assert.ok(["string", "number", "boolean"].includes(typeof value) || value === null);
  }
});

test("a week with no requests is reported as empty and does not divide by zero", () => {
  const report = buildReport(inputs({ requests: 0, serverErrors5xx: 0, p50Ms: null, p95Ms: null }));
  assert.equal(report.status, "empty");
  assert.equal(report.error_rate_pct, 0);
  assert.equal(report.p50_ms, null);
});
