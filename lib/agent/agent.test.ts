// lib/agent/agent.test.ts
// WHAT IT'S FOR: automated checks of the triage agent's offline parts (no internet, no Claude):
//   - the note check: right sections, findings must match the real report, no private text,
//   - the path guard: notes can only be written as dated files inside agent/runs/,
//   - the audit row format,
//   - the MCP client: reads the report, and turns 401 / 503 / network errors into stop reasons.
// Run with `npm test`.
// WHY THE NAME: tests for everything in lib/agent/.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildReport, type WeeklyReport } from "../report";
import { auditRow, guardNotePath, latestNote, notePath } from "./files";
import { AgentStop, fetchWeeklyHealth, parseHealthReply, stopMessage } from "./health-client";
import { checkNote, renderNote, triageNoteInput, triageNoteJsonSchema, type TriageNote } from "./note";

// A pretend week built by the real report rules.
const REPORT: WeeklyReport = buildReport({
  now: new Date("2026-11-21T20:00:00.000Z"),
  requests: 26,
  serverErrors5xx: 0,
  unauthorized401: 6,
  forbidden403: 0,
  tooMany429: 0,
  badRequests400: 0,
  p50Ms: 97,
  p95Ms: 2086,
  questionsAsked: 5,
  answered: 3,
  refused: 2,
  injectionBlocked: 0,
  authFailures: 6,
  capHits: 0,
  corpusChunks: 118,
  corpusChunksFlagged: 0,
  newestLogAt: new Date("2026-11-21T19:59:00.000Z"),
  adminKeySet: true,
  anthropicKeySet: true,
  logLevelOk: true,
});

// A note that passes every check; each test changes one thing.
function goodNote(overrides: Partial<TriageNote> = {}): TriageNote {
  return {
    verdict: "watch",
    summary: "No outages; six failed key attempts this week.",
    findings: [
      { field: "status", value: "ok", rule: "status ok is normal", assessment: "normal", note: "" },
      { field: "auth_failures", value: "6", rule: "1 to 9 is watch", assessment: "watch", note: "Below the 10 alert line." },
    ],
    compared_with_last_week: "First run",
    judgment_calls: [],
    suggested: [],
    ...overrides,
  };
}

test("a correct note passes", () => {
  assert.equal(checkNote(goodNote(), REPORT).ok, true);
});

test("a finding with a value that isn't in the report is refused", () => {
  const note = goodNote({
    findings: [{ field: "p95_ms", value: "1500", rule: "under 3000 is normal", assessment: "normal", note: "" }],
  });
  const result = checkNote(note, REPORT);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.problems.join(" "), /p95_ms is 2086 in the report, not 1500/);
});

test("a finding about a field that doesn't exist is refused", () => {
  const note = goodNote({
    findings: [{ field: "client_emails", value: "3", rule: "made up", assessment: "watch", note: "" }],
  });
  assert.equal(checkNote(note, REPORT).ok, false);
});

test("a note containing an email address or phone number is refused", () => {
  assert.equal(checkNote(goodNote({ summary: "Contact admin@example.com about this." }), REPORT).ok, false);
  assert.equal(checkNote(goodNote({ summary: "Call 555-010-1234 about this." }), REPORT).ok, false);
});

test("a note missing a section or with an extra field is refused", () => {
  const { judgment_calls: _dropped, ...missing } = goodNote();
  assert.equal(checkNote(missing, REPORT).ok, false);
  assert.equal(checkNote({ ...goodNote(), run_sql: "DELETE FROM log_entries" }, REPORT).ok, false);
});

test("the JSON schema Claude sees requires the same sections as the zod check", () => {
  assert.deepEqual([...triageNoteJsonSchema.required].sort(), Object.keys(triageNoteInput.shape).sort());
});

test("the rendered note has every section, with the program's list of changes", () => {
  const md = renderNote(goodNote(), {
    date: "2026-11-21",
    runId: "t_test",
    reportGeneratedAt: REPORT.generated_at,
    mcpRequestId: "r_abc",
    changes: ["agent/runs/2026-11-21.md", "agent/audit-log.md (one row added)"],
  });
  for (const heading of ["## Summary", "## Findings", "## Compared with last week", "## Judgment calls", "## Suggested", "## Changes made"]) {
    assert.ok(md.includes(heading), heading);
  }
  assert.match(md, /`auth_failures` \| 6 \|/);
  assert.match(md, /- agent\/runs\/2026-11-21.md/);
});

test("the path guard only allows dated note files directly inside the runs folder", () => {
  const dir = mkdtempSync(join(tmpdir(), "runs-"));
  assert.ok(guardNotePath(dir, "2026-11-21.md").endsWith("2026-11-21.md"));
  for (const bad of ["../escape.md", "../../.env.local", "2026-11-21.txt", "notes/2026-11-21.md", "rules.md"]) {
    assert.throws(() => guardNotePath(dir, bad), /refused/, bad);
  }
});

test("a second note on the same day gets -2 instead of overwriting", () => {
  const dir = mkdtempSync(join(tmpdir(), "runs-"));
  writeFileSync(join(dir, "2026-11-21.md"), "first");
  assert.ok(notePath(dir, "2026-11-21").endsWith("2026-11-21-2.md"));
});

test("latestNote picks the newest note by date and number", () => {
  const dir = mkdtempSync(join(tmpdir(), "runs-"));
  writeFileSync(join(dir, "2026-11-14.md"), "older");
  writeFileSync(join(dir, "2026-11-21.md"), "newer");
  writeFileSync(join(dir, "2026-11-21-2.md"), "newest");
  assert.equal(latestNote(dir)?.text, "newest");
  assert.equal(latestNote(join(dir, "missing")), null);
});

test("an audit row is one table row with no stray pipes", () => {
  const row = auditRow({ when: "2026-11-21T20:00:00Z", runId: "t_1", outcome: "ok", read: "a | b", wrote: "x", suggested: "none" });
  assert.equal(row.split(" | ").length, 6);
  assert.ok(row.startsWith("| ") && row.endsWith(" |"));
});

// A pretend fetch that answers with a fixed status and body.
function fakeFetch(status: number, body = "", headers: Record<string, string> = {}): typeof fetch {
  return (async () => new Response(body, { status, headers })) as typeof fetch;
}

test("the MCP client reads the report and the request ID from a streamed answer", async () => {
  const rpc = { jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: JSON.stringify(REPORT) }] } };
  const body = `event: message\ndata: ${JSON.stringify(rpc)}\n\n`;
  const result = await fetchWeeklyHealth("https://example.test/api/mcp", "k", fakeFetch(200, body, { "x-request-id": "r_1" }));
  assert.equal(result.report.p95_ms, 2086);
  assert.equal(result.requestId, "r_1");
});

test("the MCP client turns 401, 503, other errors and network failures into stop reasons", async () => {
  const reasonOf = async (f: typeof fetch) => {
    try {
      await fetchWeeklyHealth("https://example.test/api/mcp", "k", f);
      return "no error";
    } catch (e) {
      return e instanceof AgentStop ? e.reason : "other";
    }
  };
  assert.equal(await reasonOf(fakeFetch(401)), "mcp_unauthorized");
  assert.equal(await reasonOf(fakeFetch(503)), "mcp_not_configured");
  assert.equal(await reasonOf(fakeFetch(500)), "mcp_unavailable");
  assert.equal(await reasonOf((async () => { throw new Error("offline"); }) as typeof fetch), "mcp_unavailable");
  assert.equal(await reasonOf(fakeFetch(200, "not json")), "mcp_bad_response");
});

test("a reply that isn't a full report is refused", () => {
  const rpc = { result: { content: [{ type: "text", text: JSON.stringify({ status: "ok" }) }] } };
  assert.throws(() => parseHealthReply(JSON.stringify(rpc)), AgentStop);
});

test("stop messages say nothing was changed and never include a key", () => {
  const message = stopMessage("mcp_unauthorized");
  assert.match(message, /No note was written and nothing in the app was changed/);
  assert.match(message, /MCP_API_KEY/);
  assert.doesNotMatch(message, /[0-9a-f]{32,}/);
});
